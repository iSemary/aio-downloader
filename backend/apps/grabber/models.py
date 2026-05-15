import uuid

from django.conf import settings
from django.db import models


class GrabberProject(models.Model):
    class Status(models.TextChoices):
        IDLE = "idle", "Idle"
        CRAWLING = "crawling", "Crawling"
        PAUSED = "paused", "Paused"
        DONE = "done", "Done"
        ERROR = "error", "Error"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="grabber_projects",
    )
    name = models.CharField(max_length=255)
    start_url = models.URLField(max_length=2048)
    max_depth = models.PositiveSmallIntegerField(
        default=3,
        help_text="Maximum crawl depth. 0 = current page only.",
    )
    max_pages = models.PositiveIntegerField(
        default=500,
        help_text="Maximum pages to crawl per project run.",
    )
    max_files = models.PositiveIntegerField(
        default=2000,
        help_text="Maximum files to discover per project run.",
    )
    respect_robots_txt = models.BooleanField(default=True)
    user_agent = models.CharField(
        max_length=512,
        blank=True,
        default="AIO-Grabber/1.0",
    )
    crawl_delay = models.FloatField(
        default=1.0,
        help_text="Seconds between successive requests to the same domain.",
    )
    concurrency = models.PositiveSmallIntegerField(
        default=3,
        help_text="Max concurrent crawl requests.",
    )
    use_javascript = models.BooleanField(
        default=False,
        help_text="Use Playwright for JavaScript-rendered pages.",
    )
    auth_json = models.JSONField(
        default=dict,
        blank=True,
        help_text="Stored as {\"type\": \"cookie|form\", \"cookies\": {...}, \"login_url\": \"...\", \"username\": \"...\", \"password_encrypted\": \"...\"}",
    )
    schedule_cron = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Optional cron expression for scheduled re-crawls (e.g. '0 2 * * *' for 2 AM daily).",
    )
    rewrite_links = models.BooleanField(
        default=False,
        help_text="Rewrite HTML href/src for offline browsing.",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.IDLE,
    )
    pages_crawled = models.PositiveIntegerField(default=0)
    files_discovered = models.PositiveIntegerField(default=0)
    files_downloaded = models.PositiveIntegerField(default=0)
    bytes_downloaded = models.BigIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    celery_beat_task_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Name of the periodic task for scheduled re-crawl (if schedule_cron is set).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("user", "status")),
            models.Index(fields=("user", "-created_at")),
        ]

    def __str__(self):
        return f"{self.name} ({self.status})"


class GrabberFilter(models.Model):
    class FilterType(models.TextChoices):
        INCLUDE = "include", "Include"
        EXCLUDE = "exclude", "Exclude"

    class Target(models.TextChoices):
        URL = "url", "URL Pattern"
        FILE_TYPE = "file_type", "File Extension"
        FILE_SIZE = "file_size", "File Size Range"
        DOMAIN = "domain", "Domain"
        KEYWORD = "keyword", "Keyword in URL/Title"

    project = models.ForeignKey(
        GrabberProject,
        on_delete=models.CASCADE,
        related_name="filters",
    )
    filter_type = models.CharField(max_length=10, choices=FilterType.choices)
    target = models.CharField(max_length=16, choices=Target.choices)
    pattern = models.CharField(
        max_length=512,
        help_text="Glob pattern (e.g. *.mp4, *.pdf) or regex if is_regex=True.",
    )
    is_regex = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("filter_type", "target")

    def __str__(self):
        return f"[{self.filter_type}] {self.target}: {self.pattern}"


class GrabberCrawlTask(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CRAWLING = "crawling", "Crawling"
        DONE = "done", "Done"
        ERROR = "error", "Error"
        SKIPPED = "skipped", "Skipped"

    project = models.ForeignKey(
        GrabberProject,
        on_delete=models.CASCADE,
        related_name="crawl_tasks",
    )
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="children",
    )
    url = models.URLField(max_length=2048)
    depth = models.PositiveSmallIntegerField(default=0)
    title = models.CharField(max_length=1024, blank=True, default="")
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    http_status = models.PositiveSmallIntegerField(null=True, blank=True)
    content_type = models.CharField(max_length=255, blank=True, default="")
    content_size = models.BigIntegerField(default=0)
    error_message = models.TextField(blank=True, default="")
    discovered_at = models.DateTimeField(auto_now_add=True)
    crawled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("depth", "-discovered_at")
        indexes = [
            models.Index(fields=("project", "depth")),
            models.Index(fields=("project", "status")),
            models.Index(fields=("url",), name="grabber_crawl_url_idx"),
        ]

    def __str__(self):
        return f"[L{self.depth}] {self.url[:60]} ({self.status})"


class GrabberDiscoveredFile(models.Model):
    class Status(models.TextChoices):
        DISCOVERED = "discovered", "Discovered"
        QUEUED = "queued", "Queued (Awaiting Download)"
        DOWNLOADED = "downloaded", "Downloaded"
        SKIPPED = "skipped", "Skipped"
        ERROR = "error", "Error"

    class FileType(models.TextChoices):
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"
        AUDIO = "audio", "Audio"
        DOCUMENT = "document", "Document"
        ARCHIVE = "archive", "Archive"
        OTHER = "other", "Other"

    FILE_EXTENSION_MAP = {
        "image": {"jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif"},
        "video": {"mp4", "webm", "avi", "mkv", "mov", "flv", "wmv", "m4v", "3gp"},
        "audio": {"mp3", "wav", "ogg", "flac", "aac", "wma", "m4a", "opus"},
        "document": {"pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "odt", "csv", "md"},
        "archive": {"zip", "rar", "7z", "tar", "gz", "bz2", "xz", "zst"},
    }

    project = models.ForeignKey(
        GrabberProject,
        on_delete=models.CASCADE,
        related_name="discovered_files",
    )
    crawl_task = models.ForeignKey(
        GrabberCrawlTask,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="discovered_files",
    )
    file_url = models.URLField(max_length=2048)
    file_name = models.CharField(max_length=1024, blank=True, default="")
    file_size = models.BigIntegerField(default=0)
    mime_type = models.CharField(max_length=255, blank=True, default="")
    file_type = models.CharField(
        max_length=16,
        choices=FileType.choices,
        default=FileType.OTHER,
    )
    extension = models.CharField(max_length=32, blank=True, default="")
    page_url = models.URLField(
        max_length=2048,
        blank=True,
        default="",
        help_text="The page URL where this file was discovered.",
    )
    download_job = models.ForeignKey(
        "downloader.DownloadJob",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="grabber_files",
        help_text="The DownloadJob created when the user decides to download this file.",
    )
    duplicate_of = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="duplicates",
        help_text="If set, this file is a duplicate of another (same SHA256).",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.DISCOVERED,
    )
    checksum = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="SHA256 of file content (set after download).",
    )
    is_duplicate = models.BooleanField(
        default=False,
        help_text="Flag indicating duplicate detection has been run.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("project", "file_type")),
            models.Index(fields=("project", "status")),
            models.Index(fields=("file_url",), name="grabber_file_url_idx"),
        ]

    def __str__(self):
        return f"{self.file_name or self.file_url[:50]} ({self.status})"
