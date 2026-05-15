from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.downloader.models import DownloadJob

User = get_user_model()


class TelegramConfigViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="telegram@test.example",
            email="telegram@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_get_telegram_config_unauthenticated(self):
        client = APIClient()
        res = client.get("/api/integrations/telegram/")
        self.assertEqual(res.status_code, 401)

    def test_get_telegram_config_not_set(self):
        res = self.client.get("/api/integrations/telegram/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("enabled", res.data)
        self.assertIn("chat_id", res.data)
        self.assertEqual(res.data.get("chat_id"), "")

    def test_update_telegram_config(self):
        res = self.client.patch(
            "/api/integrations/telegram/",
            {
                "chat_id": "-1001234567890",
                "auto_send": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)

    def test_update_telegram_enabled(self):
        res = self.client.patch(
            "/api/integrations/telegram/",
            {"enabled": True},
            format="json",
        )
        self.assertEqual(res.status_code, 200)

    def test_telegram_config_does_not_return_token(self):
        res = self.client.get("/api/integrations/telegram/")
        self.assertEqual(res.status_code, 200)
        if "bot_token" in res.data:
            self.assertIsNone(res.data["bot_token"])


class TelegramTestViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="test@telegram.test",
            email="test@telegram.test",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @patch("apps.integrations.views.send_telegram_message")
    def test_test_telegram_success(self, mock_send):
        mock_send.return_value = True
        res = self.client.post("/api/integrations/telegram/test/")
        self.assertEqual(res.status_code, 200)

    @patch("apps.integrations.views.send_telegram_message")
    def test_test_telegram_failure(self, mock_send):
        mock_send.return_value = False
        res = self.client.post("/api/integrations/telegram/test/")
        self.assertEqual(res.status_code, 400)

    def test_test_telegram_unauthenticated(self):
        client = APIClient()
        res = client.post("/api/integrations/telegram/test/")
        self.assertEqual(res.status_code, 401)


class TelegramPushViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="push@telegram.test",
            email="push@telegram.test",
            password="secret12345",
        )
        self.other_user = User.objects.create_user(
            username="other@telegram.test",
            email="other@telegram.test",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @patch("apps.integrations.views.push_to_telegram")
    def test_push_success(self, mock_push):
        mock_push.return_value = True
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/test.mp4",
            title="Test Video",
            platform="http",
            status=DownloadJob.Status.DONE,
            file_path="http/test.mp4",
            file_size_bytes=1024,
        )
        res = self.client.post(f"/api/integrations/telegram/push/{job.id}/")
        self.assertEqual(res.status_code, 200)

    @patch("apps.integrations.views.push_to_telegram")
    def test_push_failure(self, mock_push):
        mock_push.return_value = False
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/test.mp4",
            title="Test Video",
            platform="http",
            status=DownloadJob.Status.DONE,
            file_path="http/test.mp4",
            file_size_bytes=1024,
        )
        res = self.client.post(f"/api/integrations/telegram/push/{job.id}/")
        self.assertEqual(res.status_code, 400)

    def test_push_nonexistent_job(self):
        res = self.client.post(
            "/api/integrations/telegram/push/00000000-0000-0000-0000-000000000000/"
        )
        self.assertEqual(res.status_code, 404)

    def test_push_other_user_job(self):
        job = DownloadJob.objects.create(
            user=self.other_user,
            source_url="https://example.com/other.mp4",
            title="Other Video",
            platform="http",
            status=DownloadJob.Status.DONE,
            file_path="http/other.mp4",
            file_size_bytes=1024,
        )
        res = self.client.post(f"/api/integrations/telegram/push/{job.id}/")
        self.assertEqual(res.status_code, 404)

    def test_push_incomplete_job(self):
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/pending.mp4",
            title="Pending Video",
            platform="http",
            status=DownloadJob.Status.PENDING,
        )
        res = self.client.post(f"/api/integrations/telegram/push/{job.id}/")
        self.assertEqual(res.status_code, 400)

    def test_push_unauthenticated(self):
        client = APIClient()
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/test.mp4",
            title="Test",
            platform="http",
            status=DownloadJob.Status.DONE,
            file_path="http/test.mp4",
        )
        res = client.post(f"/api/integrations/telegram/push/{job.id}/")
        self.assertEqual(res.status_code, 401)


class TelegramIntegrationSecurityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="secure@telegram.test",
            email="secure@telegram.test",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_cannot_access_other_user_config(self):
        other_user = User.objects.create_user(
            username="other@telegram.test",
            email="other@telegram.test",
            password="secret12345",
        )
        from apps.integrations.models import TelegramConfig
        TelegramConfig.objects.create(user=other_user, chat_id="-1001234567890", enabled=True)

        res = self.client.get("/api/integrations/telegram/")
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data.get("chat_id"))

    def test_cannot_push_without_permission(self):
        other_user = User.objects.create_user(
            username="other2@telegram.test",
            email="other2@telegram.test",
            password="secret12345",
        )
        job = DownloadJob.objects.create(
            user=other_user,
            source_url="https://example.com/other.mp4",
            title="Other",
            platform="http",
            status=DownloadJob.Status.DONE,
        )
        res = self.client.post(f"/api/integrations/telegram/push/{job.id}/")
        self.assertEqual(res.status_code, 404)