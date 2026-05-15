from datetime import timedelta
import logging
from pathlib import Path

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.conf import settings
from django.utils import timezone

from apps.downloader.models import DownloadJob
from apps.downloader.ytdlp_utils import run_download

logger = logging.getLogger(__name__)


def _send_ws(job_id, payload: dict) -> None:
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"download_{job_id}",
        {"type": "download.event", "payload": payload},
    )


@shared_task(bind=True)
def download_video_task(self, job_id: str):
    try:
        job = DownloadJob.objects.select_related("user").get(id=job_id)
    except DownloadJob.DoesNotExist:
        return

    if job.status == DownloadJob.Status.CANCELLED:
        return

    job.status = DownloadJob.Status.DOWNLOADING
    job.celery_task_id = self.request.id or ""
    job.save(update_fields=["status", "celery_task_id", "updated_at"])

    def progress_hook(d: dict) -> None:
        job.refresh_from_db(fields=["status"])
        if job.status == DownloadJob.Status.CANCELLED:
            raise RuntimeError("cancelled")

        if d.get("status") == "downloading":
            raw = d.get("_percent_str") or "0%"
            try:
                pct = int(float(raw.strip().rstrip("%")))
            except ValueError:
                pct = job.progress
            speed = d.get("_speed_str") or ""
            eta = d.get("_eta_str") or ""
            DownloadJob.objects.filter(pk=job.id).update(
                progress=pct,
                speed=speed,
                eta=eta,
            )
            _send_ws(
                str(job.id),
                {"type": "progress", "percent": pct, "speed": speed, "eta": eta},
            )

    try:
        info = run_download(job, progress_hook)
        rel_path = info.get("filepath") or ""
        size = int(info.get("filesize") or 0)
        title = info.get("title") or job.title
        platform = info.get("platform") or job.platform
        DownloadJob.objects.filter(pk=job.id).update(
            status=DownloadJob.Status.DONE,
            progress=100,
            file_path=rel_path,
            file_size=size,
            title=title[:512],
            platform=platform[:64],
            speed="",
            eta="",
            completed_at=timezone.now(),
        )
        job.refresh_from_db()
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
            DownloadJob.objects.filter(pk=job.id).update(
                status=DownloadJob.Status.CANCELLED,
                error_message="Cancelled",
            )
            _send_ws(str(job.id), {"type": "error", "message": "Cancelled"})
            return

        DownloadJob.objects.filter(pk=job.id).update(
            status=DownloadJob.Status.ERROR,
            error_message=str(exc)[:2000],
        )
        _send_ws(str(job.id), {"type": "error", "message": str(exc)})


@shared_task
def cleanup_expired_download_files() -> int:
    """
    Remove on-disk files past each user's ``storage_retention_days`` (0 = disabled).
    ``DownloadJob`` rows stay; ``file_path`` / ``file_size`` are cleared.
    """
    now = timezone.now()
    removed = 0
    qs = (
        DownloadJob.objects.filter(status=DownloadJob.Status.DONE)
        .exclude(file_path="")
        .select_related("user")
    )
    for job in qs.iterator(chunk_size=200):
        days = job.user.storage_retention_days
        if days == 0:
            continue
        ref = job.completed_at or job.created_at
        if ref > now - timedelta(days=days):
            continue
        rel = (job.file_path or "").replace("\\", "/")
        if not rel or ".." in rel or rel.startswith("/"):
            DownloadJob.objects.filter(pk=job.pk).update(file_path="", file_size=0)
            removed += 1
            continue
        full = Path(settings.MEDIA_ROOT) / rel
        if full.is_file():
            try:
                full.unlink()
            except OSError:
                logger.exception("Could not delete file for job %s", job.pk)
        DownloadJob.objects.filter(pk=job.pk).update(file_path="", file_size=0)
        removed += 1
    return removed


@shared_task
def enqueue_download(job_id: str):
    download_video_task.delay(job_id)


@shared_task
def enqueue_playlist_jobs(parent_job_id: str, entries: list[dict]):
    """Create child jobs from playlist entries and enqueue each."""
    try:
        parent = DownloadJob.objects.get(id=parent_job_id)
    except DownloadJob.DoesNotExist:
        return

    for entry in entries:
        url = entry["url"]
        title = (entry.get("title") or url)[:512]
        child = DownloadJob.objects.create(
            user=parent.user,
            url=url,
            title=title,
            platform=entry.get("platform") or parent.platform,
            format=parent.format,
            quality=parent.quality,
            playlist_parent=parent,
        )
        download_video_task.delay(str(child.id))

    DownloadJob.objects.filter(pk=parent.id).update(
        status=DownloadJob.Status.DONE,
        title=f"Playlist ({len(entries)} items)",
        progress=100,
    )
    _send_ws(
        str(parent.id),
        {"type": "playlist_enqueued", "count": len(entries)},
    )
