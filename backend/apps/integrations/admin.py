from django.contrib import admin

from .models import TelegramConfig


@admin.register(TelegramConfig)
class TelegramConfigAdmin(admin.ModelAdmin):
    list_display = ("user", "chat_id", "auto_send", "enabled")
