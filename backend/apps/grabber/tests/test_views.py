from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.grabber.models import GrabberCrawlTask, GrabberDiscoveredFile, GrabberFilter, GrabberProject

User = get_user_model()


class GrabberProjectViewSetTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="project@test.example",
            email="project@test.example",
            password="secret12345",
        )
        self.other_user = User.objects.create_user(
            username="other@test.example",
            email="other@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_create_project(self):
        res = self.client.post("/api/grabber/projects/", {
            "name": "My Project",
            "start_url": "https://example.com",
            "max_depth": 2,
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["name"], "My Project")
        self.assertEqual(res.data["start_url"], "https://example.com")
        self.assertEqual(res.data["max_depth"], 2)
        self.assertEqual(res.data["status"], "idle")

    def test_create_project_requires_auth(self):
        anon = APIClient()
        res = anon.post("/api/grabber/projects/", {
            "name": "Anon",
            "start_url": "https://example.com",
        }, format="json")
        self.assertEqual(res.status_code, 401)

    def test_list_projects(self):
        GrabberProject.objects.create(user=self.user, name="P1", start_url="https://a.com")
        GrabberProject.objects.create(user=self.user, name="P2", start_url="https://b.com")
        GrabberProject.objects.create(user=self.other_user, name="P3", start_url="https://c.com")

        res = self.client.get("/api/grabber/projects/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 2)

    def test_list_projects_empty(self):
        res = self.client.get("/api/grabber/projects/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 0)

    def test_retrieve_project(self):
        project = GrabberProject.objects.create(user=self.user, name="Test", start_url="https://example.com")
        res = self.client.get(f"/api/grabber/projects/{project.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["name"], "Test")
        self.assertIn("crawl_tasks_count", res.data)

    def test_retrieve_other_user_project_forbidden(self):
        project = GrabberProject.objects.create(user=self.other_user, name="Other", start_url="https://example.com")
        res = self.client.get(f"/api/grabber/projects/{project.id}/")
        self.assertEqual(res.status_code, 404)

    def test_update_project(self):
        project = GrabberProject.objects.create(user=self.user, name="Old", start_url="https://example.com")
        res = self.client.patch(f"/api/grabber/projects/{project.id}/", {"name": "Updated"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["name"], "Updated")

    def test_delete_project(self):
        project = GrabberProject.objects.create(user=self.user, name="Delete Me", start_url="https://example.com")
        res = self.client.delete(f"/api/grabber/projects/{project.id}/")
        self.assertEqual(res.status_code, 204)
        self.assertEqual(GrabberProject.objects.count(), 0)

    @patch("apps.grabber.views.crawl_project_task.delay")
    def test_start_crawl(self, mock_crawl):
        project = GrabberProject.objects.create(user=self.user, name="Crawl", start_url="https://example.com")
        res = self.client.post(f"/api/grabber/projects/{project.id}/start/")
        self.assertEqual(res.status_code, 200)
        project.refresh_from_db()
        self.assertEqual(project.status, "crawling")
        mock_crawl.assert_called_once()

    def test_start_already_crawling(self):
        project = GrabberProject.objects.create(user=self.user, name="Crawling", start_url="https://example.com", status="crawling")
        res = self.client.post(f"/api/grabber/projects/{project.id}/start/")
        self.assertEqual(res.status_code, 400)

    @patch("apps.grabber.views.stop_crawl_project_task.delay")
    def test_stop_crawl(self, mock_stop):
        project = GrabberProject.objects.create(user=self.user, name="Stop", start_url="https://example.com", status="crawling")
        res = self.client.post(f"/api/grabber/projects/{project.id}/stop/")
        self.assertEqual(res.status_code, 200)
        project.refresh_from_db()
        self.assertEqual(project.status, "idle")

    def test_stop_not_crawling(self):
        project = GrabberProject.objects.create(user=self.user, name="Idle", start_url="https://example.com")
        res = self.client.post(f"/api/grabber/projects/{project.id}/stop/")
        self.assertEqual(res.status_code, 400)

    @patch("apps.grabber.views.pause_crawl_project_task.delay")
    def test_pause_crawl(self, mock_pause):
        project = GrabberProject.objects.create(user=self.user, name="Pause", start_url="https://example.com", status="crawling")
        res = self.client.post(f"/api/grabber/projects/{project.id}/pause/")
        self.assertEqual(res.status_code, 200)
        project.refresh_from_db()
        self.assertEqual(project.status, "paused")

    def test_pause_not_crawling(self):
        project = GrabberProject.objects.create(user=self.user, name="Idle", start_url="https://example.com")
        res = self.client.post(f"/api/grabber/projects/{project.id}/pause/")
        self.assertEqual(res.status_code, 400)

    @patch("apps.grabber.views.crawl_project_task.delay")
    def test_resume_crawl(self, mock_crawl):
        project = GrabberProject.objects.create(user=self.user, name="Resume", start_url="https://example.com", status="paused")
        res = self.client.post(f"/api/grabber/projects/{project.id}/resume/")
        self.assertEqual(res.status_code, 200)
        project.refresh_from_db()
        self.assertEqual(project.status, "crawling")
        mock_crawl.assert_called_once()

    def test_resume_not_paused(self):
        project = GrabberProject.objects.create(user=self.user, name="Idle", start_url="https://example.com")
        res = self.client.post(f"/api/grabber/projects/{project.id}/resume/")
        self.assertEqual(res.status_code, 400)

    def test_project_stats(self):
        project = GrabberProject.objects.create(user=self.user, name="Stats", start_url="https://example.com", pages_crawled=10, files_discovered=25)
        res = self.client.get(f"/api/grabber/projects/{project.id}/stats/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["pages_crawled"], 10)
        self.assertEqual(res.data["files_discovered"], 25)
        self.assertIn("file_type_breakdown", res.data)
        self.assertIn("file_status_breakdown", res.data)
        self.assertIn("crawl_task_counts", res.data)


class GrabberFilterViewSetTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="filterview@test.example",
            email="filterview@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.project = GrabberProject.objects.create(user=self.user, name="Filter Proj", start_url="https://example.com")

    def test_create_filter(self):
        res = self.client.post(f"/api/grabber/projects/{self.project.id}/filters/", {
            "filter_type": "include",
            "target": "file_type",
            "pattern": "*.mp4",
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["pattern"], "*.mp4")

    def test_list_filters(self):
        GrabberFilter.objects.create(project=self.project, filter_type="include", target="file_type", pattern="*.mp4")
        res = self.client.get(f"/api/grabber/projects/{self.project.id}/filters/")
        self.assertEqual(res.status_code, 200)
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 1)

    def test_delete_filter(self):
        f = GrabberFilter.objects.create(project=self.project, filter_type="include", target="file_type", pattern="*.mp4")
        res = self.client.delete(f"/api/grabber/projects/{self.project.id}/filters/{f.id}/")
        self.assertEqual(res.status_code, 204)


class GrabberDiscoveredFileViewSetTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="fileview@test.example",
            email="fileview@test.example",
            password="secret12345",
        )
        self.other_user = User.objects.create_user(
            username="otherfile@test.example",
            email="otherfile@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.project = GrabberProject.objects.create(user=self.user, name="File Proj", start_url="https://example.com")
        self.other_project = GrabberProject.objects.create(user=self.other_user, name="Other", start_url="https://example.com")
        self.task = GrabberCrawlTask.objects.create(project=self.project, url="https://example.com/page", depth=1)
        self.file = GrabberDiscoveredFile.objects.create(
            project=self.project,
            crawl_task=self.task,
            file_url="https://example.com/video.mp4",
            file_name="video.mp4",
            file_type="video",
            extension="mp4",
        )

    def test_list_discovered_files(self):
        res = self.client.get(f"/api/grabber/projects/{self.project.id}/files/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 1)

    def test_filter_by_file_type(self):
        GrabberDiscoveredFile.objects.create(
            project=self.project, crawl_task=self.task,
            file_url="https://example.com/doc.pdf", file_name="doc.pdf",
            file_type="document", extension="pdf",
        )
        res = self.client.get(f"/api/grabber/projects/{self.project.id}/files/?file_type=video")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 1)

    def test_search_by_file_name(self):
        res = self.client.get(f"/api/grabber/projects/{self.project.id}/files/?search=video")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 1)

    def test_other_user_cannot_access(self):
        res = self.client.get(f"/api/grabber/projects/{self.other_project.id}/files/")
        self.assertEqual(res.status_code, 200)
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 0)

    def test_delete_file(self):
        res = self.client.delete(f"/api/grabber/projects/{self.project.id}/files/{self.file.id}/")
        self.assertEqual(res.status_code, 204)


class GrabberProjectStatsViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="statsview@test.example",
            email="statsview@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.project = GrabberProject.objects.create(user=self.user, name="Stats", start_url="https://example.com")
        self.task = GrabberCrawlTask.objects.create(project=self.project, url="https://example.com", depth=0)

    def test_stats_returns_file_type_breakdown(self):
        GrabberDiscoveredFile.objects.create(
            project=self.project, crawl_task=self.task,
            file_url="https://example.com/a.mp4", file_name="a.mp4",
            file_type="video", extension="mp4",
        )
        GrabberDiscoveredFile.objects.create(
            project=self.project, crawl_task=self.task,
            file_url="https://example.com/b.pdf", file_name="b.pdf",
            file_type="document", extension="pdf",
        )
        res = self.client.get(f"/api/grabber/projects/{self.project.id}/stats/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["file_type_breakdown"]["video"], 1)
        self.assertEqual(res.data["file_type_breakdown"]["document"], 1)
