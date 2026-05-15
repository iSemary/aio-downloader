from datetime import date, datetime, time, timedelta
import shutil
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Exists, Max, OuterRef, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.downloader.classification import classify_download
from apps.downloader.models import DownloadJob
from apps.downloader.pagination import OptionalPageSizePagination
from apps.downloader.serializers import (
    DownloadBulkSerializer,
    DownloadJobCreateSerializer,
    DownloadJobSerializer,
    DownloadReorderSerializer,
    UrlAnalyzeSerializer,
)
from apps.downloader.tasks import enqueue_download, enqueue_playlist_jobs
from apps.downloader.ytdlp_utils import analyze_url, probe_url


def _next_queue_order(user) -> int:
    v = DownloadJob.objects.filter(user=user).aggregate(m=Max("queue_order"))["m"]
    return (v or 0) + 1


def _map_analysis_media_kind(analysis: dict) -> str:
    mk = (analysis.get("media_kind") or "generic").lower()
    mapping = {
        "video": DownloadJob.MediaKind.VIDEO,
        "audio": DownloadJob.MediaKind.AUDIO,
        "image": DownloadJob.MediaKind.IMAGE,
        "generic": DownloadJob.MediaKind.OTHER,
    }
    return mapping.get(mk, DownloadJob.MediaKind.OTHER)


