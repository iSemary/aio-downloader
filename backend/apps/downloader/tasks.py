from datetime import timedelta
import logging
from pathlib import Path

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.conf import settings
from django.db.models import Max
from django.utils import timezone

from apps.downloader.http_download import PauseRequested, run_http_download
from apps.downloader.models import (
    ENGINE_HTTP,
    ENGINE_YTDLP,
    DownloadJob,
    DownloadedFile,
    DownloadJobMetrics,
    JobEvent,
    Playlist,
)
from apps.downloader.speed_parse import parse_speed_str_to_bps
from apps.downloader.ytdlp_utils import run_download

logger = logging.getLogger(__name__)


def _send_ws(job_id: str, payload: dict) -> None:
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"download_{job_id}",
        {"type": "download.event", "payload": payload},
    )


def _log_event(
    job: DownloadJob,
    event_type: str,
    *,
    message: str = "",
    payload: dict | None = None,
    worker_id: str = "",
) -> None:
    JobEvent.objects.create(
        job=job,
        event_type=event_type,
        message=message,
        payload=payload or {},
        worker_id=worker_id,
    )


def _expires_at_for_user(user) -> timezone.datetime | None:
    try:
        prefs = user.preferences
        days = prefs.storage_retention_days
    except Exception:
        days = 7
    if days == 0:
        return None
    return timezone.now() + timedelta(days=days)


@shared_task(bind=True)
def download_video_task(self, job_id: str):
    try:
        job = DownloadJob.objects.select_related("user").prefetch_related("files").get(id=job_id)
    except DownloadJob.DoesNotExist:
        return

    if job.status == DownloadJob.Status.CANCELLED:
        return

    metrics, _ = DownloadJobMetrics.objects.get_or_create(job=job)
    now = timezone.now()
    job.status = DownloadJob.Status.DOWNLOADING
    job.celery_task_id = self.request.id or ""
    if not job.started_at:
        job.started_at = now
    job.save(update_fields=["status", "celery_task_id", "started_at", "updated_at"])
    _log_event(job, JobEvent.EventType.STARTED, message="Download started", worker_id=self.request.hostname or "")

    last_speed_bps: float | None = None
    peak_bps: float = float(metrics.peak_speed_bps or 0)

    def progress_hook(d: dict) -> None:
        nonlocal last_speed_bps, peak_bps
        job.refresh_from_db(fields=["status"])
        if job.status == DownloadJob.Status.CANCELLED:
            raise RuntimeError("cancelled")

        if d.get("status") == "downloading":
            raw = d.get("_percent_str") or "0%"
            try:
                pct = int(float(raw.strip().rstrip("%")))
            except ValueError:
                pct = metrics.progress_pct
            speed = d.get("_speed_str") or ""
            eta = d.get("_eta_str") or ""
            bps = parse_speed_str_to_bps(speed)
            if bps is not None:
                last_speed_bps = bps
                peak_bps = max(peak_bps, bps)
            DownloadJobMetrics.objects.filter(pk=metrics.pk).update(
                progress_pct=pct,
                last_speed_str=speed,
                last_eta_str=eta,
                peak_speed_bps=peak_bps,
                last_heartbeat=timezone.now(),
            )
            _send_ws(
                str(job.id),
                {
                    "type": "progress",
                    "percent": pct,
                    "progress_pct": pct,
                    "speed": speed,
                    "speed_str": speed,
                    "eta": eta,
                    "eta_str": eta,
                    "bytes_downloaded": metrics.bytes_downloaded,
                    "expected_size": metrics.bytes_total,
                },
            )

    try:
        info = run_download(job, progress_hook)
        rel_path = info.get("filepath") or ""
        size = int(info.get("filesize") or 0)
        title = info.get("title") or job.title
        platform = info.get("platform") or job.platform
        completed = timezone.now()
        wall = 0
        if job.started_at:
            wall = max(0, int((completed - job.started_at).total_seconds()))

        DownloadJob.objects.filter(pk=job.id).update(
            status=DownloadJob.Status.DONE,
            title=title[:512],
            platform=platform[:128],
            completed_at=completed,
        )
        DownloadJobMetrics.objects.filter(pk=metrics.pk).update(
            progress_pct=100,
            bytes_downloaded=size,
            bytes_total=size,
            last_speed_str="",
            last_eta_str="",
            avg_speed_bps=last_speed_bps,
            peak_speed_bps=peak_bps,
            duration_seconds=wall,
            last_heartbeat=completed,
        )
        if rel_path:
            fname = Path(rel_path).name
            exp = _expires_at_for_user(job.user)
            DownloadedFile.objects.update_or_create(
                job=job,
                user=job.user,
                file_path=rel_path,
                defaults={
                    "file_name": fname,
                    "mime_type": "",
                    "file_size_bytes": size,
                    "storage_backend": "local",
                    "is_deleted": False,
                    "expires_at": exp,
                },
            )
        job.refresh_from_db()
        _log_event(job, JobEvent.EventType.DONE, payload={"file_path": rel_path, "file_size": size})
        _send_ws(
            str(job.id),
            {
                "type": "done",
                "file_path": rel_path,
                "file_size": size,
                "title": job.title,
            },
        )

        from apps.integrations.telegram import maybe_auto_send

        maybe_auto_send(job)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Download failed for %s", job_id)
        if "cancelled" in str(exc).lower():
            DownloadJob.objects.filter(pk=job.id).update(status=DownloadJob.Status.CANCELLED, error_message="Cancelled")
            _log_event(job, JobEvent.EventType.CANCELLED, message="Cancelled")
            _send_ws(str(job.id), {"type": "error", "message": "Cancelled"})
            return

        DownloadJob.objects.filter(pk=job.id).update(
            status=DownloadJob.Status.ERROR,
            error_message=str(exc)[:2000],
        )
        _log_event(job, JobEvent.EventType.ERROR, message=str(exc)[:500], payload={"detail": str(exc)[:2000]})
        _send_ws(str(job.id), {"type": "error", "message": str(exc)})


