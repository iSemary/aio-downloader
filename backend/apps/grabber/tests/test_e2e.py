"""
End-to-end integration tests for the Grabber feature.
Tests the full API lifecycle: projects, filters, crawl lifecycle, files, edge cases.
"""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.grabber.crawler import (
    extract_css_urls,
    extract_file_links,
    extract_links_from_html,
    is_likely_file,
    normalize_url,
)
from apps.grabber.filters import FilterEngine, classify_file_extension
from apps.grabber.models import GrabberCrawlTask, GrabberDiscoveredFile, GrabberFilter, GrabberProject

User = get_user_model()


class GrabberE2ETest(TestCase):
    """Full end-to-end test of the Grabber feature."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = User.objects.create_user(
            username="e2e@test.example",
            email="e2e@test.example",
            password="testpass123",
        )
        cls.other_user = User.objects.create_user(
            username="other@test.example",
            email="other@test.example",
            password="testpass123",
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.project = self._create_project()

    def _create_project(self):
        res = self.client.post("/api/grabber/projects/", {
            "name": "E2E Test Project",
            "start_url": "https://example.com",
            "max_depth": 2,
            "max_pages": 50,
            "max_files": 100,
            "concurrency": 2,
            "crawl_delay": 0.5,
            "respect_robots_txt": False,
            "use_javascript": False,
        }, format="json")
        return res

    # ===== SECTION A: Project CRUD =====

    def test_a1_create_project(self):
        self.assertEqual(self.project.status_code, 201)
        data = self.project.data
        self.assertEqual(data["name"], "E2E Test Project")
        self.assertEqual(data["start_url"], "https://example.com")
        self.assertEqual(data["max_depth"], 2)
        self.assertEqual(data["max_pages"], 50)
        self.assertEqual(data["status"], "idle")
        self.assertIsNotNone(data.get("id"))

    def test_a2_list_projects(self):
        res = self.client.get("/api/grabber/projects/")
        self.assertEqual(res.status_code, 200)
        results = res.data.get("results", [])
        self.assertGreaterEqual(len(results), 1)

    def test_a3_retrieve_project(self):
        pid = self.project.data["id"]
        res = self.client.get(f"/api/grabber/projects/{pid}/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("crawl_tasks_count", res.data)
        self.assertIn("discovered_files_count", res.data)
        self.assertIn("filters", res.data)

    def test_a4_update_project(self):
        pid = self.project.data["id"]
        res = self.client.patch(f"/api/grabber/projects/{pid}/", {"name": "Updated Project"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["name"], "Updated Project")

    def test_a5_delete_project(self):
        pid = self.project.data["id"]
        res = self.client.delete(f"/api/grabber/projects/{pid}/")
        self.assertEqual(res.status_code, 204)
        self.assertEqual(GrabberProject.objects.count(), 0)

    def test_a6_other_user_cannot_access(self):
        other_client = APIClient()
        other_client.force_authenticate(self.other_user)
        pid = self.project.data["id"]
        res = other_client.get(f"/api/grabber/projects/{pid}/")
        self.assertEqual(res.status_code, 404)

    def test_a7_unauthenticated_requests_fail(self):
        anon = APIClient()
        res = anon.get("/api/grabber/projects/")
        self.assertEqual(res.status_code, 401)
        res = anon.post("/api/grabber/projects/", {"name": "X"}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_a8_validation_errors(self):
        res = self.client.post("/api/grabber/projects/", {"start_url": "https://example.com"}, format="json")
        self.assertEqual(res.status_code, 400)
        res = self.client.post("/api/grabber/projects/", {"name": "No URL"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_a9_nonexistent_project(self):
        res = self.client.get("/api/grabber/projects/00000000-0000-0000-0000-000000000000/")
        self.assertEqual(res.status_code, 404)

    # ===== SECTION B: Crawl Lifecycle =====

    def test_b1_start_crawl(self):
        pid = self.project.data["id"]
        res = self.client.post(f"/api/grabber/projects/{pid}/start/")
        self.assertEqual(res.status_code, 200)
        project = GrabberProject.objects.get(id=pid)
        self.assertEqual(project.status, "crawling")
        self.assertIsNotNone(project.started_at)

    def test_b2_double_start_rejected(self):
        pid = self.project.data["id"]
        self.client.post(f"/api/grabber/projects/{pid}/start/")
        res = self.client.post(f"/api/grabber/projects/{pid}/start/")
        self.assertEqual(res.status_code, 400)

    def test_b3_pause_resume(self):
        pid = self.project.data["id"]
        self.client.post(f"/api/grabber/projects/{pid}/start/")

        res = self.client.post(f"/api/grabber/projects/{pid}/pause/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(GrabberProject.objects.get(id=pid).status, "paused")

        res = self.client.post(f"/api/grabber/projects/{pid}/pause/")
        self.assertEqual(res.status_code, 400)

        res = self.client.post(f"/api/grabber/projects/{pid}/resume/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(GrabberProject.objects.get(id=pid).status, "crawling")

    def test_b4_stop_crawl(self):
        pid = self.project.data["id"]
        self.client.post(f"/api/grabber/projects/{pid}/start/")

        res = self.client.post(f"/api/grabber/projects/{pid}/stop/")
        self.assertEqual(res.status_code, 200)
        project = GrabberProject.objects.get(id=pid)
        self.assertEqual(project.status, "idle")
        self.assertIsNotNone(project.completed_at)

        res = self.client.post(f"/api/grabber/projects/{pid}/stop/")
        self.assertEqual(res.status_code, 400)

    def test_b5_stats_during_crawl(self):
        pid = self.project.data["id"]
        self.client.post(f"/api/grabber/projects/{pid}/start/")
        project = GrabberProject.objects.get(id=pid)
        project.pages_crawled = 15
        project.files_discovered = 42
        project.save(update_fields=["pages_crawled", "files_discovered"])

        res = self.client.get(f"/api/grabber/projects/{pid}/stats/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["pages_crawled"], 15)
        self.assertEqual(res.data["files_discovered"], 42)
        self.assertIn("file_type_breakdown", res.data)
        self.assertIn("file_status_breakdown", res.data)
        self.assertIn("crawl_task_counts", res.data)

    # ===== SECTION C: Filters =====

    def test_c1_crud_filters(self):
        pid = self.project.data["id"]
        res = self.client.post(f"/api/grabber/projects/{pid}/filters/", {
            "filter_type": "include",
            "target": "file_type",
            "pattern": "*.mp4",
        }, format="json")
        self.assertEqual(res.status_code, 201)
        f1_id = res.data["id"]

        res = self.client.post(f"/api/grabber/projects/{pid}/filters/", {
            "filter_type": "exclude",
            "target": "domain",
            "pattern": "ads.example.com",
        }, format="json")
        self.assertEqual(res.status_code, 201)
        f2_id = res.data["id"]

        res = self.client.get(f"/api/grabber/projects/{pid}/filters/")
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 2)

        res = self.client.delete(f"/api/grabber/projects/{pid}/filters/{f1_id}/")
        self.assertEqual(res.status_code, 204)

        res = self.client.get(f"/api/grabber/projects/{pid}/filters/")
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 1)

        res = self.client.delete(f"/api/grabber/projects/{pid}/filters/{f2_id}/")
        self.assertEqual(res.status_code, 204)

    def test_c2_filters_appear_in_project_detail(self):
        pid = self.project.data["id"]
        self.client.post(f"/api/grabber/projects/{pid}/filters/", {
            "filter_type": "include", "target": "file_type", "pattern": "*.mp4",
        }, format="json")
        res = self.client.get(f"/api/grabber/projects/{pid}/")
        self.assertGreaterEqual(len(res.data.get("filters", [])), 1)

    # ===== SECTION D: Discovered Files =====

    def test_d1_create_and_list_files(self):
        pid = self.project.data["id"]
        project = GrabberProject.objects.get(id=pid)
        task = GrabberCrawlTask.objects.create(project=project, url="https://example.com/p1", depth=0)
        GrabberDiscoveredFile.objects.create(
            project=project, crawl_task=task,
            file_url="https://example.com/v.mp4", file_name="v.mp4",
            file_size=1024, file_type="video", extension="mp4",
        )
        GrabberDiscoveredFile.objects.create(
            project=project, crawl_task=task,
            file_url="https://example.com/d.pdf", file_name="d.pdf",
            file_size=512, file_type="document", extension="pdf",
        )

        res = self.client.get(f"/api/grabber/projects/{pid}/files/")
        results = res.data.get("results", [])
        self.assertEqual(len(results), 2)
        first = results[0]
        for field in ("id", "file_url", "file_name", "file_size", "file_type", "extension", "status", "created_at"):
            self.assertIn(field, first)

    def test_d2_filter_files_by_type(self):
        pid = self.project.data["id"]
        project = GrabberProject.objects.get(id=pid)
        task = GrabberCrawlTask.objects.create(project=project, url="https://example.com/p", depth=0)
        GrabberDiscoveredFile.objects.create(project=project, crawl_task=task, file_url="https://a.mp4", file_name="a.mp4", file_type="video", extension="mp4")
        GrabberDiscoveredFile.objects.create(project=project, crawl_task=task, file_url="https://b.pdf", file_name="b.pdf", file_type="document", extension="pdf")

        res = self.client.get(f"/api/grabber/projects/{pid}/files/?file_type=video")
        self.assertEqual(len(res.data.get("results", [])), 1)

    def test_d3_search_files(self):
        pid = self.project.data["id"]
        project = GrabberProject.objects.get(id=pid)
        task = GrabberCrawlTask.objects.create(project=project, url="https://example.com/p", depth=0)
        GrabberDiscoveredFile.objects.create(project=project, crawl_task=task, file_url="https://a.mp4", file_name="video.mp4", file_type="video", extension="mp4")
        GrabberDiscoveredFile.objects.create(project=project, crawl_task=task, file_url="https://b.pdf", file_name="document.pdf", file_type="document", extension="pdf")

        res = self.client.get(f"/api/grabber/projects/{pid}/files/?search=video")
        self.assertEqual(len(res.data.get("results", [])), 1)

    def test_d4_delete_file(self):
        pid = self.project.data["id"]
        project = GrabberProject.objects.get(id=pid)
        task = GrabberCrawlTask.objects.create(project=project, url="https://example.com/p", depth=0)
        f = GrabberDiscoveredFile.objects.create(project=project, crawl_task=task, file_url="https://a.mp4", file_name="a.mp4", file_type="video", extension="mp4")

        res = self.client.delete(f"/api/grabber/projects/{pid}/files/{f.id}/")
        self.assertEqual(res.status_code, 204)

    def test_d5_file_has_required_fields(self):
        pid = self.project.data["id"]
        project = GrabberProject.objects.get(id=pid)
        task = GrabberCrawlTask.objects.create(project=project, url="https://p", depth=0)
        f = GrabberDiscoveredFile.objects.create(
            project=project, crawl_task=task,
            file_url="https://example.com/v.mp4", file_name="v.mp4",
            file_size=2048000, file_type="video", extension="mp4",
            page_url="https://example.com/page",
        )
        self.assertEqual(f.file_type, "video")
        self.assertEqual(f.file_size, 2048000)
        self.assertEqual(f.page_url, "https://example.com/page")
        self.assertEqual(f.status, "discovered")

    # ===== SECTION E: Crawl Tasks =====

    def test_e1_list_crawl_tasks(self):
        pid = self.project.data["id"]
        project = GrabberProject.objects.get(id=pid)
        parent = GrabberCrawlTask.objects.create(project=project, url="https://example.com", depth=0)
        GrabberCrawlTask.objects.create(project=project, parent=parent, url="https://example.com/p1", depth=1)

        res = self.client.get(f"/api/grabber/projects/{pid}/tasks/")
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 2)

    def test_e2_crawl_task_fields(self):
        pid = self.project.data["id"]
        project = GrabberProject.objects.get(id=pid)
        task = GrabberCrawlTask.objects.create(project=project, url="https://example.com", depth=2, status="done")
        res = self.client.get(f"/api/grabber/projects/{pid}/tasks/")
        results = res.data.get("results", res.data)
        t = results[0]
        self.assertIn("parent_id", t)
        self.assertIn("depth", t)
        self.assertIn("url", t)
        self.assertIn("status", t)
        self.assertIn("children_count", t)
        self.assertIn("files_count", t)

    # ===== SECTION F: Crawler Utilities =====

    def test_f1_html_link_extraction(self):
        html = '<a href="/p1">L1</a><a href="https://other.com">L2</a><img src="/img.png"><video src="/v.mp4"><script src="/app.js">'
        links = extract_links_from_html("https://example.com", html)
        self.assertIn("https://example.com/p1", links)
        self.assertIn("https://other.com", links)
        self.assertIn("https://example.com/img.png", links)
        self.assertIn("https://example.com/v.mp4", links)
        self.assertIn("https://example.com/app.js", links)

    def test_f2_file_discovery_from_html(self):
        html = '<img src="/photo.jpg"><a href="/video.mp4">V</a><a href="/doc.pdf">D</a><audio src="/song.mp3">'
        files = extract_file_links("https://example.com", html)
        urls = {f["url"] for f in files}
        self.assertIn("https://example.com/photo.jpg", urls)
        self.assertIn("https://example.com/video.mp4", urls)
        self.assertIn("https://example.com/doc.pdf", urls)
        self.assertIn("https://example.com/song.mp3", urls)

    def test_f3_is_likely_file(self):
        self.assertTrue(is_likely_file("https://example.com/v.mp4"))
        self.assertTrue(is_likely_file("https://example.com/img.jpg"))
        self.assertFalse(is_likely_file("https://example.com/page"))
        self.assertFalse(is_likely_file("https://example.com/"))

    def test_f4_url_normalization(self):
        self.assertEqual(normalize_url("https://a.com", "https://b.com/f"), "https://b.com/f")
        self.assertEqual(normalize_url("https://a.com/page/", "sub/f.pdf"), "https://a.com/page/sub/f.pdf")
        self.assertEqual(normalize_url("https://a.com/page/", "/root/f.pdf"), "https://a.com/root/f.pdf")
        self.assertEqual(normalize_url("https://a.com", "#section"), "https://a.com")

    def test_f5_css_url_extraction(self):
        css = "background: url('/bg.png'); background-image: url('https://cdn.com/bg2.jpg');"
        urls = extract_css_urls("https://example.com", css)
        self.assertIn("https://example.com/bg.png", urls)
        self.assertIn("https://cdn.com/bg2.jpg", urls)

    def test_f6_skip_javascript_links(self):
        html = '<a href="javascript:void(0)">Click</a><a href="mailto:x@y.com">Email</a>'
        links = extract_links_from_html("https://example.com", html)
        self.assertNotIn("javascript:void(0)", links)
        self.assertNotIn("mailto:x@y.com", links)

    # ===== SECTION G: Filter Engine =====

    def _get_project_obj(self):
        return GrabberProject.objects.get(id=self.project.data["id"])

    def test_g1_include_filter(self):
        project = self._get_project_obj()
        GrabberFilter.objects.create(project=project, filter_type="include", target="file_type", pattern="*.mp4")
        engine = FilterEngine(project)
        self.assertTrue(engine.should_download_file("https://example.com/v.mp4", "mp4"))
        self.assertFalse(engine.should_download_file("https://example.com/d.pdf", "pdf"))

    def test_g2_exclude_filter(self):
        project = self._get_project_obj()
        GrabberFilter.objects.create(project=project, filter_type="exclude", target="domain", pattern="ads.example.com")
        engine = FilterEngine(project)
        self.assertFalse(engine.should_crawl_url("https://ads.example.com/tracker"))
        self.assertTrue(engine.should_crawl_url("https://example.com/good"))

    def test_g3_combined_filters(self):
        project = self._get_project_obj()
        GrabberFilter.objects.create(project=project, filter_type="include", target="file_type", pattern="*.mp4")
        GrabberFilter.objects.create(project=project, filter_type="exclude", target="domain", pattern="tracker.example.com")
        engine = FilterEngine(project)
        self.assertTrue(engine.should_download_file("https://example.com/v.mp4", "mp4"))
        self.assertFalse(engine.should_download_file("https://tracker.example.com/v.mp4", "mp4"))

    def test_g4_no_filters(self):
        project = self._get_project_obj()
        engine = FilterEngine(project)
        self.assertTrue(engine.should_crawl_url("https://example.com/any"))
        self.assertTrue(engine.should_download_file("https://example.com/f.mp4", "mp4"))

    def test_g5_keyword_filter(self):
        project = self._get_project_obj()
        GrabberFilter.objects.create(project=project, filter_type="include", target="keyword", pattern="download")
        engine = FilterEngine(project)
        self.assertTrue(engine.should_crawl_url("https://example.com/download/file"))
        self.assertFalse(engine.should_crawl_url("https://example.com/about"))

    def test_g6_regex_filter(self):
        project = self._get_project_obj()
        GrabberFilter.objects.create(project=project, filter_type="include", target="file_type", pattern=r"\.(mp4|webm)$", is_regex=True)
        engine = FilterEngine(project)
        self.assertTrue(engine.should_download_file("https://example.com/v.mp4", "mp4"))
        self.assertTrue(engine.should_download_file("https://example.com/v.webm", "webm"))
        self.assertFalse(engine.should_download_file("https://example.com/v.pdf", "pdf"))

    def test_g7_file_extension_classification(self):
        self.assertEqual(classify_file_extension("mp4"), "video")
        self.assertEqual(classify_file_extension("jpg"), "image")
        self.assertEqual(classify_file_extension("mp3"), "audio")
        self.assertEqual(classify_file_extension("pdf"), "document")
        self.assertEqual(classify_file_extension("zip"), "archive")
        self.assertEqual(classify_file_extension("xyz"), "other")
