from pathlib import Path

from django.conf import settings
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.downloader.models import DownloadJob
from apps.integrations.crypto import decrypt_str
from apps.integrations.models import TelegramConfig
from apps.integrations.serializers import TelegramConfigSerializer
from apps.integrations.telegram import send_job_to_telegram, test_connection


class TelegramConfigView(generics.RetrieveUpdateAPIView):
    serializer_class = TelegramConfigSerializer

    def get_object(self):
        cfg, _ = TelegramConfig.objects.get_or_create(user=self.request.user)
        return cfg


class TelegramTestView(APIView):
    def post(self, request):
        cfg, _ = TelegramConfig.objects.get_or_create(user=request.user)
        if not cfg.bot_token_encrypted or not cfg.chat_id:
            return Response({"ok": False, "message": "Save bot token and chat id first."}, status=400)
        try:
            token = decrypt_str(cfg.bot_token_encrypted)
            test_connection(token, cfg.chat_id)
            return Response({"ok": True, "message": "Test message sent."})
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
        path = Path(settings.MEDIA_ROOT) / job.file_path
        if path.is_file() and path.stat().st_size > 50 * 1024 * 1024:
            return Response(
                {"detail": "File exceeds 50 MB Bot API limit.", "warning": True},
                status=400,
            )
        try:
            send_job_to_telegram(job, cfg)
            job.sent_to_telegram = True
            job.save(update_fields=["sent_to_telegram", "updated_at"])
            return Response({"sent": True})
        except Exception as exc:  # noqa: BLE001
            return Response({"detail": str(exc)}, status=400)
