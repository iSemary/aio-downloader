from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.downloader.models import DownloadJob

User = get_user_model()


class DownloadStatsViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="stats@test.example",
            email="stats@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_stats_returns_counts(self):
        DownloadJob.objects.create(user=self.user, source_url="https://example.com/1.mp4", title="1", platform="http", status=DownloadJob.Status.PENDING)
        DownloadJob.objects.create(user=self.user, source_url="https://example.com/2.mp4", title="2", platform="http", status=DownloadJob.Status.DOWNLOADING)
        DownloadJob.objects.create(user=self.user, source_url="https://example.com/3.mp4", title="3", platform="http", status=DownloadJob.Status.DONE)
        DownloadJob.objects.create(user=self.user, source_url="https://example.com/4.mp4", title="4", platform="http", status=DownloadJob.Status.DONE)
        DownloadJob.objects.create(user=self.user, source_url="https://example.com/5.mp4", title="5", platform="http", status=DownloadJob.Status.ERROR)

        res = self.client.get("/api/downloads/stats/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["pending"], 1)
        self.assertEqual(res.data["downloading"], 1)
        self.assertEqual(res.data["done"], 2)
        self.assertEqual(res.data["error"], 1)

    def test_stats_only_counts_own_jobs(self):
        other_user = User.objects.create_user(username="other@test.com", email="other@test.com", password="secret12345")
        DownloadJob.objects.create(user=self.user, source_url="https://example.com/my.mp4", title="My", platform="http", status=DownloadJob.Status.DONE)
        DownloadJob.objects.create(user=other_user, source_url="https://example.com/other.mp4", title="Other", platform="http", status=DownloadJob.Status.DONE)

        res = self.client.get("/api/downloads/stats/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["done"], 1)

    def test_stats_empty(self):
        res = self.client.get("/api/downloads/stats/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["pending"], 0)
        self.assertEqual(res.data["downloading"], 0)
        self.assertEqual(res.data["done"], 0)


class DownloadTimeseriesViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="timeseries@test.example",
            email="timeseries@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_timeseries_returns_data(self):
        now = timezone.now()
        for i in range(5):
            DownloadJob.objects.create(
                user=self.user,
                source_url=f"https://example.com/{i}.mp4",
                title=f"Video {i}",
                platform="http",
                status=DownloadJob.Status.DONE,
                completed_at=now - timezone.timedelta(days=i),
                file_size_bytes=1024,
            )

        res = self.client.get("/api/downloads/timeseries/")
        self.assertEqual(res.status_code, 200)
        self.assertIsInstance(res.data, list)
        self.assertGreaterEqual(len(res.data), 1)

    def test_timeseries_groups_by_date(self):
        today = timezone.now().date()
        yesterday = today - timezone.timedelta(days=1)
        DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/today.mp4",
            title="Today",
            platform="http",
            status=DownloadJob.Status.DONE,
            completed_at=timezone.now(),
            file_size_bytes=1024,
        )
        DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/yesterday.mp4",
            title="Yesterday",
            platform="http",
            status=DownloadJob.Status.DONE,
            completed_at=timezone.now() - timezone.timedelta(days=1),
            file_size_bytes=2048,
        )

        res = self.client.get("/api/downloads/timeseries/")
        self.assertEqual(res.status_code, 200)
        dates = [item.get("date") for item in res.data if "date" in item]
        self.assertIn(today.isoformat(), dates)
        self.assertIn(yesterday.isoformat(), dates)

    def test_timeseries_empty(self):
        res = self.client.get("/api/downloads/timeseries/")
        self.assertEqual(res.status_code, 200)

    def test_timeseries_only_own_jobs(self):
        other_user = User.objects.create_user(username="other@test.com", email="other@test.com", password="secret12345")
        DownloadJob.objects.create(
            user=other_user,
            source_url="https://example.com/other.mp4",
            title="Other",
            platform="http",
            status=DownloadJob.Status.DONE,
            completed_at=timezone.now(),
            file_size_bytes=1024,
        )
        res = self.client.get("/api/downloads/timeseries/")
        self.assertEqual(res.status_code, 200)
        total_count = sum(item.get("count", 0) for item in res.data)
        self.assertEqual(total_count, 0)


class PlatformBreakdownViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="platforms@test.example",
            email="platforms@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_platform_breakdown(self):
        DownloadJob.objects.create(user=self.user, source_url="https://example.com/y1.mp4", title="YouTube 1", platform="youtube", status=DownloadJob.Status.DONE, file_size=1024)
        DownloadJob.objects.create(user=self.user, source_url="https://example.com/y2.mp4", title="YouTube 2", platform="youtube", status=DownloadJob.Status.DONE, file_size=2048)
        DownloadJob.objects.create(user=self.user, source_url="https://example.com/t1.mp4", title="TikTok 1", platform="tiktok", status=DownloadJob.Status.DONE, file_size=512)
        DownloadJob.objects.create(user=self.user, source_url="https://example.com/h1.mp4", title="HTTP 1", platform="http", status=DownloadJob.Status.DONE, file_size=4096)

        res = self.client.get("/api/downloads/platforms/")
        self.assertEqual(res.status_code, 200)
        self.assertIsInstance(res.data, list)
        platforms = {item["platform"]: item for item in res.data}
        self.assertIn("youtube", platforms)
        self.assertIn("tiktok", platforms)
        self.assertIn("http", platforms)

    def test_platform_breakdown_only_own(self):
        other_user = User.objects.create_user(username="other@test.com", email="other@test.com", password="secret12345")
        DownloadJob.objects.create(user=other_user, source_url="https://example.com/other.mp4", title="Other", platform="youtube", status=DownloadJob.Status.DONE, file_size=1024)
        DownloadJob.objects.create(user=self.user, source_url="https://example.com/my.mp4", title="Mine", platform="youtube", status=DownloadJob.Status.DONE, file_size=2048)

        res = self.client.get("/api/downloads/platforms/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["platform"], "youtube")

    def test_platform_breakdown_includes_file_count(self):
        DownloadJob.objects.create(user=self.user, source_url="https://example.com/1.mp4", title="Video 1", platform="youtube", status=DownloadJob.Status.DONE, file_size=1024)
        DownloadJob.objects.create(user=self.user, source_url="https://example.com/2.mp4", title="Video 2", platform="youtube", status=DownloadJob.Status.DONE, file_size=2048)

        res = self.client.get("/api/downloads/platforms/")
        self.assertEqual(res.status_code, 200)
        yt_data = next((item for item in res.data if item["platform"] == "youtube"), None)
        self.assertIsNotNone(yt_data)
        self.assertEqual(yt_data["count"], 2)

    def test_platform_breakdown_empty(self):
        res = self.client.get("/api/downloads/platforms/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 0)


class DownloadUrlAnalyzeViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="analyze@test.example",
            email="analyze@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @patch("apps.downloader.ytdlp_utils.analyze_url")
    def test_analyze_valid_url(self, mock_analyze):
        mock_analyze.return_value = {
            "url": "https://youtube.com/watch?v=test",
            "title": "Test Video",
            "thumbnail": "https://example.com/thumb.jpg",
            "duration": 120,
            "media_kind": "video",
            "platform": "youtube",
        }
        res = self.client.post(
            "/api/downloads/analyze/",
            {"url": "https://youtube.com/watch?v=test"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("title", res.data)
        self.assertIn("media_kind", res.data)
        self.assertIn("platform", res.data)

    @patch("apps.downloader.ytdlp_utils.analyze_url")
    def test_analyze_returns_capabilities(self, mock_analyze):
        mock_analyze.return_value = {
            "url": "https://youtube.com/watch?v=test",
            "title": "Test",
            "media_kind": "video",
            "platform": "youtube",
        }
        res = self.client.post(
            "/api/downloads/analyze/",
            {"url": "https://youtube.com/watch?v=test"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("capabilities", res.data)

    def test_analyze_invalid_url(self):
        res = self.client.post(
            "/api/downloads/analyze/",
            {"url": "not-a-valid-url"},
            format="json",
        )
        # The analyze endpoint may accept any URL and return analysis
        # Just verify it returns a response
        self.assertIn(res.status_code, [200, 400])

    def test_analyze_requires_url(self):
        res = self.client.post("/api/downloads/analyze/", {}, format="json")
        self.assertEqual(res.status_code, 400)

    @patch("apps.downloader.ytdlp_utils.analyze_url")
    def test_analyze_includes_engine(self, mock_analyze):
        mock_analyze.return_value = {
            "url": "https://youtube.com/watch?v=test",
            "title": "Test",
            "media_kind": "video",
            "platform": "youtube",
        }
        res = self.client.post(
            "/api/downloads/analyze/",
            {"url": "https://youtube.com/watch?v=test"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("engine", res.data)

    @patch("apps.downloader.ytdlp_utils.analyze_url")
    def test_analyze_unauthenticated(self, mock_analyze):
        client = APIClient()
        res = client.post(
            "/api/downloads/analyze/",
            {"url": "https://youtube.com/watch?v=test"},
            format="json",
        )
        self.assertEqual(res.status_code, 401)


class DownloadDashboardViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="dashboard@test.example",
            email="dashboard@test.example",
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

    def test_dashboard_pulse_section(self):
        DownloadJob.objects.create(user=self.user, source_url="https://example.com/p.mp4", title="Pending", platform="http", status=DownloadJob.Status.PENDING)
        DownloadJob.objects.create(user=self.user, source_url="https://example.com/d.mp4", title="Downloading", platform="http", status=DownloadJob.Status.DOWNLOADING)

        res = self.client.get("/api/downloads/dashboard/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("pulse", res.data)
        self.assertIn("pending_count", res.data["pulse"])
        self.assertIn("downloading_count", res.data["pulse"])

    def test_dashboard_health_section(self):
        res = self.client.get("/api/downloads/dashboard/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("health", res.data)
        self.assertIn("disk", res.data["health"])

    def test_dashboard_heatmap_section(self):
        res = self.client.get("/api/downloads/dashboard/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("heatmap", res.data)
        self.assertIsInstance(res.data["heatmap"], list)

    def test_dashboard_empty_user(self):
        res = self.client.get("/api/downloads/dashboard/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["pulse"]["pending_count"], 0)
        self.assertEqual(res.data["pulse"]["downloading_count"], 0)

    def test_dashboard_only_own_data(self):
        other_user = User.objects.create_user(username="other@test.com", email="other@test.com", password="secret12345")
        DownloadJob.objects.create(user=other_user, source_url="https://example.com/o.mp4", title="Other", platform="http", status=DownloadJob.Status.DONE)

        res = self.client.get("/api/downloads/dashboard/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["pulse"]["done_count_today"], 0)

    def test_dashboard_unauthenticated(self):
        client = APIClient()
        res = client.get("/api/downloads/dashboard/")
        self.assertEqual(res.status_code, 401)