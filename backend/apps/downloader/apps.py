from django.apps import AppConfig


class DownloaderConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.downloader"
    label = "downloader"

    def ready(self) -> None:
        from apps.downloader import signals  # noqa: F401
