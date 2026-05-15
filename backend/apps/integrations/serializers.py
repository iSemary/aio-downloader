from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.integrations.crypto import encrypt_str
from apps.integrations.models import GoogleDriveConfig, TelegramConfig, TelegramSend

User = get_user_model()


class TelegramSendSerializer(serializers.ModelSerializer):
    class Meta:
        model = TelegramSend
        fields = (
            "id",
            "config",
            "file",
            "job",
            "status",
            "telegram_message_id",
            "telegram_file_id",
            "error_message",
            "attempt_count",
            "sent_at",
            "created_at",
        )
        read_only_fields = fields


class TelegramConfigSerializer(serializers.ModelSerializer):
    bot_token = serializers.CharField(write_only=True, required=False, allow_blank=True)
    bot_token_masked = serializers.SerializerMethodField(read_only=True)
    bot_configured = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TelegramConfig
        fields = (
            "id",
            "bot_token",
            "bot_token_masked",
            "bot_configured",
            "chat_id",
            "chat_username",
            "chat_type",
            "auto_send",
            "enabled",
            "max_file_size_mb",
            "use_local_bot_api",
            "local_bot_api_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "bot_token_masked", "bot_configured", "created_at", "updated_at")

    def get_bot_configured(self, obj: TelegramConfig) -> bool:
        from apps.integrations.telegram import owner_has_bot_token

        return owner_has_bot_token()

    def get_bot_token_masked(self, obj: TelegramConfig) -> str:
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if user and getattr(user, "is_authenticated", False) and user.role != User.Role.OWNER:
            return ""
        if not obj.bot_token_encrypted:
            return ""
        return "********"

    def update(self, instance, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        is_owner = bool(
            user and getattr(user, "is_authenticated", False) and user.role == User.Role.OWNER,
        )

        if "bot_token" in validated_data:
            token = validated_data.pop("bot_token")
            if not is_owner:
                if token:
                    raise PermissionDenied("Only the project owner may set the Telegram bot token.")
            elif token:
                instance.bot_token_encrypted = encrypt_str(token)

        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


class GoogleDriveConfigSerializer(serializers.ModelSerializer):
    connected = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = GoogleDriveConfig
        fields = (
            "id",
            "enabled",
            "root_folder_id",
            "auto_upload",
            "connected",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "connected", "created_at", "updated_at")

    def get_connected(self, obj: GoogleDriveConfig) -> bool:
        return bool(obj.credentials_encrypted and obj.credentials_encrypted.get("token"))
