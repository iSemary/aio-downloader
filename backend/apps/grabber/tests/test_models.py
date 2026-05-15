from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.grabber.models import GrabberCrawlTask, GrabberDiscoveredFile, GrabberFilter, GrabberProject

User = get_user_model()


class GrabberProjectModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="grabber@test.example",
            email="grabber@test.example",
            password="secret12345",
        )

    def test_create_project(self):
        project = GrabberProject.objects.create(
            user=self.user,
            name="Test Project",
            start_url="https://example.com",
            max_depth=2,
        )
        self.assertEqual(project.name, "Test Project")
        self.assertEqual(project.status, GrabberProject.Status.IDLE)
        self.assertEqual(project.max_depth, 2)
        self.assertEqual(project.pages_crawled, 0)
        self.assertEqual(project.files_discovered, 0)

    def test_project_str(self):
        project = GrabberProject.objects.create(
            user=self.user,
            name="My Crawl",
            start_url="https://example.com",
        )
        self.assertIn("My Crawl (idle)", str(project))

    def test_project_default_values(self):
        project = GrabberProject.objects.create(
            user=self.user,
            name="Defaults",
            start_url="https://example.com",
        )
        self.assertEqual(project.max_depth, 3)
        self.assertEqual(project.max_pages, 500)
        self.assertEqual(project.max_files, 2000)
        self.assertTrue(project.respect_robots_txt)
        self.assertFalse(project.use_javascript)
        self.assertFalse(project.rewrite_links)

    def test_project_status_choices(self):
        for status_code, _ in GrabberProject.Status.choices:
            project = GrabberProject.objects.create(
                user=self.user,
                name=f"Status {status_code}",
                start_url="https://example.com",
                status=status_code,
            )
            self.assertEqual(project.status, status_code)


class GrabberFilterModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="filter@test.example",
            email="filter@test.example",
            password="secret12345",
        )
        self.project = GrabberProject.objects.create(
            user=self.user,
            name="Filter Test",
            start_url="https://example.com",
        )

    def test_create_include_filter(self):
        f = GrabberFilter.objects.create(
            project=self.project,
            filter_type=GrabberFilter.FilterType.INCLUDE,
            target=GrabberFilter.Target.FILE_TYPE,
            pattern="*.mp4",
        )
        self.assertEqual(f.filter_type, "include")
        self.assertEqual(f.target, "file_type")
        self.assertEqual(f.pattern, "*.mp4")
        self.assertFalse(f.is_regex)

    def test_create_exclude_filter(self):
        f = GrabberFilter.objects.create(
            project=self.project,
            filter_type=GrabberFilter.FilterType.EXCLUDE,
            target=GrabberFilter.Target.DOMAIN,
            pattern="ads.example.com",
        )
        self.assertEqual(f.filter_type, "exclude")

    def test_filter_str(self):
        f = GrabberFilter.objects.create(
            project=self.project,
            filter_type="include",
            target="file_type",
            pattern="*.pdf",
        )
        self.assertIn("[include]", str(f))
        self.assertIn("*.pdf", str(f))


class GrabberCrawlTaskModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="crawltask@test.example",
            email="crawltask@test.example",
            password="secret12345",
        )
        self.project = GrabberProject.objects.create(
            user=self.user,
            name="Crawl Task Test",
            start_url="https://example.com",
        )

    def test_create_crawl_task(self):
        task = GrabberCrawlTask.objects.create(
            project=self.project,
            url="https://example.com/page1",
            depth=0,
            status=GrabberCrawlTask.Status.PENDING,
        )
        self.assertEqual(task.url, "https://example.com/page1")
        self.assertEqual(task.depth, 0)
        self.assertEqual(task.status, "pending")

    def test_crawl_task_with_parent(self):
        parent = GrabberCrawlTask.objects.create(
            project=self.project,
            url="https://example.com",
            depth=0,
        )
        child = GrabberCrawlTask.objects.create(
            project=self.project,
            parent=parent,
            url="https://example.com/page2",
            depth=1,
        )
        self.assertEqual(child.parent, parent)
        self.assertIn(child, parent.children.all())

    def test_crawl_task_str(self):
        task = GrabberCrawlTask.objects.create(
            project=self.project,
            url="https://example.com/very-long-url-that-should-be-truncated",
            depth=2,
        )
        self.assertIn("[L2]", str(task))


class GrabberDiscoveredFileModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="discovered@test.example",
            email="discovered@test.example",
            password="secret12345",
        )
        self.project = GrabberProject.objects.create(
            user=self.user,
            name="Discovered File Test",
            start_url="https://example.com",
        )
        self.task = GrabberCrawlTask.objects.create(
            project=self.project,
            url="https://example.com/page",
            depth=1,
        )

    def test_create_discovered_file(self):
        f = GrabberDiscoveredFile.objects.create(
            project=self.project,
            crawl_task=self.task,
            file_url="https://example.com/video.mp4",
            file_name="video.mp4",
            file_size=1024000,
            file_type=GrabberDiscoveredFile.FileType.VIDEO,
            extension="mp4",
            page_url="https://example.com/page",
        )
        self.assertEqual(f.file_type, "video")
        self.assertEqual(f.status, "discovered")
        self.assertEqual(f.file_size, 1024000)

    def test_file_type_choices(self):
        for ft_code, _ in GrabberDiscoveredFile.FileType.choices:
            f = GrabberDiscoveredFile.objects.create(
                project=self.project,
                crawl_task=self.task,
                file_url=f"https://example.com/file.{ft_code}",
                file_name=f"file.{ft_code}",
                file_type=ft_code,
                extension=ft_code,
            )
            self.assertEqual(f.file_type, ft_code)

    def test_discovered_file_str(self):
        f = GrabberDiscoveredFile.objects.create(
            project=self.project,
            crawl_task=self.task,
            file_url="https://example.com/doc.pdf",
            file_name="doc.pdf",
            file_type="document",
            extension="pdf",
        )
        self.assertIn("doc.pdf (discovered)", str(f))

    def test_duplicate_detection(self):
        f1 = GrabberDiscoveredFile.objects.create(
            project=self.project,
            crawl_task=self.task,
            file_url="https://example.com/file.pdf",
            file_name="file.pdf",
            file_type="document",
            extension="pdf",
        )
        f2 = GrabberDiscoveredFile.objects.create(
            project=self.project,
            crawl_task=self.task,
            file_url="https://example.com/file-copy.pdf",
            file_name="file-copy.pdf",
            file_type="document",
            extension="pdf",
            duplicate_of=f1,
            is_duplicate=True,
        )
        self.assertEqual(f2.duplicate_of, f1)
        self.assertTrue(f2.is_duplicate)
        self.assertIn(f2, f1.duplicates.all())
