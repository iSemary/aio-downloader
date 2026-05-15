from rest_framework import serializers

from apps.downloader.models import DownloadJob

from .models import GrabberCrawlTask, GrabberDiscoveredFile, GrabberFilter, GrabberProject, SiteAccount


class GrabberFilterSerializer(serializers.ModelSerializer):
    class Meta:
        model = GrabberFilter
        fields = ("id", "filter_type", "target", "pattern", "is_regex", "created_at")
        read_only_fields = ("id", "created_at")


class GrabberCrawlTaskSerializer(serializers.ModelSerializer):
    children_count = serializers.SerializerMethodField()
    files_count = serializers.SerializerMethodField()

    class Meta:
        model = GrabberCrawlTask
        fields = (
            "id",
            "parent_id",
            "url",
            "depth",
            "title",
            "status",
            "http_status",
            "content_type",
            "content_size",
            "error_message",
            "discovered_at",
            "crawled_at",
            "children_count",
            "files_count",
        )
        read_only_fields = fields

    def get_children_count(self, obj):
        return obj.children.count()

    def get_files_count(self, obj):
        return obj.discovered_files.count()


class GrabberDiscoveredFileSerializer(serializers.ModelSerializer):
    download_job_id = serializers.UUIDField(source="download_job.id", read_only=True, allow_null=True)
    download_job_status = serializers.CharField(source="download_job.status", read_only=True, allow_null=True)

    class Meta:
        model = GrabberDiscoveredFile
        fields = (
            "id",
            "crawl_task_id",
            "file_url",
            "file_name",
            "file_size",
            "mime_type",
            "file_type",
            "extension",
            "page_url",
            "download_job_id",
            "download_job_status",
            "duplicate_of_id",
            "status",
            "checksum",
            "is_duplicate",
            "created_at",
        )
        read_only_fields = (
            "id",
            "download_job_id",
            "download_job_status",
            "duplicate_of_id",
            "checksum",
            "status",
            "is_duplicate",
            "created_at",
        )


class GrabberProjectListSerializer(serializers.ModelSerializer):
    filters = GrabberFilterSerializer(many=True, read_only=True)
    active_task_count = serializers.SerializerMethodField()

    class Meta:
        model = GrabberProject
        fields = (
            "id",
            "name",
            "start_url",
            "max_depth",
            "max_pages",
            "max_files",
            "status",
            "pages_crawled",
            "files_discovered",
            "files_downloaded",
            "bytes_downloaded",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
            "filters",
            "active_task_count",
        )
        read_only_fields = (
            "id",
            "status",
            "pages_crawled",
            "files_discovered",
            "files_downloaded",
            "bytes_downloaded",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
            "active_task_count",
        )

    def get_active_task_count(self, obj):
        return obj.crawl_tasks.filter(status__in=("pending", "crawling")).count()


class GrabberProjectDetailSerializer(serializers.ModelSerializer):
    filters = GrabberFilterSerializer(many=True, read_only=True)
    crawl_tasks_count = serializers.SerializerMethodField()
    discovered_files_count = serializers.SerializerMethodField()

    class Meta:
        model = GrabberProject
        fields = (
            "id",
            "name",
            "start_url",
            "max_depth",
            "max_pages",
            "max_files",
            "respect_robots_txt",
            "user_agent",
            "crawl_delay",
            "concurrency",
            "use_javascript",
            "auth_json",
            "schedule_cron",
            "rewrite_links",
            "status",
            "pages_crawled",
            "files_discovered",
            "files_downloaded",
            "bytes_downloaded",
            "celery_beat_task_name",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
            "filters",
            "crawl_tasks_count",
            "discovered_files_count",
        )
        read_only_fields = (
            "id",
            "status",
            "pages_crawled",
            "files_discovered",
            "files_downloaded",
            "bytes_downloaded",
            "celery_beat_task_name",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
            "crawl_tasks_count",
            "discovered_files_count",
        )

    def get_crawl_tasks_count(self, obj):
        return obj.crawl_tasks.count()

    def get_discovered_files_count(self, obj):
        return obj.discovered_files.count()


class GrabberStartStopSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("start", "stop", "pause", "resume"))


class GrabberDuplicateResolutionSerializer(serializers.Serializer):
    resolution = serializers.ChoiceField(choices=("skip", "redownload", "ask"))
    file_ids = serializers.ListField(child=serializers.UUIDField())


class FileDownloadSerializer(serializers.Serializer):
    file_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=100)


class SiteAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteAccount
        fields = (
            "id",
            "name",
            "site_url",
            "username",
            "password_encrypted",
            "cookies",
            "headers",
            "login_url",
            "login_method",
            "notes",
            "is_active",
            "last_used_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "last_used_at", "created_at", "updated_at")
        extra_kwargs = {
            "password_encrypted": {"write_only": True},
        }
