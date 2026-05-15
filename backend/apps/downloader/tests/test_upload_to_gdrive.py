from django.test import TestCase
from django.contrib.auth import get_user_model

from apps.downloader.models import DownloadJob

User = get_user_model()


class DownloadJobUploadToGDriveTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="upload@test.example",
            username="upload@test.example",
            password="secret12345",
        )

    def test_upload_to_google_drive_default_false(self):
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/test.mp4",
            title="Test Video",
        )
        self.assertFalse(job.upload_to_google_drive)

    def test_upload_to_google_drive_can_be_set_to_true(self):
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/test.mp4",
            title="Test Video",
            upload_to_google_drive=True,
        )
        self.assertTrue(job.upload_to_google_drive)

    def test_upload_to_google_drive_can_be_updated(self):
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/test.mp4",
            title="Test Video",
        )
        self.assertFalse(job.upload_to_google_drive)
        
        job.upload_to_google_drive = True
        job.save()
        
        job.refresh_from_db()
        self.assertTrue(job.upload_to_google_drive)