import uuid

from django.conf import settings
from django.db import models


class DownloadJob(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        DOWNLOADING = "downloading", "Downloading"
        PROCESSING = "processing", "Processing"
        DONE = "done", "Done"
        ERROR = "error", "Error"
        CANCELLED = "cancelled", "Cancelled"
        PAUSED = "paused", "Paused"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="download_jobs",
    )
    url = models.TextField()
    title = models.CharField(max_length=512, blank=True, default="")
    platform = models.CharField(max_length=64, blank=True, default="generic")
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.PENDING,
    )
    progress = models.PositiveSmallIntegerField(default=0)
    speed = models.CharField(max_length=64, blank=True, default="")
    eta = models.CharField(max_length=64, blank=True, default="")
    file_path = models.CharField(max_length=1024, blank=True, default="")
    file_size = models.BigIntegerField(default=0)
    format = models.CharField(max_length=16, blank=True, default="mp4")
    quality = models.CharField(max_length=32, blank=True, default="best")
    error_message = models.TextField(blank=True, null=True)
    sent_to_telegram = models.BooleanField(default=False)
    celery_task_id = models.CharField(max_length=255, blank=True, default="")
    playlist_parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="playlist_entries",
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the file finished downloading (used for retention).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.title or self.url[:40]} ({self.status})"
