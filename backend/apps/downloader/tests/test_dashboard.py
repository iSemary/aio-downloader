from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.downloader.models import DownloadJob

User = get_user_model()


class DownloadDashboardApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="dash@test.example",
            email="dash@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_dashboard_returns_sections(self):
        res = self.client.get("/api/downloads/dashboard/")
        self.assertEqual(res.status_code, 200)
        data = res.data
        self.assertIn("pulse", data)
        self.assertIn("health", data)
        self.assertIn("heatmap", data)
        self.assertIn("speed_histogram", data)
        self.assertIn("downloading_count", data["pulse"])
        self.assertIn("next_pending", data["pulse"])
        self.assertIn("disk", data["health"])

    def test_dashboard_pulse_counts(self):
        DownloadJob.objects.create(
            user=self.user,
            url="https://example.com/a",
            title="A",
            platform="youtube",
            status=DownloadJob.Status.PENDING,
        )
        DownloadJob.objects.create(
            user=self.user,
            url="https://example.com/b",
            title="B",
            platform="youtube",
            status=DownloadJob.Status.DOWNLOADING,
        )
        res = self.client.get("/api/downloads/dashboard/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["pulse"]["pending_count"], 1)
        self.assertEqual(res.data["pulse"]["downloading_count"], 1)

    def test_done_job_in_heatmap(self):
        now = timezone.now()
        DownloadJob.objects.create(
            user=self.user,
            url="https://example.com/done",
            title="Done",
            platform="youtube",
            status=DownloadJob.Status.DONE,
            file_size=1024,
            completed_at=now,
        )
        res = self.client.get("/api/downloads/dashboard/")
        self.assertEqual(res.status_code, 200)
        day = now.date().isoformat()
        heat = {h["date"]: h["count"] for h in res.data["heatmap"]}
        self.assertGreaterEqual(heat.get(day, 0), 1)

    def test_next_pending_is_first_in_queue_order(self):
        DownloadJob.objects.create(
            user=self.user,
            url="https://example.com/later",
            title="Later job",
            platform="youtube",
            status=DownloadJob.Status.PENDING,
            queue_order=5,
        )
        DownloadJob.objects.create(
            user=self.user,
            url="https://example.com/sooner",
            title="Sooner job",
            platform="tiktok",
            status=DownloadJob.Status.PENDING,
            queue_order=0,
        )
        res = self.client.get("/api/downloads/dashboard/")
        self.assertEqual(res.status_code, 200)
        np = res.data["pulse"]["next_pending"]
        self.assertIsNotNone(np)
        self.assertEqual(np["title"], "Sooner job")
        self.assertEqual(np["platform"], "tiktok")
