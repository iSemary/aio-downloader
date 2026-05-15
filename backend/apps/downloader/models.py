import uuid

from django.conf import settings
from django.db import models


# Extensible engine identifiers (no DB enum constraint beyond max_length)
ENGINE_YTDLP = "yt-dlp"
ENGINE_HTTP = "http"


class Playlist(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PARTIAL = "partial", "Partial"
        DONE = "done", "Done"
        ERROR = "error", "Error"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="playlists",
    )
    source_url = models.TextField()
    title = models.CharField(max_length=512, blank=True, default="")
    platform = models.CharField(max_length=128, blank=True, default="")
    total_count = models.PositiveIntegerField(default=0)
    completed_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.title or self.source_url[:40]} ({self.status})"


class DownloadJob(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        QUEUED = "queued", "Queued"
        DOWNLOADING = "downloading", "Downloading"
        PROCESSING = "processing", "Processing"
        DONE = "done", "Done"
        ERROR = "error", "Error"
        CANCELLED = "cancelled", "Cancelled"
        PAUSED = "paused", "Paused"

    class MediaKind(models.TextChoices):
        VIDEO = "video", "Video"
        AUDIO = "audio", "Audio"
        IMAGE = "image", "Image"
        DOCUMENT = "document", "Document"
        ARCHIVE = "archive", "Archive"
        OTHER = "other", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="download_jobs",
    )
    playlist = models.ForeignKey(
        Playlist,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="jobs",
    )
    source_url = models.TextField()
    title = models.CharField(max_length=512, blank=True, default="")
    platform = models.CharField(max_length=128, blank=True, default="")
    thumbnail_url = models.URLField(max_length=2048, blank=True, default="")
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.PENDING,
    )
    engine = models.CharField(max_length=32, default=ENGINE_YTDLP)
    format = models.CharField(max_length=16, blank=True, default="mp4")
    quality = models.CharField(max_length=32, blank=True, default="best")
    media_kind = models.CharField(
        max_length=32,
        choices=MediaKind.choices,
        default=MediaKind.OTHER,
    )
    error_message = models.TextField(blank=True, null=True)
    retry_count = models.PositiveIntegerField(default=0)
    max_retries = models.PositiveIntegerField(default=3)
    queue_order = models.IntegerField(default=0)
    priority = models.PositiveSmallIntegerField(default=0)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the download finished (used for retention).",
    )
    celery_task_id = models.CharField(max_length=255, blank=True, default="")
    http_connections = models.PositiveSmallIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("user", "status", "-created_at")),
            models.Index(fields=("user", "queue_order")),
            models.Index(fields=("user", "playlist")),
        ]

    def __str__(self) -> str:
        return f"{self.title or self.source_url[:40]} ({self.status})"


class DownloadJobMetrics(models.Model):
    job = models.OneToOneField(
        DownloadJob,
        on_delete=models.CASCADE,
        related_name="metrics",
    )
    bytes_downloaded = models.BigIntegerField(default=0)
    bytes_total = models.BigIntegerField(default=0)
    progress_pct = models.PositiveSmallIntegerField(default=0)
    avg_speed_bps = models.FloatField(null=True, blank=True)
    peak_speed_bps = models.FloatField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)
    last_speed_str = models.CharField(max_length=64, blank=True, default="")
    last_eta_str = models.CharField(max_length=64, blank=True, default="")
    last_heartbeat = models.DateTimeField(null=True, blank=True)
    # HTTP engine: staging path and resume metadata (also used during active download)
    partial_rel_path = models.CharField(max_length=1024, blank=True, default="")
    resume_etag = models.CharField(max_length=255, blank=True, default="")
    resume_last_modified = models.CharField(max_length=255, blank=True, default="")
    content_type = models.CharField(max_length=255, blank=True, default="")

    def __str__(self) -> str:
        return f"DownloadJobMetrics({self.job_id})"


class DownloadedFile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(
        DownloadJob,
        on_delete=models.CASCADE,
        related_name="files",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="downloaded_files",
    )
    file_path = models.CharField(max_length=1024)
    file_name = models.CharField(max_length=512, blank=True, default="")
    mime_type = models.CharField(max_length=255, blank=True, default="")
    file_size_bytes = models.BigIntegerField(default=0)
    checksum_sha256 = models.CharField(max_length=64, blank=True, default="")
    storage_backend = models.CharField(max_length=16, default="local")
    is_deleted = models.BooleanField(default=False)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("user", "is_deleted", "-created_at")),
            models.Index(fields=("job",)),
        ]

    def __str__(self) -> str:
        return self.file_name or self.file_path[:48]


class JobEvent(models.Model):
    class EventType(models.TextChoices):
        CREATED = "created", "Created"
        QUEUED = "queued", "Queued"
        STARTED = "started", "Started"
        PROGRESS = "progress", "Progress"
        RETRIED = "retried", "Retried"
        DONE = "done", "Done"
        ERROR = "error", "Error"
        CANCELLED = "cancelled", "Cancelled"

    job = models.ForeignKey(
        DownloadJob,
        on_delete=models.CASCADE,
        related_name="events",
    )
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    message = models.TextField(blank=True, default="")
    payload = models.JSONField(default=dict, blank=True)
    worker_id = models.CharField(max_length=128, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        indexes = [models.Index(fields=("job", "created_at"))]

    def __str__(self) -> str:
        return f"JobEvent({self.job_id}, {self.event_type})"
