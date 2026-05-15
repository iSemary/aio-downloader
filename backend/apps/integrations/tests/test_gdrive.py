from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.downloader.models import DownloadJob
from apps.integrations.models import GoogleDriveConfig

User = get_user_model()


class GoogleDriveConfigViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="gdrive@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_get_gdrive_config_unauthenticated(self):
        client = APIClient()
        res = client.get("/api/integrations/gdrive/")
        self.assertEqual(res.status_code, 401)

    def test_get_gdrive_config_not_set(self):
        res = self.client.get("/api/integrations/gdrive/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("enabled", res.data)
        self.assertIn("connected", res.data)
        self.assertEqual(res.data["enabled"], False)
        self.assertEqual(res.data["connected"], False)

    def test_update_gdrive_config(self):
        res = self.client.patch(
            "/api/integrations/gdrive/",
            {
                "enabled": True,
                "auto_upload": True,
                "root_folder_id": "test_folder_id",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["enabled"], True)
        self.assertEqual(res.data["auto_upload"], True)
        self.assertEqual(res.data["root_folder_id"], "test_folder_id")

    def test_gdrive_config_does_not_return_credentials(self):
        res = self.client.get("/api/integrations/gdrive/")
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("credentials_encrypted", res.data)


class GoogleDriveAuthViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="auth@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @patch("apps.integrations.views.get_authorization_url")
    def test_auth_url_success(self, mock_get_auth_url):
        mock_get_auth_url.return_value = ("https://accounts.google.com/o/oauth2/auth?test", "test_state")
        res = self.client.get("/api/integrations/gdrive/auth/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("auth_url", res.data)
        self.assertIn("state", res.data)
        self.assertEqual(res.data["state"], "test_state")


class GoogleDriveCallbackViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="callback@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @patch("apps.integrations.views.exchange_code")
    def test_callback_success(self, mock_exchange_code):
        mock_exchange_code.return_value = None
        res = self.client.post(
            "/api/integrations/gdrive/callback/",
            {"code": "test_code", "state": "test_state"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["ok"], True)

    def test_callback_missing_code(self):
        res = self.client.post(
            "/api/integrations/gdrive/callback/",
            {"state": "test_state"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["detail"], "Missing code")


class GoogleDriveTestViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="test@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @patch("apps.integrations.views.gdrive_test_connection")
    def test_test_connection_success(self, mock_test_connection):
        mock_test_connection.return_value = "test@example.com"
        res = self.client.post("/api/integrations/gdrive/test/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["ok"], True)
        self.assertIn("Connected as", res.data["message"])

    @patch("apps.integrations.views.gdrive_test_connection")
    def test_test_connection_failure(self, mock_test_connection):
        mock_test_connection.side_effect = Exception("Test error")
        res = self.client.post("/api/integrations/gdrive/test/")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["ok"], False)
        self.assertEqual(res.data["message"], "Test error")

    def test_test_connection_not_connected(self):
        res = self.client.post("/api/integrations/gdrive/test/")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["ok"], False)
        self.assertEqual(res.data["message"], "Google Drive not connected.")


class GoogleDriveModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="model@test.example",
            password="secret12345",
        )

    def test_google_drive_config_creation(self):
        config = GoogleDriveConfig.objects.create(
            user=self.user,
            enabled=True,
            auto_upload=True,
            root_folder_id="test_folder",
        )
        self.assertEqual(config.user, self.user)
        self.assertEqual(config.enabled, True)
        self.assertEqual(config.auto_upload, True)
        self.assertEqual(config.root_folder_id, "test_folder")

    def test_google_drive_config_str(self):
        config = GoogleDriveConfig.objects.create(user=self.user)
        self.assertEqual(str(config), f"GoogleDriveConfig({self.user.id})")


class GoogleDriveIntegrationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="integration@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        from apps.integrations.gdrive import get_user_config
        from apps.integrations.models import GoogleDriveConfig

    @patch("apps.integrations.gdrive.build_credentials")
    @patch("apps.integrations.gdrive.get_user_config")
    def test_maybe_auto_upload_disabled(self, mock_get_user_config, mock_build_credentials):
        # Test when Google Drive is disabled
        mock_get_user_config.return_value = None
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/test.mp4",
            title="Test Video",
        )
        from apps.integrations.gdrive import maybe_auto_upload
        maybe_auto_upload(job)  # Should not raise exception
        mock_get_user_config.assert_called_once_with(self.user)
        mock_build_credentials.assert_not_called()

    @patch("apps.integrations.gdrive.build_credentials")
    @patch("apps.integrations.gdrive.get_user_config")
    @patch("apps.integrations.gdrive.upload_file")
    def test_maybe_auto_upload_enabled(self, mock_upload_file, mock_get_user_config, mock_build_credentials):
        # Test when Google Drive is enabled and configured
        mock_config = MagicMock()
        mock_config.enabled = True
        mock_config.auto_upload = True
        mock_get_user_config.return_value = mock_config
        mock_build_credentials.return_value = None
        
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/test.mp4",
            title="Test Video",
        )
        
        # Mock DownloadedFile
        with patch("apps.integrations.gdrive.DownloadedFile") as mock_dfile_class:
            mock_dfile = MagicMock()
            mock_dfile.file_path = "test/path/file.mp4"
            mock_dfile_class.objects.filter.return_value.order_by.return_value.first.return_value = mock_dfile
            
            from apps.integrations.gdrive import maybe_auto_upload
            maybe_auto_upload(job)
            
            mock_get_user_config.assert_called_once_with(self.user)
            mock_build_credentials.assert_called_once_with(self.user)
            mock_upload_file.assert_called_once()


class TelegramFailureNotificationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="notify@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @patch("apps.integrations.telegram.get_owner_bot_token")
    @patch("apps.integrations.telegram.get_owner_telegram_config")
    @patch("apps.integrations.telegram._run")
    def test_send_failure_alert_enabled(self, mock_run, mock_owner_cfg, mock_bot_token):
        # Test when failure notifications are enabled
        from apps.auth_app.models import UserPreferences
        prefs = UserPreferences.objects.create(user=self.user, notify_on_failure=True)
        
        mock_bot_token.return_value = "test_token"
        mock_owner_cfg.return_value = MagicMock()
        
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/test.mp4",
            title="Test Video",
            error_message="Test error",
        )
        
        from apps.integrations.telegram import send_failure_alert
        send_failure_alert(job)
        
        mock_run.assert_called_once()

    @patch("apps.integrations.telegram.get_owner_bot_token")
    @patch("apps.integrations.telegram.get_owner_telegram_config")
    @patch("apps.integrations.telegram._run")
    def test_send_failure_alert_disabled(self, mock_run, mock_owner_cfg, mock_bot_token):
        # Test when failure notifications are disabled
        from apps.auth_app.models import UserPreferences
        prefs = UserPreferences.objects.create(user=self.user, notify_on_failure=False)
        
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/test.mp4",
            title="Test Video",
            error_message="Test error",
        )
        
        from apps.integrations.telegram import send_failure_alert
        send_failure_alert(job)
        
        mock_run.assert_not_called()