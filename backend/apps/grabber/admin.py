from django.contrib import admin

from .models import GrabberCrawlTask, GrabberDiscoveredFile, GrabberFilter, GrabberProject, SiteAccount


@admin.register(GrabberProject)
class GrabberProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "status", "pages_crawled", "files_discovered", "created_at")
    list_filter = ("status",)
    search_fields = ("name", "start_url", "user__email")


@admin.register(GrabberFilter)
class GrabberFilterAdmin(admin.ModelAdmin):
    list_display = ("project", "filter_type", "target", "pattern")
    list_filter = ("filter_type", "target")


@admin.register(GrabberCrawlTask)
class GrabberCrawlTaskAdmin(admin.ModelAdmin):
    list_display = ("url", "project", "depth", "status")
    list_filter = ("status", "depth")


@admin.register(GrabberDiscoveredFile)
class GrabberDiscoveredFileAdmin(admin.ModelAdmin):
    list_display = ("file_name", "file_type", "file_size", "project", "status")
    list_filter = ("file_type", "status")


@admin.register(SiteAccount)
class SiteAccountAdmin(admin.ModelAdmin):
    list_display = ("name", "site_url", "user", "login_method", "is_active", "created_at")
    list_filter = ("login_method", "is_active")
    search_fields = ("name", "site_url", "username")