@shared_task(bind=True)
def download_http_task(self, job_id: str):
    job_id = str(job_id)
    try:
        job = DownloadJob.objects.select_related("user").get(id=job_id)
    except DownloadJob.DoesNotExist:
        return

    if job.status == DownloadJob.Status.CANCELLED:
        return

    if job.status not in (
        DownloadJob.Status.PENDING,
        DownloadJob.Status.DOWNLOADING,
        DownloadJob.Status.PAUSED,
    ):
        return

    metrics, _ = DownloadJobMetrics.objects.get_or_create(job=job)
    now = timezone.now()
    job.status = DownloadJob.Status.DOWNLOADING
    job.celery_task_id = self.request.id or ""
    if not job.started_at:
        job.started_at = now
    job.save(update_fields=["status", "celery_task_id", "started_at", "updated_at"])
    _log_event(job, JobEvent.EventType.STARTED, message="HTTP download started", worker_id=self.request.hostname or "")

    last_speed_bps: float | None = None
    peak_bps: float = float(metrics.peak_speed_bps or 0)

    def status_getter() -> str:
        return DownloadJob.objects.filter(pk=job_id).values_list("status", flat=True).first() or ""

    def progress_cb(done: int, total: int, _bps: float, speed_str: str, eta_str: str) -> None:
        nonlocal last_speed_bps, peak_bps
        if _bps and _bps > 0:
            last_speed_bps = float(_bps)
            peak_bps = max(peak_bps, _bps)
        if total and total > 0:
            pct = min(100, int(done * 100 / total))
        else:
            pct = 0
        DownloadJobMetrics.objects.filter(pk=metrics.pk).update(
            bytes_downloaded=done,
            bytes_total=total,
            progress_pct=pct,
            last_speed_str=speed_str,
            last_eta_str=eta_str,
            peak_speed_bps=peak_bps,
            last_heartbeat=timezone.now(),
        )
        _send_ws(
            job_id,
            {
                "type": "progress",
                "percent": pct,
                "progress_pct": pct,
                "speed": speed_str,
                "speed_str": speed_str,
                "eta": eta_str,
                "eta_str": eta_str,
                "bytes_downloaded": done,
                "expected_size": total,
            },
        )

    try:
        info = run_http_download(job, progress_callback=progress_cb, status_getter=status_getter)
        rel_path = info.get("filepath") or ""
        size = int(info.get("filesize") or 0)
        title = (info.get("title") or job.title)[:512]
        ctype = (info.get("content_type") or "")[:255]
        etag = (info.get("etag") or "")[:255]
        lm = (info.get("last_modified") or "")[:255]
        expected = int(info.get("expected_size") or size)
        completed = timezone.now()
        wall = 0
        if job.started_at:
            wall = max(0, int((completed - job.started_at).total_seconds()))

        DownloadJob.objects.filter(pk=job_id).update(
            status=DownloadJob.Status.DONE,
            title=title,
            platform="http",
            completed_at=completed,
        )
        DownloadJobMetrics.objects.filter(pk=metrics.pk).update(
            progress_pct=100,
            last_speed_str="",
            last_eta_str="",
            content_type=ctype,
            resume_etag=etag,
            resume_last_modified=lm,
            bytes_downloaded=size,
            bytes_total=expected,
            avg_speed_bps=last_speed_bps,
            peak_speed_bps=peak_bps,
            duration_seconds=wall,
            last_heartbeat=completed,
            partial_rel_path="",
        )
        if rel_path:
            fname = Path(rel_path).name
            exp = _expires_at_for_user(job.user)
            DownloadedFile.objects.update_or_create(
                job=job,
                user=job.user,
                file_path=rel_path,
                defaults={
                    "file_name": fname,
                    "mime_type": ctype,
                    "file_size_bytes": size,
                    "storage_backend": "local",
                    "is_deleted": False,
                    "expires_at": exp,
                },
            )
        job.refresh_from_db()
        _log_event(job, JobEvent.EventType.DONE, payload={"file_path": rel_path, "file_size": size})
        _send_ws(
            job_id,
            {
                "type": "done",
                "file_path": rel_path,
                "file_size": size,
                "title": job.title,
            },
        )

        from apps.integrations.telegram import maybe_auto_send

        maybe_auto_send(job)
    except PauseRequested:
        _send_ws(job_id, {"type": "paused"})
        return
    except Exception as exc:  # noqa: BLE001
        logger.exception("HTTP download failed for %s", job_id)
        if "cancelled" in str(exc).lower():
            DownloadJob.objects.filter(pk=job_id).update(
                status=DownloadJob.Status.CANCELLED,
                error_message="Cancelled",
            )
            _log_event(job, JobEvent.EventType.CANCELLED, message="Cancelled")
            _send_ws(job_id, {"type": "error", "message": "Cancelled"})
            return
        if "resume_not_supported" in str(exc):
            DownloadJob.objects.filter(pk=job_id).update(
                status=DownloadJob.Status.ERROR,
                error_message="Server did not honor resume; partial file removed. Start again.",
            )
            DownloadJobMetrics.objects.filter(job_id=job_id).update(
                partial_rel_path="",
                bytes_downloaded=0,
                resume_etag="",
            )
            _send_ws(job_id, {"type": "error", "message": str(exc)})
            return

        DownloadJob.objects.filter(pk=job_id).update(
            status=DownloadJob.Status.ERROR,
            error_message=str(exc)[:2000],
        )
        _log_event(job, JobEvent.EventType.ERROR, message=str(exc)[:500])
        _send_ws(job_id, {"type": "error", "message": str(exc)})


