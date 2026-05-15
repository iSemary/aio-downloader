"""
End-to-end test for the Grabber feature.
Tests the full flow: project creation, crawling, filtering, file discovery, and downloading.
Uses the Django test client to simulate real API requests.
"""
import json
import os
import sys

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

django.setup()

from django.contrib.auth import get_user_model
from django.test.utils import setup_test_environment, teardown_test_environment
from django.test.runner import DiscoverRunner
from rest_framework.test import APIClient

from apps.grabber.models import GrabberCrawlTask, GrabberDiscoveredFile, GrabberFilter, GrabberProject

User = get_user_model()

passed = 0
failed = 0

def check(description, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  ✅ {description}")
    else:
        failed += 1
        print(f"  ❌ {description} -- {detail}")

print("=" * 70)
print("END-TO-END GRABBER FEATURE TEST")
print("=" * 70)

# 1. Create test database
print("\n[1] Setting up test database...")
runner = DiscoverRunner(verbosity=0)
old_config = runner.setup_databases()
setup_test_environment()

try:
    # 2. Create user
    print("\n[2] Creating test user...")
    user = User.objects.create_user(
        username="e2e@test.example",
        email="e2e@test.example",
        password="testpass123",
    )
    other_user = User.objects.create_user(
        username="other@test.example",
        email="other@test.example",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user)
    check("User created", True)

    # ============================================================
    # SECTION A: Project CRUD
    # ============================================================
    print("\n[3] Project CRUD tests...")

    # Create project
    res = client.post("/api/grabber/projects/", {
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
    check("Create project returns 201", res.status_code == 201, str(res.data))
    project_id = res.data["id"]
    check("Project has UUID", len(project_id) > 0)
    check("Project status is idle", res.data["status"] == "idle")
    check("Project name matches", res.data["name"] == "E2E Test Project")
    check("Project start_url matches", res.data["start_url"] == "https://example.com")
    check("Project max_depth is 2", res.data["max_depth"] == 2)
    check("Project max_pages is 50", res.data["max_pages"] == 50)
    check("Project max_files is 100", res.data["max_files"] == 100)

    # List projects
    res = client.get("/api/grabber/projects/")
    check("List projects returns 200", res.status_code == 200)
    check("List contains 1 project", len(res.data.get("results", [])) == 1)

    # Retrieve project detail
    res = client.get(f"/api/grabber/projects/{project_id}/")
    check("Retrieve project returns 200", res.status_code == 200)
    check("Detail includes crawl_tasks_count", "crawl_tasks_count" in res.data)
    check("Detail includes discovered_files_count", "discovered_files_count" in res.data)
    check("Detail includes filters", "filters" in res.data)

    # Update project
    res = client.patch(f"/api/grabber/projects/{project_id}/", {"name": "Updated E2E"}, format="json")
    check("Update project returns 200", res.status_code == 200)
    check("Project name updated", res.data["name"] == "Updated E2E")

    # Authorization: other user cannot see this project
    other_client = APIClient()
    other_client.force_authenticate(other_user)
    res = other_client.get(f"/api/grabber/projects/{project_id}/")
    check("Other user cannot access (404)", res.status_code == 404)

    # Delete project (will recreate later)
    res = client.delete(f"/api/grabber/projects/{project_id}/")
    check("Delete project returns 204", res.status_code == 204)
    check("Project deleted", GrabberProject.objects.count() == 0)

    # Recreate for subsequent tests
    res = client.post("/api/grabber/projects/", {
        "name": "E2E Full Test",
        "start_url": "https://example.com",
        "max_depth": 2,
    }, format="json")
    project_id = res.data["id"]
    check("Recreated project for E2E", res.status_code == 201)

    # ============================================================
    # SECTION B: Filters
    # ============================================================
    print("\n[4] Filter tests...")

    # Create include filter
    res = client.post(f"/api/grabber/projects/{project_id}/filters/", {
        "filter_type": "include",
        "target": "file_type",
        "pattern": "*.mp4",
    }, format="json")
    check("Create include filter returns 201", res.status_code == 201)
    include_filter_id = res.data["id"]
    check("Filter type is include", res.data["filter_type"] == "include")

    # Create exclude filter
    res = client.post(f"/api/grabber/projects/{project_id}/filters/", {
        "filter_type": "exclude",
        "target": "domain",
        "pattern": "tracker.example.com",
    }, format="json")
    check("Create exclude filter returns 201", res.status_code == 201)
    exclude_filter_id = res.data["id"]

    # List filters
    res = client.get(f"/api/grabber/projects/{project_id}/filters/")
    results = res.data.get("results", res.data)
    check("List filters returns 2", len(results) == 2)

    # Get project detail should include filters
    res = client.get(f"/api/grabber/projects/{project_id}/")
    check("Project detail includes filters", len(res.data.get("filters", [])) == 2)

    # Delete filter
    res = client.delete(f"/api/grabber/projects/{project_id}/filters/{include_filter_id}/")
    check("Delete filter returns 204", res.status_code == 204)
    res = client.get(f"/api/grabber/projects/{project_id}/filters/")
    results = res.data.get("results", res.data)
    check("1 filter remains after delete", len(results) == 1)

    # Clean up remaining filter
    client.delete(f"/api/grabber/projects/{project_id}/filters/{exclude_filter_id}/")

    # ============================================================
    # SECTION C: Crawl lifecycle (mock-free, tests API actions)
    # ============================================================
    print("\n[5] Crawl lifecycle tests...")

    # Start crawl
    res = client.post(f"/api/grabber/projects/{project_id}/start/")
    check("Start crawl returns 200", res.status_code == 200)
    project = GrabberProject.objects.get(id=project_id)
    check("Project status changed to crawling", project.status == "crawling")
    check("Started at is set", project.started_at is not None)

    # Start crawl again should fail
    res = client.post(f"/api/grabber/projects/{project_id}/start/")
    check("Double start rejected (400)", res.status_code == 400)

    # Pause crawl
    res = client.post(f"/api/grabber/projects/{project_id}/pause/")
    check("Pause crawl returns 200", res.status_code == 200)
    project.refresh_from_db()
    check("Project status changed to paused", project.status == "paused")

    # Pause while paused should fail
    res = client.post(f"/api/grabber/projects/{project_id}/pause/")
    check("Double pause rejected (400)", res.status_code == 400)

    # Resume crawl
    res = client.post(f"/api/grabber/projects/{project_id}/resume/")
    check("Resume crawl returns 200", res.status_code == 200)
    project.refresh_from_db()
    check("Project status changed to crawling", project.status == "crawling")

    # Stop crawl
    res = client.post(f"/api/grabber/projects/{project_id}/stop/")
    check("Stop crawl returns 200", res.status_code == 200)
    project.refresh_from_db()
    check("Project status changed to idle", project.status == "idle")
    check("Completed at is set", project.completed_at is not None)

    # Stop while idle should fail
    res = client.post(f"/api/grabber/projects/{project_id}/stop/")
    check("Double stop rejected (400)", res.status_code == 400)

    # Start again (for stats tests)
    res = client.post(f"/api/grabber/projects/{project_id}/start/")

    # Manually simulate some crawl progress
    project.pages_crawled = 15
    project.files_discovered = 42
    project.save(update_fields=["pages_crawled", "files_discovered"])

    # Project stats
    res = client.get(f"/api/grabber/projects/{project_id}/stats/")
    check("Stats returns 200", res.status_code == 200)
    check("Stats shows pages_crawled", res.data.get("pages_crawled") == 15)
    check("Stats shows files_discovered", res.data.get("files_discovered") == 42)
    check("Stats has file_type_breakdown", "file_type_breakdown" in res.data)
    check("Stats has file_status_breakdown", "file_status_breakdown" in res.data)
    check("Stats has crawl_task_counts", "crawl_task_counts" in res.data)

    # ============================================================
    # SECTION D: Discovered Files
    # ============================================================
    print("\n[6] Discovered files tests...")

    # Create some discovered files directly
    task1 = GrabberCrawlTask.objects.create(
        project=project,
        url="https://example.com/page1",
        depth=0,
        status="done",
    )
    task2 = GrabberCrawlTask.objects.create(
        project=project,
        url="https://example.com/page2",
        depth=1,
        parent=task1,
    )

    file1 = GrabberDiscoveredFile.objects.create(
        project=project,
        crawl_task=task1,
        file_url="https://example.com/video.mp4",
        file_name="video.mp4",
        file_size=1024000,
        file_type="video",
        extension="mp4",
        page_url="https://example.com/page1",
    )
    file2 = GrabberDiscoveredFile.objects.create(
        project=project,
        crawl_task=task1,
        file_url="https://example.com/doc.pdf",
        file_name="doc.pdf",
        file_size=512000,
        file_type="document",
        extension="pdf",
        page_url="https://example.com/page1",
    )
    file3 = GrabberDiscoveredFile.objects.create(
        project=project,
        crawl_task=task2,
        file_url="https://example.com/audio.mp3",
        file_name="audio.mp3",
        file_size=2048000,
        file_type="audio",
        extension="mp3",
        page_url="https://example.com/page2",
    )

    # List files
    res = client.get(f"/api/grabber/projects/{project_id}/files/")
    check("List files returns 200", res.status_code == 200)
    results = res.data.get("results", [])
    check("3 files discovered", len(results) == 3)

    # Filter by file type
    res = client.get(f"/api/grabber/projects/{project_id}/files/?file_type=video")
    results = res.data.get("results", [])
    check("Filter by file_type=video returns 1", len(results) == 1)
    check("Correct file type", results[0]["file_type"] == "video")

    res = client.get(f"/api/grabber/projects/{project_id}/files/?file_type=document")
    results = res.data.get("results", [])
    check("Filter by file_type=document returns 1", len(results) == 1)

    # Search by name
    res = client.get(f"/api/grabber/projects/{project_id}/files/?search=audio")
    results = res.data.get("results", [])
    check("Search audio returns 1", len(results) == 1)
    check("Correct file", results[0]["file_name"] == "audio.mp3")

    # Filter by status
    res = client.get(f"/api/grabber/projects/{project_id}/files/?status=discovered")
    results = res.data.get("results", [])
    check("Filter by status=discovered returns 3", len(results) == 3)

    # Check file detail fields
    res = client.get(f"/api/grabber/projects/{project_id}/files/")
    results = res.data.get("results", [])
    f = results[0]
    check("File has file_url", "file_url" in f)
    check("File has file_name", "file_name" in f)
    check("File has file_size", "file_size" in f)
    check("File has file_type", "file_type" in f)
    check("File has extension", "extension" in f)
    check("File has page_url", "page_url" in f)
    check("File has status", "status" in f)
    check("File has created_at", "created_at" in f)
    check("File id is UUID", len(f["id"]) > 0)

    # ============================================================
    # SECTION E: Crawl Tasks
    # ============================================================
    print("\n[7] Crawl tasks tests...")

    res = client.get(f"/api/grabber/projects/{project_id}/tasks/")
    check("List tasks returns 200", res.status_code == 200)
    results = res.data.get("results", res.data)
    check("2 crawl tasks exist", len(results) == 2)
    check("Task has parent_id field", "parent_id" in results[0])
    check("Task has depth field", "depth" in results[0])
    check("Task has url field", "url" in results[0])
    check("Task has status field", "status" in results[0])
    check("Task has children_count", "children_count" in results[0])
    check("Task has files_count", "files_count" in results[0])

    # ============================================================
    # SECTION F: Task lifecycle (stop crawl while running)
    # ============================================================
    print("\n[8] Task lifecycle tests...")

    # Set project to crawling and stop it
    from django.utils import timezone
    project.status = "crawling"
    project.started_at = timezone.now()
    project.save(update_fields=["status", "started_at"])

    res = client.post(f"/api/grabber/projects/{project_id}/stop/")
    check("Stop crawling project returns 200", res.status_code == 200)
    project.refresh_from_db()
    check("Status is idle after stop", project.status == "idle")

    # ============================================================
    # SECTION G: Validation and Edge Cases
    # ============================================================
    print("\n[9] Validation and edge case tests...")

    # Create project without name
    res = client.post("/api/grabber/projects/", {"start_url": "https://example.com"}, format="json")
    check("Project without name fails (400)", res.status_code == 400)

    # Create project without URL
    res = client.post("/api/grabber/projects/", {"name": "No URL"}, format="json")
    check("Project without URL fails (400)", res.status_code == 400)

    # Create project with invalid URL
    res = client.post("/api/grabber/projects/", {"name": "Bad URL", "start_url": "not-a-url"}, format="json")
    check("Project with invalid URL fails (400)", res.status_code == 400)

    # List projects unauthenticated
    anon_client = APIClient()
    res = anon_client.get("/api/grabber/projects/")
    check("Unauthenticated list fails (401)", res.status_code == 401)

    # Create project unauthenticated
    res = anon_client.post("/api/grabber/projects/", {"name": "Anon", "start_url": "https://example.com"}, format="json")
    check("Unauthenticated create fails (401)", res.status_code == 401)

    # Access non-existent project
    res = client.get("/api/grabber/projects/00000000-0000-0000-0000-000000000000/")
    check("Non-existent project returns 404", res.status_code == 404)

    # Delete file
    res = client.delete(f"/api/grabber/projects/{project_id}/files/{file1.id}/")
    check("Delete file returns 204", res.status_code == 204)
    check("File count is now 2", GrabberDiscoveredFile.objects.filter(project=project).count() == 2)

    # ============================================================
    # SECTION H: Duplicate model features
    # ============================================================
    print("\n[10] Duplicate detection model tests...")

    file_dup = GrabberDiscoveredFile.objects.create(
        project=project,
        crawl_task=task2,
        file_url="https://example.com/doc-copy.pdf",
        file_name="doc-copy.pdf",
        file_size=512000,
        file_type="document",
        extension="pdf",
        duplicate_of=file2,
        is_duplicate=True,
    )
    check("Duplicate file linked to original", file_dup.duplicate_of_id == file2.id)
    check("Duplicate is_duplicate flag set", file_dup.is_duplicate is True)

    file2.refresh_from_db()
    dup_count = file2.duplicates.count()
    check("Original has 1 duplicate record", dup_count == 1)

    # ============================================================
    # SECTION I: Filter engine unit tests (replicating actual logic)
    # ============================================================
    print("\n[11] Filter engine tests...")

    from apps.grabber.filters import FilterEngine, classify_file_extension

    # Create a project purely for filter testing
    filter_project = GrabberProject.objects.create(
        user=user,
        name="Filter Engine Project",
        start_url="https://example.com",
    )
    GrabberFilter.objects.create(
        project=filter_project,
        filter_type="include",
        target="file_type",
        pattern="*.mp4",
    )
    GrabberFilter.objects.create(
        project=filter_project,
        filter_type="exclude",
        target="domain",
        pattern="ads.example.com",
    )

    engine = FilterEngine(filter_project)
    check("Include filter allows mp4", engine.should_download_file("https://example.com/v.mp4", "mp4"))
    check("Include filter blocks pdf", not engine.should_download_file("https://example.com/d.pdf", "pdf"))
    check("Exclude filter blocks ad domain", not engine.should_download_file("https://ads.example.com/v.mp4", "mp4"))
    check("No filters allows all crawl", engine.should_crawl_url("https://example.com/any"))
    check("Exclude filter blocks crawl", not engine.should_crawl_url("https://ads.example.com/tracker"))

    # File extension classification
    check("mp4 -> video", classify_file_extension("mp4") == "video")
    check("jpg -> image", classify_file_extension("jpg") == "image")
    check("mp3 -> audio", classify_file_extension("mp3") == "audio")
    check("pdf -> document", classify_file_extension("pdf") == "document")
    check("zip -> archive", classify_file_extension("zip") == "archive")
    check("xyz -> other", classify_file_extension("xyz") == "other")

    # ============================================================
    # SECTION J: Crawler utility tests
    # ============================================================
    print("\n[12] Crawler utility tests...")

    from apps.grabber.crawler import (
        extract_links_from_html,
        extract_file_links,
        is_likely_file,
        normalize_url,
        extract_css_urls,
    )

    html = '''
    <html>
    <body>
        <a href="/page1">Link 1</a>
        <a href="https://other.com">Link 2</a>
        <img src="/image.png">
        <video src="/video.mp4"></video>
        <audio src="/audio.mp3"></audio>
        <script src="/app.js"></script>
        <link rel="stylesheet" href="/style.css">
    </body>
    </html>
    '''
    links = extract_links_from_html("https://example.com", html)
    check("Extracts a tags", "https://example.com/page1" in links)
    check("Extracts absolute URLs", "https://other.com" in links)
    check("Extracts img src", "https://example.com/image.png" in links)
    check("Extracts video src", "https://example.com/video.mp4" in links)
    check("Extracts audio src", "https://example.com/audio.mp3" in links)
    check("Extracts script src", "https://example.com/app.js" in links)
    check("Extracts link href", "https://example.com/style.css" in links)

    files = extract_file_links("https://example.com", html)
    file_urls = {f["url"] for f in files}
    check("Discovers video file", "https://example.com/video.mp4" in file_urls)
    check("Discovers image file", "https://example.com/image.png" in file_urls)
    check("Discovers audio file", "https://example.com/audio.mp3" in file_urls)

    check("is_likely_file for mp4", is_likely_file("https://example.com/v.mp4"))
    check("is_likely_file for pdf", is_likely_file("https://example.com/d.pdf"))
    check("not is_likely_file for html page", not is_likely_file("https://example.com/page"))

    check("normalize_url absolute", normalize_url("https://a.com", "https://b.com/f") == "https://b.com/f")
    check("normalize_url relative", normalize_url("https://a.com/page/", "sub/file.pdf") == "https://a.com/page/sub/file.pdf")

    css = ".bg { background: url('/bg.png'); }"
    css_urls = extract_css_urls("https://example.com", css)
    check("CSS url() extraction", "https://example.com/bg.png" in css_urls)

    # ============================================================
    # SUMMARY
    # ============================================================
    total = passed + failed
    print("\n" + "=" * 70)
    print(f"E2E TEST RESULTS: {passed}/{total} passed, {failed} failed")
    print("=" * 70)

finally:
    teardown_test_environment()
    runner.teardown_databases(old_config)

sys.exit(0 if failed == 0 else 1)
