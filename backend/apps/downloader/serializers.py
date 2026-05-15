from rest_framework import serializers

from .models import DownloadJob


class UrlAnalyzeSerializer(serializers.Serializer):
    url = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True, max_length=4096)


class DownloadJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = DownloadJob
        fields = (
            "id",
            "url",
            "title",
            "platform",
            "status",
            "progress",
            "speed",
            "eta",
            "file_path",
            "file_size",
            "format",
            "quality",
            "error_message",
            "sent_to_telegram",
            "created_at",
            "updated_at",
            "playlist_parent",
        )
        read_only_fields = fields


class DownloadJobCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DownloadJob
        fields = ("url", "format", "quality")
