from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.grabber.filters import FilterEngine, classify_file_extension
from apps.grabber.models import GrabberFilter, GrabberProject

User = get_user_model()


class FilterEngineTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="filtereng@test.example",
            email="filtereng@test.example",
            password="secret12345",
        )
        self.project = GrabberProject.objects.create(
            user=self.user,
            name="Filter Engine Test",
            start_url="https://example.com",
        )

    def test_no_filters_allows_all(self):
        engine = FilterEngine(self.project)
        self.assertTrue(engine.should_crawl_url("https://example.com/any"))

    def test_include_filter_allows_matching(self):
        GrabberFilter.objects.create(
            project=self.project, filter_type="include",
            target="file_type", pattern="*.mp4",
        )
        engine = FilterEngine(self.project)
        self.assertTrue(engine.should_download_file("https://example.com/v.mp4", "mp4"))
        self.assertFalse(engine.should_download_file("https://example.com/doc.pdf", "pdf"))

    def test_exclude_filter_blocks_matching(self):
        GrabberFilter.objects.create(
            project=self.project, filter_type="exclude",
            target="domain", pattern="ads.example.com",
        )
        engine = FilterEngine(self.project)
        self.assertFalse(engine.should_crawl_url("https://ads.example.com/tracker"))
        self.assertTrue(engine.should_crawl_url("https://example.com/good"))

    def test_include_exclude_combination(self):
        GrabberFilter.objects.create(
            project=self.project, filter_type="include",
            target="file_type", pattern="*.mp4",
        )
        GrabberFilter.objects.create(
            project=self.project, filter_type="exclude",
            target="domain", pattern="tracker.example.com",
        )
        engine = FilterEngine(self.project)
        self.assertTrue(engine.should_download_file("https://example.com/v.mp4", "mp4"))
        self.assertFalse(engine.should_download_file("https://tracker.example.com/v.mp4", "mp4"))
        self.assertFalse(engine.should_download_file("https://example.com/d.pdf", "pdf"))

    def test_keyword_filter(self):
        GrabberFilter.objects.create(
            project=self.project, filter_type="include",
            target="keyword", pattern="download",
        )
        engine = FilterEngine(self.project)
        self.assertTrue(engine.should_crawl_url("https://example.com/download/file"))
        self.assertFalse(engine.should_crawl_url("https://example.com/about"))

    def test_regex_pattern(self):
        GrabberFilter.objects.create(
            project=self.project, filter_type="include",
            target="file_type", pattern=r"\.(mp4|webm)$",
            is_regex=True,
        )
        engine = FilterEngine(self.project)
        self.assertTrue(engine.should_download_file("https://example.com/v.mp4", "mp4"))
        self.assertTrue(engine.should_download_file("https://example.com/v.webm", "webm"))
        self.assertFalse(engine.should_download_file("https://example.com/v.pdf", "pdf"))

    def test_file_size_filter(self):
        GrabberFilter.objects.create(
            project=self.project, filter_type="exclude",
            target="file_size", pattern="0",
        )
        engine = FilterEngine(self.project)
        self.assertFalse(engine.should_download_file("https://example.com/f.mp4", "mp4", 0))
        self.assertTrue(engine.should_download_file("https://example.com/f.mp4", "mp4", 1024))

    def test_url_filter(self):
        GrabberFilter.objects.create(
            project=self.project, filter_type="include",
            target="url", pattern="*/media/*",
        )
        engine = FilterEngine(self.project)
        self.assertTrue(engine.should_crawl_url("https://example.com/media/video"))
        self.assertFalse(engine.should_crawl_url("https://example.com/about"))


class ClassifyFileExtensionTests(TestCase):
    def test_image_extensions(self):
        self.assertEqual(classify_file_extension("jpg"), "image")
        self.assertEqual(classify_file_extension("JPEG"), "image")
        self.assertEqual(classify_file_extension("png"), "image")
        self.assertEqual(classify_file_extension(".webp"), "image")

    def test_video_extensions(self):
        self.assertEqual(classify_file_extension("mp4"), "video")
        self.assertEqual(classify_file_extension("webm"), "video")
        self.assertEqual(classify_file_extension("mkv"), "video")

    def test_audio_extensions(self):
        self.assertEqual(classify_file_extension("mp3"), "audio")
        self.assertEqual(classify_file_extension("flac"), "audio")
        self.assertEqual(classify_file_extension("wav"), "audio")

    def test_document_extensions(self):
        self.assertEqual(classify_file_extension("pdf"), "document")
        self.assertEqual(classify_file_extension("docx"), "document")
        self.assertEqual(classify_file_extension("csv"), "document")

    def test_archive_extensions(self):
        self.assertEqual(classify_file_extension("zip"), "archive")
        self.assertEqual(classify_file_extension("rar"), "archive")
        self.assertEqual(classify_file_extension("tar.gz"), "other")  # not a single ext

    def test_unknown_extension(self):
        self.assertEqual(classify_file_extension("xyz"), "other")
        self.assertEqual(classify_file_extension(""), "other")
