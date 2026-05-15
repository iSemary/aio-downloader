import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"

    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=16,
        choices=Role.choices,
        default=Role.ADMIN,
        db_index=True,
    )
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    def __str__(self) -> str:
        return self.email


class UserPreferences(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="preferences",
    )
    default_format = models.CharField(max_length=16, default="mp4")
    default_quality = models.CharField(max_length=32, default="best")
    default_engine = models.CharField(max_length=32, default="yt-dlp")
    storage_retention_days = models.PositiveIntegerField(
        default=7,
        help_text="Delete downloaded files after this many days (0 = keep forever). History rows are kept.",
    )
    auto_send_telegram = models.BooleanField(default=False)
    notify_on_complete = models.BooleanField(default=True)
    timezone = models.CharField(max_length=64, default="UTC")

    def __str__(self) -> str:
        return f"UserPreferences({self.user_id})"
