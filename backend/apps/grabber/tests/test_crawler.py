from django.test import TestCase

from apps.grabber.crawler import (
    extract_css_urls,
    extract_file_links,
    extract_links_from_html,
    is_likely_file,
    normalize_url,
)


class NormalizeUrlTests(TestCase):
    def test_absolute_url(self):
        self.assertEqual(normalize_url("https://example.com", "https://other.com/page"), "https://other.com/page")

    def test_relative_url(self):
        self.assertEqual(normalize_url("https://example.com/page/", "sub/file.pdf"), "https://example.com/page/sub/file.pdf")

    def test_remove_fragment(self):
        self.assertEqual(normalize_url("https://example.com", "#section"), "https://example.com")

    def test_root_relative(self):
        self.assertEqual(normalize_url("https://example.com/page/", "/root/file.pdf"), "https://example.com/root/file.pdf")


class IsLikelyFileTests(TestCase):
    def test_video_extensions(self):
        self.assertTrue(is_likely_file("https://example.com/video.mp4"))
        self.assertTrue(is_likely_file("https://example.com/movie.avi?quality=hd"))

    def test_image_extensions(self):
        self.assertTrue(is_likely_file("https://example.com/photo.jpg"))
        self.assertTrue(is_likely_file("https://example.com/logo.png"))

    def test_not_a_file(self):
        self.assertFalse(is_likely_file("https://example.com/page"))
        self.assertFalse(is_likely_file("https://example.com/"))


class ExtractLinksFromHtmlTests(TestCase):
    def test_extract_a_tags(self):
        html = '<a href="/page1">Link 1</a><a href="https://other.com">Link 2</a>'
        links = extract_links_from_html("https://example.com", html)
        self.assertIn("https://example.com/page1", links)
        self.assertIn("https://other.com", links)

    def test_extract_img_tags(self):
        html = '<img src="/image.png"><img src="https://cdn.com/photo.jpg">'
        links = extract_links_from_html("https://example.com", html)
        self.assertIn("https://example.com/image.png", links)
        self.assertIn("https://cdn.com/photo.jpg", links)

    def test_extract_script_src(self):
        html = '<script src="/app.js"></script><script src="https://cdn.com/lib.js"></script>'
        links = extract_links_from_html("https://example.com", html)
        self.assertIn("https://example.com/app.js", links)
        self.assertIn("https://cdn.com/lib.js", links)

    def test_extract_link_tags(self):
        html = '<link rel="stylesheet" href="/style.css"><link href="https://cdn.com/theme.css">'
        links = extract_links_from_html("https://example.com", html)
        self.assertIn("https://example.com/style.css", links)
        self.assertIn("https://cdn.com/theme.css", links)

    def test_skip_javascript_links(self):
        html = '<a href="javascript:void(0)">Click</a>'
        links = extract_links_from_html("https://example.com", html)
        self.assertNotIn("javascript:void(0)", links)

    def test_skip_mailto_and_tel(self):
        html = '<a href="mailto:test@example.com">Email</a><a href="tel:+1234567890">Call</a>'
        links = extract_links_from_html("https://example.com", html)
        self.assertNotIn("mailto:test@example.com", links)
        self.assertNotIn("tel:+1234567890", links)

    def test_video_and_audio_tags(self):
        html = '<video src="/video.mp4"></video><audio src="/audio.mp3"></audio>'
        links = extract_links_from_html("https://example.com", html)
        self.assertIn("https://example.com/video.mp4", links)
        self.assertIn("https://example.com/audio.mp3", links)


class ExtractCssUrlsTests(TestCase):
    def test_css_url_pattern(self):
        css = "background: url('/bg.png');\nbackground-image: url('https://cdn.com/bg2.jpg');"
        urls = extract_css_urls("https://example.com", css)
        self.assertIn("https://example.com/bg.png", urls)
        self.assertIn("https://cdn.com/bg2.jpg", urls)

    def test_data_url_skipped(self):
        css = "background: url('data:image/png;base64,abc123');"
        urls = extract_css_urls("https://example.com", css)
        self.assertEqual(len(urls), 0)

    def test_hash_url_skipped(self):
        css = "background: url(#gradient);"
        urls = extract_css_urls("https://example.com", css)
        self.assertEqual(len(urls), 0)


class ExtractFileLinksTests(TestCase):
    def test_direct_file_links(self):
        html = '<a href="https://example.com/file.mp4">Download</a><a href="/doc.pdf">PDF</a>'
        files = extract_file_links("https://example.com", html)
        urls = {f["url"] for f in files}
        self.assertIn("https://example.com/file.mp4", urls)
        self.assertIn("https://example.com/doc.pdf", urls)

    def test_img_tags_as_files(self):
        html = '<img src="/photo.jpg" alt="Photo"><img src="/icon.png">'
        files = extract_file_links("https://example.com", html)
        self.assertEqual(len(files), 2)
        for f in files:
            self.assertEqual(f["file_type"], "image")

    def test_no_files_in_plain_html(self):
        html = "<html><body><p>No files here</p><a href='/about'>About</a></body></html>"
        files = extract_file_links("https://example.com", html)
        self.assertEqual(len(files), 0)

    def test_mixed_content_types(self):
        html = """
        <img src="/photo.jpg">
        <a href="/video.mp4">Video</a>
        <a href="/document.pdf">Doc</a>
        <audio src="/song.mp3"></audio>
        """
        files = extract_file_links("https://example.com", html)
        types = {f["file_type"] for f in files}
        self.assertIn("image", types)
        self.assertIn("video", types)
        self.assertIn("document", types)
        self.assertIn("audio", types)
