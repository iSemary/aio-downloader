from django.contrib import admin

from .models import TelegramConfig, TelegramSend


@admin.register(TelegramConfig)
class TelegramConfigAdmin(admin.ModelAdmin):
    list_display = ("user", "chat_id", "auto_send", "enabled", "max_file_size_mb", "use_local_bot_api")


@admin.register(TelegramSend)
class TelegramSendAdmin(admin.ModelAdmin):
    list_display = ("id", "job", "status", "sent_at", "created_at")
    list_filter = ("status",)
