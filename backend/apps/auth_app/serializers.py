from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.auth_app.models import UserPreferences

User = get_user_model()


class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = (
            "default_format",
            "default_quality",
            "default_engine",
            "storage_retention_days",
            "auto_send_telegram",
            "notify_on_complete",
            "timezone",
        )

    def validate_storage_retention_days(self, value):
        if value < 0 or value > 3650:
            raise serializers.ValidationError("Must be between 0 and 3650.")
        return value


class UserSerializer(serializers.ModelSerializer):
    preferences = UserPreferencesSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "uuid",
            "email",
            "role",
            "first_name",
            "last_name",
            "date_joined",
            "preferences",
        )
        read_only_fields = ("id", "uuid", "email", "role", "date_joined")


class UserUpdateSerializer(serializers.ModelSerializer):
    preferences = UserPreferencesSerializer(required=False, partial=True)

    class Meta:
        model = User
        fields = ("first_name", "last_name", "preferences")

    def update(self, instance, validated_data):
        prefs_data = validated_data.pop("preferences", None)
        instance = super().update(instance, validated_data)
        if prefs_data is not None:
            prefs, _ = UserPreferences.objects.get_or_create(user=instance)
            for key, value in prefs_data.items():
                setattr(prefs, key, value)
            prefs.save()
        return instance


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Passwords do not match."})
        return attrs

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("email", "password", "password_confirm", "first_name", "last_name")

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        email = validated_data["email"]
        base = email.split("@")[0].replace(".", "_")[:100] or "user"
        username = base
        n = 0
        while User.objects.filter(username=username).exists():
            n += 1
            username = f"{base}_{n}"[:150]
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            role=User.Role.ADMIN,
            **validated_data,
        )
        return user
