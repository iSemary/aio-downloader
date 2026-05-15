from rest_framework import serializers

from .models import DownloadJob, DownloadJobMetrics, DownloadedFile, JobEvent, Playlist


class UrlAnalyzeSerializer(serializers.Serializer):
    url = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True, max_length=4096)


class DownloadJobMetricsSerializer(serializers.ModelSerializer):
    class Meta:
        model = DownloadJobMetrics
        fields = (
            "bytes_downloaded",
            "bytes_total",
            "progress_pct",
            "avg_speed_bps",
            "peak_speed_bps",
            "duration_seconds",
            "last_speed_str",
            "last_eta_str",
            "last_heartbeat",
            "partial_rel_path",
            "resume_etag",
            "resume_last_modified",
            "content_type",
        )
        read_only_fields = fields


class DownloadedFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DownloadedFile
        fields = (
            "id",
            "job",
            "file_path",
            "file_name",
            "mime_type",
            "file_size_bytes",
            "checksum_sha256",
            "storage_backend",
            "is_deleted",
            "expires_at",
            "created_at",
        )
        read_only_fields = fields


class JobEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobEvent
        fields = (
            "id",
            "job",
            "event_type",
            "message",
            "payload",
            "worker_id",
            "created_at",
        )
        read_only_fields = fields


class PlaylistMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Playlist
        fields = ("id", "title", "status", "source_url", "platform")


class DownloadJobSerializer(serializers.ModelSerializer):
    metrics = DownloadJobMetricsSerializer(read_only=True)
    files = DownloadedFileSerializer(many=True, read_only=True)
    playlist = PlaylistMinimalSerializer(read_only=True)
    url = serializers.CharField(source="source_url", read_only=True)
    progress = serializers.SerializerMethodField()
    speed = serializers.SerializerMethodField()
    eta = serializers.SerializerMethodField()
    file_size = serializers.SerializerMethodField()
    bytes_downloaded = serializers.SerializerMethodField()
    expected_size = serializers.SerializerMethodField()
    sent_to_telegram = serializers.SerializerMethodField()
    playlist_parent = serializers.SerializerMethodField()

    class Meta:
        model = DownloadJob
        fields = (
            "id",
            "source_url",
            "url",
            "title",
            "platform",
            "thumbnail_url",
            "duration_seconds",
            "status",
            "engine",
            "format",
            "quality",
            "media_kind",
            "error_message",
            "retry_count",
            "max_retries",
            "queue_order",
            "priority",
            "scheduled_at",
            "started_at",
            "completed_at",
            "http_connections",
            "playlist",
            "playlist_parent",
            "metrics",
            "files",
            "progress",
            "speed",
            "eta",
            "file_size",
            "bytes_downloaded",
            "expected_size",
            "sent_to_telegram",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def _metrics(self, obj: DownloadJob) -> DownloadJobMetrics | None:
        return getattr(obj, "metrics", None)

    def get_progress(self, obj: DownloadJob) -> int:
        m = self._metrics(obj)
        return int(m.progress_pct) if m else 0

    def get_speed(self, obj: DownloadJob) -> str:
        m = self._metrics(obj)
        return (m.last_speed_str or "") if m else ""

    def get_eta(self, obj: DownloadJob) -> str:
        m = self._metrics(obj)
        return (m.last_eta_str or "") if m else ""

    def get_bytes_downloaded(self, obj: DownloadJob) -> int:
        m = self._metrics(obj)
        return int(m.bytes_downloaded) if m else 0

    def get_expected_size(self, obj: DownloadJob) -> int:
        m = self._metrics(obj)
        return int(m.bytes_total) if m else 0

    def get_file_size(self, obj: DownloadJob) -> int:
        total = 0
        for f in obj.files.all():
            if not f.is_deleted:
                total += int(f.file_size_bytes or 0)
        return total

    def get_sent_to_telegram(self, obj: DownloadJob) -> bool:
        return obj.telegram_sends.filter(status="sent").exists()

    def get_playlist_parent(self, obj: DownloadJob):
        if obj.playlist_id:
            return str(obj.playlist_id)
        return None


class DownloadJobCreateSerializer(serializers.ModelSerializer):
    http_connections = serializers.IntegerField(required=False, min_value=1, max_value=8, default=1)
    url = serializers.CharField(write_only=True, required=False, allow_blank=False, max_length=4096)
    source_url = serializers.CharField(required=False, allow_blank=False, trim_whitespace=True, max_length=4096)

    class Meta:
        model = DownloadJob
        fields = ("source_url", "url", "format", "quality", "http_connections", "priority")

    def validate(self, attrs):
        raw = (attrs.pop("url", None) or attrs.get("source_url") or "").strip()
        if not raw:
            raise serializers.ValidationError({"source_url": "This field is required."})
        attrs["source_url"] = raw
        attrs.pop("url", None)
        return attrs


class DownloadBulkSerializer(serializers.Serializer):
    urls = serializers.ListField(
        child=serializers.CharField(max_length=4096, allow_blank=False),
        min_length=1,
        max_length=50,
    )
    format = serializers.CharField(required=False, default="mp4", max_length=16)
    quality = serializers.CharField(required=False, default="best", max_length=32)
    http_connections = serializers.IntegerField(required=False, min_value=1, max_value=8, default=1)


class DownloadReorderSerializer(serializers.Serializer):
    order = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
    )


class PlaylistSerializer(serializers.ModelSerializer):
    job_count = serializers.SerializerMethodField()

    class Meta:
        model = Playlist
        fields = (
            "id",
            "source_url",
            "title",
            "platform",
            "total_count",
            "completed_count",
            "failed_count",
            "status",
            "job_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_job_count(self, obj: Playlist) -> int:
        return obj.jobs.count()
