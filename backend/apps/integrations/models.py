from django.conf import settings
from django.db import models


class TelegramConfig(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="telegram_config",
    )
    bot_token_encrypted = models.TextField(blank=True, default="")
    chat_id = models.CharField(max_length=128, blank=True, default="")
    auto_send = models.BooleanField(default=False)
    enabled = models.BooleanField(default=True)

    def __str__(self) -> str:
        return f"TelegramConfig({self.user_id})"
