from rest_framework import serializers

from apps.integrations.crypto import encrypt_str
from apps.integrations.models import TelegramConfig


class TelegramConfigSerializer(serializers.ModelSerializer):
    bot_token = serializers.CharField(write_only=True, required=False, allow_blank=True)
    bot_token_masked = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TelegramConfig
        fields = (
            "id",
            "bot_token",
            "bot_token_masked",
            "chat_id",
            "auto_send",
            "enabled",
        )
        read_only_fields = ("id", "bot_token_masked")

    def get_bot_token_masked(self, obj: TelegramConfig) -> str:
        if not obj.bot_token_encrypted:
            return ""
        return "********"

    def update(self, instance, validated_data):
        token = validated_data.pop("bot_token", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if token:
            instance.bot_token_encrypted = encrypt_str(token)
        instance.save()
        return instance
