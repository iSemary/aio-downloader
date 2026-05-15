from pathlib import Path

from django.conf import settings
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.downloader.models import DownloadJob, DownloadedFile
from apps.integrations.telegram import get_owner_bot_token, get_owner_telegram_config, send_job_to_telegram, test_connection

from apps.integrations.models import TelegramConfig
from apps.integrations.serializers import TelegramConfigSerializer


class TelegramConfigView(generics.RetrieveUpdateAPIView):
    serializer_class = TelegramConfigSerializer

    def get_object(self):
        cfg, _ = TelegramConfig.objects.get_or_create(user=self.request.user)
        return cfg


class TelegramTestView(APIView):
    def post(self, request):
        cfg, _ = TelegramConfig.objects.get_or_create(user=request.user)
        if not cfg.chat_id:
            return Response(
                {"ok": False, "message": "Save your receiver chat or channel ID first."},
                status=400,
            )
        try:
            token = get_owner_bot_token()
            owner_cfg = get_owner_telegram_config()
            test_connection(token, cfg.chat_id, owner_cfg)
            return Response({"ok": True, "message": "Test message sent."})
        except ValueError as exc:
            return Response({"ok": False, "message": str(exc)}, status=400)
        except Exception as exc:  # noqa: BLE001
            return Response({"ok": False, "message": str(exc)}, status=400)


class TelegramPushView(APIView):
    def post(self, request, job_id):
        try:
            job = DownloadJob.objects.get(id=job_id, user=request.user)
        except DownloadJob.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if job.status != DownloadJob.Status.DONE:
            return Response({"detail": "Job is not completed."}, status=400)
        cfg, _ = TelegramConfig.objects.get_or_create(user=request.user)
        if not cfg.enabled:
            return Response({"detail": "Telegram integration disabled."}, status=400)
        dfile = DownloadedFile.objects.filter(job=job, is_deleted=False).order_by("-created_at").first()
        if not dfile:
            return Response({"detail": "No downloaded file for this job."}, status=400)
        path = Path(settings.MEDIA_ROOT) / dfile.file_path
        if path.is_file() and path.stat().st_size > int(cfg.max_file_size_mb or 50) * 1024 * 1024:
            return Response(
                {"detail": f"File exceeds {cfg.max_file_size_mb} MB limit.", "warning": True},
                status=400,
            )
        try:
            send_job_to_telegram(job, cfg)
            return Response({"sent": True})
        except Exception as exc:  # noqa: BLE001
            return Response({"detail": str(exc)}, status=400)
