import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    default_format = models.CharField(max_length=16, default="mp4")
    default_quality = models.CharField(max_length=32, default="best")
    storage_retention_days = models.PositiveIntegerField(
        default=7,
        help_text="Delete downloaded files after this many days (0 = keep forever). History rows are kept.",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    def __str__(self) -> str:
        return self.email
