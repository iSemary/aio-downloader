from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_user_related(sender, instance, created, **kwargs):
    from apps.auth_app.models import UserPreferences
    from apps.integrations.models import TelegramConfig

    UserPreferences.objects.get_or_create(user=instance)
    TelegramConfig.objects.get_or_create(user=instance)
