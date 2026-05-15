from django.contrib import admin

from .models import DownloadJob


@admin.register(DownloadJob)
class DownloadJobAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "title", "platform", "status", "progress", "created_at")
    list_filter = ("status", "platform")
    search_fields = ("url", "title", "user__email")
