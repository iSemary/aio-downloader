from django.contrib import admin

from .models import DownloadJob, DownloadedFile, JobEvent, Playlist


class DownloadedFileInline(admin.TabularInline):
    model = DownloadedFile
    extra = 0


@admin.register(DownloadJob)
class DownloadJobAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "title", "platform", "status", "created_at")
    list_filter = ("status", "platform", "engine")
    search_fields = ("source_url", "title", "user__email")
    inlines = (DownloadedFileInline,)


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "title", "status", "total_count", "created_at")
    list_filter = ("status",)
    search_fields = ("source_url", "title", "user__email")


@admin.register(DownloadedFile)
class DownloadedFileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "job", "file_name", "file_size_bytes", "is_deleted", "created_at")
    list_filter = ("is_deleted", "storage_backend")


@admin.register(JobEvent)
class JobEventAdmin(admin.ModelAdmin):
    list_display = ("id", "job", "event_type", "created_at")
    list_filter = ("event_type",)