class DownloadJobViewSet(viewsets.ModelViewSet):
    lookup_field = "id"
    lookup_value_regex = r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    http_method_names = ["get", "post", "delete", "head", "options"]
    pagination_class = OptionalPageSizePagination

    def get_queryset(self):
        qs = DownloadJob.objects.filter(user=self.request.user)
        st = self.request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)

        playlist_parent = self.request.query_params.get("playlist_parent")
        if playlist_parent:
            qs = qs.filter(playlist_parent_id=playlist_parent)

        roots_only = self.request.query_params.get("roots_only")
        if roots_only and str(roots_only).lower() in ("1", "true", "yes"):
            qs = qs.filter(playlist_parent__isnull=True)

        ppo = self.request.query_params.get("playlist_parents_only")
        if ppo and str(ppo).lower() in ("1", "true", "yes"):
            has_entry = DownloadJob.objects.filter(playlist_parent_id=OuterRef("pk"))
            qs = qs.filter(Exists(has_entry))

        sort = self.request.query_params.get("sort", "recent")
        if sort == "queue":
            return qs.order_by("queue_order", "-created_at")
        return qs.order_by("-created_at")

    def get_serializer_class(self):
        if self.action == "create":
            return DownloadJobCreateSerializer
        return DownloadJobSerializer

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        url = ser.validated_data["url"].strip()
        fmt = ser.validated_data.get("format") or "mp4"
        quality = ser.validated_data.get("quality") or "best"
        http_connections = int(ser.validated_data.get("http_connections") or 1)
        http_connections = max(1, min(8, http_connections))

        cf = classify_download(url)
        qo = _next_queue_order(request.user)

        if cf["engine"] == DownloadJob.Engine.HTTP:
            job = DownloadJob.objects.create(
                user=request.user,
                url=url,
                title=(cf.get("suggested_title") or url)[:512],
                platform="http",
                format=fmt,
                quality=quality,
                engine=DownloadJob.Engine.HTTP,
                media_kind=cf["media_kind"],
                http_connections=http_connections,
                queue_order=qo,
            )
            enqueue_download.delay(str(job.id))
            return Response(DownloadJobSerializer(job).data, status=status.HTTP_201_CREATED)

        probe = probe_url(url)
        entries = probe["entries"]

        if probe.get("is_playlist") and len(entries) > 1:
            parent = DownloadJob.objects.create(
                user=request.user,
                url=url,
                title=(probe.get("title") or "Playlist")[:512],
                platform=entries[0].get("platform") or "youtube",
                format=fmt,
                quality=quality,
                status=DownloadJob.Status.PROCESSING,
                engine=DownloadJob.Engine.YTDLP,
                media_kind=DownloadJob.MediaKind.VIDEO,
                queue_order=qo,
            )
            enqueue_playlist_jobs.delay(str(parent.id), entries)
            return Response(DownloadJobSerializer(parent).data, status=status.HTTP_201_CREATED)

        e = entries[0]
        entry_url = e["url"]
        entry_cf = classify_download(entry_url)
        analysis = analyze_url(entry_url)

        if entry_cf["engine"] == DownloadJob.Engine.HTTP:
            job = DownloadJob.objects.create(
                user=request.user,
                url=entry_url,
                title=(entry_cf.get("suggested_title") or e.get("title") or probe.get("title") or "")[:512],
                platform="http",
                format=fmt,
                quality=quality,
                engine=DownloadJob.Engine.HTTP,
                media_kind=entry_cf["media_kind"],
                http_connections=http_connections,
                queue_order=qo,
            )
            enqueue_download.delay(str(job.id))
            return Response(DownloadJobSerializer(job).data, status=status.HTTP_201_CREATED)

        job = DownloadJob.objects.create(
            user=request.user,
            url=entry_url,
            title=(e.get("title") or probe.get("title") or "")[:512],
            platform=e.get("platform") or "generic",
            format=fmt,
            quality=quality,
            engine=DownloadJob.Engine.YTDLP,
            media_kind=_map_analysis_media_kind(analysis),
            http_connections=http_connections,
            queue_order=qo,
        )
        enqueue_download.delay(str(job.id))
        return Response(DownloadJobSerializer(job).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        instance.status = DownloadJob.Status.CANCELLED
        instance.save(update_fields=["status", "updated_at"])
        if instance.celery_task_id:
            from celery.result import AsyncResult

            AsyncResult(instance.celery_task_id).revoke(terminate=True)

    @action(detail=True, methods=["post"], url_path="retry")
    def retry(self, request, *args, **kwargs):
        job = self.get_object()
        if job.status not in (DownloadJob.Status.ERROR, DownloadJob.Status.CANCELLED):
            return Response({"detail": "Only failed or cancelled jobs can be retried."}, status=400)
        if job.engine == DownloadJob.Engine.HTTP:
            pct = 0
            if job.expected_size and job.bytes_downloaded:
                pct = min(99, int(job.bytes_downloaded * 100 / job.expected_size))
            DownloadJob.objects.filter(pk=job.pk).update(
                status=DownloadJob.Status.PENDING,
                progress=pct,
                error_message=None,
                speed="",
                eta="",
                completed_at=None,
                avg_download_speed_bps=None,
            )
        else:
            DownloadJob.objects.filter(pk=job.pk).update(
                status=DownloadJob.Status.PENDING,
                progress=0,
                error_message=None,
                speed="",
                eta="",
                file_path="",
                file_size=0,
                bytes_downloaded=0,
                expected_size=0,
                completed_at=None,
                avg_download_speed_bps=None,
            )
        job.refresh_from_db()
        enqueue_download.delay(str(job.id))
        return Response(DownloadJobSerializer(job).data)

    @action(detail=True, methods=["post"], url_path="pause")
    def pause(self, request, *args, **kwargs):
        job = self.get_object()
        if job.engine != DownloadJob.Engine.HTTP:
            return Response(
                {"detail": "Pause is only supported for HTTP downloads."},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )
        if job.status != DownloadJob.Status.DOWNLOADING:
            return Response(
                {"detail": "Only an active download can be paused."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        DownloadJob.objects.filter(pk=job.pk).update(status=DownloadJob.Status.PAUSED)
        job.refresh_from_db()
        return Response(DownloadJobSerializer(job).data)

    @action(detail=True, methods=["post"], url_path="resume")
    def resume(self, request, *args, **kwargs):
        job = self.get_object()
        if job.engine != DownloadJob.Engine.HTTP:
            return Response(
                {"detail": "Resume is only supported for HTTP downloads."},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )
        if job.status != DownloadJob.Status.PAUSED:
            return Response(
                {"detail": "Only a paused HTTP download can be resumed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        DownloadJob.objects.filter(pk=job.pk).update(status=DownloadJob.Status.PENDING)
        job.refresh_from_db()
        enqueue_download.delay(str(job.id))
        return Response(DownloadJobSerializer(job).data)

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request, *args, **kwargs):
        ser = DownloadBulkSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        urls = ser.validated_data["urls"]
        fmt = ser.validated_data.get("format") or "mp4"
        quality = ser.validated_data.get("quality") or "best"
        http_connections = max(1, min(8, int(ser.validated_data.get("http_connections") or 1)))
        created = []
        errors: list[dict] = []
        for raw in urls:
            url = (raw or "").strip()
            if not url:
                errors.append({"url": raw, "detail": "empty"})
                continue
            fake = DownloadJobCreateSerializer(
                data={"url": url, "format": fmt, "quality": quality, "http_connections": http_connections}
            )
            if not fake.is_valid():
                errors.append({"url": url, "detail": fake.errors})
                continue
            try:
                cf = classify_download(url)
                qo = _next_queue_order(request.user)
                if cf["engine"] == DownloadJob.Engine.HTTP:
                    job = DownloadJob.objects.create(
                        user=request.user,
                        url=url,
                        title=(cf.get("suggested_title") or url)[:512],
                        platform="http",
                        format=fmt,
                        quality=quality,
                        engine=DownloadJob.Engine.HTTP,
                        media_kind=cf["media_kind"],
                        http_connections=http_connections,
                        queue_order=qo,
                    )
                    enqueue_download.delay(str(job.id))
                    created.append(DownloadJobSerializer(job).data)
                    continue
                probe = probe_url(url)
                entries = probe["entries"]
                if probe.get("is_playlist") and len(entries) > 1:
                    parent = DownloadJob.objects.create(
                        user=request.user,
                        url=url,
                        title=(probe.get("title") or "Playlist")[:512],
                        platform=entries[0].get("platform") or "youtube",
                        format=fmt,
                        quality=quality,
                        status=DownloadJob.Status.PROCESSING,
                        engine=DownloadJob.Engine.YTDLP,
                        media_kind=DownloadJob.MediaKind.VIDEO,
                        queue_order=qo,
                    )
                    enqueue_playlist_jobs.delay(str(parent.id), entries)
                    created.append(DownloadJobSerializer(parent).data)
                    continue
                e = entries[0]
                entry_url = e["url"]
                entry_cf = classify_download(entry_url)
                analysis = analyze_url(entry_url)
                if entry_cf["engine"] == DownloadJob.Engine.HTTP:
                    job = DownloadJob.objects.create(
                        user=request.user,
                        url=entry_url,
                        title=(entry_cf.get("suggested_title") or e.get("title") or probe.get("title") or "")[
                            :512
                        ],
                        platform="http",
                        format=fmt,
                        quality=quality,
                        engine=DownloadJob.Engine.HTTP,
                        media_kind=entry_cf["media_kind"],
                        http_connections=http_connections,
                        queue_order=qo,
                    )
                    enqueue_download.delay(str(job.id))
                    created.append(DownloadJobSerializer(job).data)
                    continue
                job = DownloadJob.objects.create(
                    user=request.user,
                    url=entry_url,
                    title=(e.get("title") or probe.get("title") or "")[:512],
                    platform=e.get("platform") or "generic",
                    format=fmt,
                    quality=quality,
                    engine=DownloadJob.Engine.YTDLP,
                    media_kind=_map_analysis_media_kind(analysis),
                    http_connections=http_connections,
                    queue_order=qo,
                )
                enqueue_download.delay(str(job.id))
                created.append(DownloadJobSerializer(job).data)
            except Exception as exc:  # noqa: BLE001
                errors.append({"url": url, "detail": str(exc)[:500]})
        return Response({"jobs": created, "errors": errors}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request, *args, **kwargs):
        ser = DownloadReorderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        order_ids = ser.validated_data["order"]
        unique = list(dict.fromkeys(order_ids))
        with transaction.atomic():
            qs = DownloadJob.objects.filter(user=request.user, id__in=unique)
            if qs.count() != len(unique):
                return Response({"detail": "One or more job ids are invalid."}, status=status.HTTP_400_BAD_REQUEST)
            for i, jid in enumerate(unique):
                DownloadJob.objects.filter(pk=jid, user=request.user).update(queue_order=i)
        return Response({"ok": True, "order": [str(x) for x in unique]})


class DownloadUrlAnalyzeView(APIView):
    """Probe a URL with yt-dlp and return UI hints (platform, media kind, which controls to show)."""

    def post(self, request):
        ser = UrlAnalyzeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        url = ser.validated_data["url"]
        payload = analyze_url(url)
        cf = classify_download(url)
        payload["engine"] = cf["engine"]
        payload["capabilities"] = cf["capabilities"]
        return Response(payload, status=status.HTTP_200_OK)


class DownloadStatsView(APIView):
    def get(self, request):
        qs = DownloadJob.objects.filter(user=request.user)
        total = qs.count()
        success = qs.filter(status=DownloadJob.Status.DONE).count()
        failed = qs.filter(status=DownloadJob.Status.ERROR).count()
        tg = qs.filter(sent_to_telegram=True).count()
        gb = (qs.filter(status=DownloadJob.Status.DONE).aggregate(s=Sum("file_size"))["s"] or 0) / (1024**3)
        return Response(
            {
                "urls_fetched": total,
                "successfully_downloaded": success,
                "sent_to_telegram": tg,
                "failed": failed,
                "gb_stored": round(gb, 3),
            }
        )


class DownloadTimeseriesView(APIView):
    def get(self, request):
        rng = request.query_params.get("range", "7d")
        now = timezone.now()
        if rng == "30d":
            start = now - timedelta(days=30)
        elif rng == "all":
            start = None
        else:
            start = now - timedelta(days=7)

        qs = DownloadJob.objects.filter(user=request.user)
        if start is not None:
            qs = qs.filter(created_at__gte=start)

        rows = (
            qs.annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(
                downloaded=Count("id", filter=Q(status=DownloadJob.Status.DONE)),
                sent_tg=Count("id", filter=Q(sent_to_telegram=True)),
                failed=Count("id", filter=Q(status=DownloadJob.Status.ERROR)),
            )
            .order_by("day")
        )
        return Response(list(rows))


class PlatformBreakdownView(APIView):
    def get(self, request):
        qs = (
            DownloadJob.objects.filter(user=request.user, status=DownloadJob.Status.DONE)
            .values("platform")
            .annotate(total_bytes=Sum("file_size"), count=Count("id"))
        )
        rows = []
        for row in qs:
            rows.append({**row, "bytes": row["total_bytes"]})
        return Response(rows)


def _norm_trunc_date(d) -> date | None:
    if d is None:
        return None
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, date):
        return d
    if isinstance(d, str):
        return date.fromisoformat(str(d)[:10])
    return None


class DownloadDashboardView(APIView):
    """Aggregated metrics for the redesigned dashboard (pulse, health, charts)."""

    def get(self, request):
        user = request.user
        now = timezone.now()
        tz = timezone.get_current_timezone()
        local_now = timezone.localtime(now, tz)
        local_date = local_now.date()
        today_start = timezone.make_aware(datetime.combine(local_date, time.min), tz)
        today_end = today_start + timedelta(days=1)

        qs = DownloadJob.objects.filter(user=user)

        downloading_count = qs.filter(
            status__in=(DownloadJob.Status.DOWNLOADING, DownloadJob.Status.PROCESSING)
        ).count()
        pending_count = qs.filter(status=DownloadJob.Status.PENDING).count()

        next_row = (
            qs.filter(status=DownloadJob.Status.PENDING)
            .order_by("queue_order", "-created_at")
            .values("id", "title", "platform")
            .first()
        )
        next_pending = None
        if next_row:
            next_pending = {
                "id": str(next_row["id"]),
                "title": (next_row.get("title") or "")[:200],
                "platform": (next_row.get("platform") or "")[:64] or "generic",
            }

        done_recent = list(
            qs.filter(status=DownloadJob.Status.DONE, completed_at__isnull=False)
            .order_by("-completed_at")[:50]
            .values_list("completed_at", "created_at")
        )
        queue_clear_eta_seconds = None
        if done_recent and pending_count:
            acc = sum(max(0.0, (ca - cr).total_seconds()) for ca, cr in done_recent)
            avg_secs = acc / len(done_recent)
            queue_clear_eta_seconds = int(pending_count * avg_secs)

        today_qs = qs.filter(
            status=DownloadJob.Status.DONE,
            completed_at__gte=today_start,
            completed_at__lt=today_end,
        )
        today_files = today_qs.count()
        today_bytes = today_qs.aggregate(s=Sum("file_size"))["s"] or 0

        telegram_pending = qs.filter(status=DownloadJob.Status.DONE, sent_to_telegram=False).count()
        telegram_sent_today = qs.filter(
            sent_to_telegram=True,
            telegram_sent_at__gte=today_start,
            telegram_sent_at__lt=today_end,
        ).count()

        seven_start = now - timedelta(days=7)
        done_7 = qs.filter(status=DownloadJob.Status.DONE, completed_at__gte=seven_start).count()
        err_7 = qs.filter(status=DownloadJob.Status.ERROR, updated_at__gte=seven_start).count()
        denom = done_7 + err_7
        success_rate_7d = (done_7 / denom) if denom else 1.0

        success_rate_series_7d = []
        for offset in range(7):
            d = local_date - timedelta(days=6 - offset)
            ds = timezone.make_aware(datetime.combine(d, time.min), tz)
            de = ds + timedelta(days=1)
            dn = qs.filter(status=DownloadJob.Status.DONE, completed_at__gte=ds, completed_at__lt=de).count()
            en = qs.filter(status=DownloadJob.Status.ERROR, updated_at__gte=ds, updated_at__lt=de).count()
            tot = dn + en
            success_rate_series_7d.append(
                {
                    "day": d.isoformat(),
                    "rate": (dn / tot) if tot else None,
                    "done": dn,
                    "failed": en,
                }
            )

        root = Path(settings.MEDIA_ROOT).resolve()
        try:
            du = shutil.disk_usage(str(root))
            disk = {"used_bytes": du.used, "total_bytes": du.total, "free_bytes": du.free}
        except OSError:
            disk = {"used_bytes": 0, "total_bytes": 0, "free_bytes": 0}

        largest = (
            qs.filter(status=DownloadJob.Status.DONE, file_size__gt=0)
            .order_by("-file_size")
            .values("id", "title", "file_size", "platform")
            .first()
        )

        platforms = [
            {**row, "bytes": row["total_bytes"]}
            for row in (
                DownloadJob.objects.filter(user=user, status=DownloadJob.Status.DONE)
                .values("platform")
                .annotate(total_bytes=Sum("file_size"), count=Count("id"))
            )
        ]

        heat_start_date = local_date - timedelta(days=370)
        heat_start_aware = timezone.make_aware(datetime.combine(heat_start_date, time.min), tz)
        heat_rows = (
            qs.filter(status=DownloadJob.Status.DONE, completed_at__gte=heat_start_aware)
            .annotate(day=TruncDate("completed_at", tzinfo=tz))
            .values("day")
            .annotate(count=Count("id"))
        )
        counts_by_day: dict[date, int] = {}
        for r in heat_rows:
            dk = _norm_trunc_date(r["day"])
            if dk:
                counts_by_day[dk] = r["count"]

        heatmap = []
        cur = heat_start_date
        end_h = local_date
        while cur <= end_h:
            heatmap.append({"date": cur.isoformat(), "count": counts_by_day.get(cur, 0)})
            cur += timedelta(days=1)

        thirty = now - timedelta(days=30)
        speeds = list(
            qs.filter(
                status=DownloadJob.Status.DONE,
                completed_at__gte=thirty,
                avg_download_speed_bps__isnull=False,
            ).values_list("avg_download_speed_bps", flat=True)
        )
        edges = [
            (0, 256 * 1024, "<256 KB/s"),
            (256 * 1024, 512 * 1024, "256–512 KB/s"),
            (512 * 1024, 1024 * 1024, "512 KB/s–1 MB/s"),
            (1024 * 1024, 2 * 1024 * 1024, "1–2 MB/s"),
            (2 * 1024 * 1024, 5 * 1024 * 1024, "2–5 MB/s"),
            (5 * 1024 * 1024, 10 * 1024 * 1024, "5–10 MB/s"),
            (10 * 1024 * 1024, 25 * 1024 * 1024, "10–25 MB/s"),
            (25 * 1024 * 1024, float("inf"), "25+ MB/s"),
        ]
        hist_counts = [0] * len(edges)
        for bps in speeds:
            if bps is None or bps < 0:
                continue
            placed = False
            for i, (lo, hi, _) in enumerate(edges):
                if lo <= bps < hi:
                    hist_counts[i] += 1
                    placed = True
                    break
            if not placed and bps >= edges[-1][0]:
                hist_counts[-1] += 1

        speed_histogram = []
        for i, (lo, hi, lbl) in enumerate(edges):
            speed_histogram.append(
                {
                    "label": lbl,
                    "count": hist_counts[i],
                    "min_bps": lo,
                    "max_bps": None if hi == float("inf") else hi,
                }
            )

        return Response(
            {
                "pulse": {
                    "downloading_count": downloading_count,
                    "pending_count": pending_count,
                    "next_pending": next_pending,
                    "queue_clear_eta_seconds": queue_clear_eta_seconds,
                    "today": {
                        "files": today_files,
                        "bytes": today_bytes,
                        "telegram_pending": telegram_pending,
                        "telegram_sent_today": telegram_sent_today,
                    },
                },
                "health": {
                    "success_rate_7d": round(success_rate_7d, 4),
                    "success_rate_series_7d": success_rate_series_7d,
                    "disk": disk,
                },
                "largest": largest,
                "platforms": platforms,
                "heatmap": heatmap,
                "speed_histogram": speed_histogram,
            }
        )
