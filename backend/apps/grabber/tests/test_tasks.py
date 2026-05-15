from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.grabber.models import GrabberProject
from apps.grabber.tasks import cleanup_expired_grabber_files, cleanup_stale_crawls

User = get_user_model()


class CleanupTasksTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="cleanup@test.example",
            email="cleanup@test.example",
            password="secret12345",
        )

    @patch("apps.grabber.tasks.timezone")
    def test_cleanup_stale_crawls(self, mock_tz):
        from django.utils import timezone
        import datetime
        mock_tz.now.return_value = timezone.now()
        mock_tz.timedelta = datetime.timedelta

        GrabberProject.objects.create(
            user=self.user,
            name="Stale",
            start_url="https://example.com",
            status="crawling",
            started_at=timezone.now() - datetime.timedelta(hours=12),
        )
        GrabberProject.objects.create(
            user=self.user,
            name="Recent",
            start_url="https://example.com",
            status="crawling",
            started_at=timezone.now() - datetime.timedelta(hours=1),
        )

        cleanup_stale_crawls()
        self.assertEqual(GrabberProject.objects.filter(status="error").count(), 1)
        self.assertEqual(GrabberProject.objects.filter(status="crawling").count(), 1)

    def test_cleanup_expired_grabber_files(self):
        from django.utils import timezone
        import datetime
        from apps.grabber.models import GrabberCrawlTask, GrabberDiscoveredFile

        project = GrabberProject.objects.create(
            user=self.user,
            name="Cleanup Test",
            start_url="https://example.com",
        )
        task = GrabberCrawlTask.objects.create(project=project, url="https://example.com/p", depth=0)

        old = GrabberDiscoveredFile.objects.create(
            project=project, crawl_task=task,
            file_url="https://example.com/old.pdf", file_name="old.pdf",
            file_type="document", extension="pdf",
        )
        GrabberDiscoveredFile.objects.filter(id=old.id).update(
            created_at=timezone.now() - datetime.timedelta(days=31)
        )

        new = GrabberDiscoveredFile.objects.create(
            project=project, crawl_task=task,
            file_url="https://example.com/new.pdf", file_name="new.pdf",
            file_type="document", extension="pdf",
        )
        GrabberDiscoveredFile.objects.filter(id=new.id).update(
            created_at=timezone.now() - datetime.timedelta(days=1)
        )

        cleanup_expired_grabber_files()
        self.assertEqual(GrabberDiscoveredFile.objects.count(), 1)
        self.assertTrue(GrabberDiscoveredFile.objects.filter(id=new.id).exists())