@shared_task
def cleanup_expired_download_files() -> int:
    """
    Remove on-disk files past ``expires_at`` or user retention (0 = disabled on file row).
    Rows are marked ``is_deleted``; job rows remain.
    """
    now = timezone.now()
    removed = 0
    qs = DownloadedFile.objects.filter(is_deleted=False, expires_at__isnull=False, expires_at__lte=now).select_related(
        "user",
        "job",
    )
    for f in qs.iterator(chunk_size=200):
        rel = (f.file_path or "").replace("\\", "/")
        if not rel or ".." in rel or rel.startswith("/"):
            DownloadedFile.objects.filter(pk=f.pk).update(is_deleted=True)
            removed += 1
            continue
        full = Path(settings.MEDIA_ROOT) / rel
        if full.is_file():
            try:
                full.unlink()
            except OSError:
                logger.exception("Could not delete file for DownloadedFile %s", f.pk)
        DownloadedFile.objects.filter(pk=f.pk).update(is_deleted=True)
        removed += 1
    return removed


@shared_task
def enqueue_download(job_id: str):
    job = DownloadJob.objects.filter(pk=job_id).only("engine").first()
    if not job:
        return
    if job.engine == ENGINE_HTTP:
        download_http_task.delay(job_id)
    else:
        download_video_task.delay(job_id)


@shared_task
def enqueue_playlist_jobs(playlist_id: str, entries: list[dict], fmt: str = "mp4", quality: str = "best"):
    """Create child jobs from playlist entries and enqueue each."""
    try:
        playlist = Playlist.objects.get(id=playlist_id)
    except Playlist.DoesNotExist:
        return

    base = DownloadJob.objects.filter(user=playlist.user).aggregate(m=Max("queue_order"))["m"] or 0

    for i, entry in enumerate(entries):
        url = entry["url"]
        title = (entry.get("title") or url)[:512]
        child = DownloadJob.objects.create(
            user=playlist.user,
            playlist=playlist,
            source_url=url,
            title=title,
            platform=entry.get("platform") or playlist.platform or "generic",
            format=fmt,
            quality=quality,
            engine=ENGINE_YTDLP,
            media_kind=DownloadJob.MediaKind.VIDEO,
            queue_order=base + i + 1,
        )
        download_video_task.delay(str(child.id))

    Playlist.objects.filter(pk=playlist.id).update(
        status=Playlist.Status.DONE,
        title=f"Playlist ({len(entries)} items)" if not playlist.title else playlist.title,
        total_count=len(entries),
    )
    # No single job WebSocket for playlist container; children have their own channels.
