from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.downloader.models import DownloadJob
from apps.downloader.pagination import OptionalPageSizePagination
from apps.downloader.serializers import (
    DownloadJobCreateSerializer,
    DownloadJobSerializer,
    UrlAnalyzeSerializer,
)
from apps.downloader.tasks import download_video_task, enqueue_playlist_jobs
from apps.downloader.ytdlp_utils import analyze_url, probe_url


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
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return DownloadJobCreateSerializer
        return DownloadJobSerializer

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        url = ser.validated_data["url"]
        fmt = ser.validated_data.get("format") or "mp4"
        quality = ser.validated_data.get("quality") or "best"

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
            )
            enqueue_playlist_jobs.delay(str(parent.id), entries)
            return Response(DownloadJobSerializer(parent).data, status=status.HTTP_201_CREATED)

        e = entries[0]
        job = DownloadJob.objects.create(
            user=request.user,
            url=e["url"],
            title=(e.get("title") or probe.get("title") or "")[:512],
            platform=e.get("platform") or "generic",
            format=fmt,
            quality=quality,
        )
        download_video_task.delay(str(job.id))
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
        DownloadJob.objects.filter(pk=job.pk).update(
            status=DownloadJob.Status.PENDING,
            progress=0,
            error_message=None,
            speed="",
            eta="",
            file_path="",
            file_size=0,
            completed_at=None,
        )
        job.refresh_from_db()
        download_video_task.delay(str(job.id))
        return Response(DownloadJobSerializer(job).data)

    @action(detail=True, methods=["post"], url_path="pause")
    def pause(self, request, *args, **kwargs):
        return Response(
            {"detail": "Pause is not supported for yt-dlp downloads yet."},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


class DownloadUrlAnalyzeView(APIView):
    """Probe a URL with yt-dlp and return UI hints (platform, media kind, which controls to show)."""

    def post(self, request):
        ser = UrlAnalyzeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        payload = analyze_url(ser.validated_data["url"])
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
        return Response(list(qs))
