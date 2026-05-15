from django.conf import settings
from django.db import models


class TelegramConfig(models.Model):
    class ChatType(models.TextChoices):
        PRIVATE = "private", "Private"
        GROUP = "group", "Group"
        CHANNEL = "channel", "Channel"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="telegram_config",
    )
    enabled = models.BooleanField(default=True)
    auto_send = models.BooleanField(default=False)
    bot_token_encrypted = models.TextField(blank=True, default="")
    chat_id = models.CharField(max_length=128, blank=True, default="")
    chat_username = models.CharField(max_length=128, blank=True, default="")
    chat_type = models.CharField(
        max_length=16,
        choices=ChatType.choices,
        default=ChatType.PRIVATE,
    )
    max_file_size_mb = models.PositiveIntegerField(default=50)
    use_local_bot_api = models.BooleanField(default=False)
    local_bot_api_url = models.URLField(max_length=512, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"TelegramConfig({self.user_id})"


class GoogleDriveConfig(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="gdrive_config",
    )
    enabled = models.BooleanField(default=False)
    credentials_encrypted = models.JSONField(default=dict, blank=True)
    root_folder_id = models.CharField(max_length=64, blank=True, default="")
    auto_upload = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"GoogleDriveConfig({self.user_id})"


class TelegramSend(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    config = models.ForeignKey(
        TelegramConfig,
        on_delete=models.CASCADE,
        related_name="sends",
    )
    file = models.ForeignKey(
        "downloader.DownloadedFile",
        on_delete=models.CASCADE,
        related_name="telegram_sends",
    )
    job = models.ForeignKey(
        "downloader.DownloadJob",
        on_delete=models.CASCADE,
        related_name="telegram_sends",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    telegram_message_id = models.CharField(max_length=128, blank=True, default="")
    telegram_file_id = models.CharField(max_length=256, blank=True, default="")
    error_message = models.TextField(blank=True, null=True)
    attempt_count = models.PositiveIntegerField(default=0)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("job", "status")),
            models.Index(fields=("config", "status")),
        ]

    def __str__(self) -> str:
        return f"TelegramSend({self.job_id}, {self.status})"
