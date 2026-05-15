"""
Shared Django settings for AIO Downloader.
"""
import os
from datetime import timedelta
from pathlib import Path

from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-dev-only-change-in-production",
)

DEBUG = False

ALLOWED_HOSTS: list[str] = []

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "channels",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    # Local apps
    "apps.auth_app",
    "apps.downloader",
    "apps.storage_manager",
    "apps.integrations",
    "apps.grabber",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "auth_app.User"

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_ROOT = BASE_DIR / "storage"
MEDIA_URL = "/media/"

# Redis / Channels / Celery
REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

CELERY_BEAT_SCHEDULE = {
    "cleanup-expired-download-files-daily": {
        "task": "apps.downloader.tasks.cleanup_expired_download_files",
        "schedule": crontab(hour=4, minute=17),
    },
    "cleanup-stale-crawls-hourly": {
        "task": "apps.grabber.tasks.cleanup_stale_crawls",
        "schedule": crontab(minute=0),
    },
    "cleanup-expired-grabber-files-daily": {
        "task": "apps.grabber.tasks.cleanup_expired_grabber_files",
        "schedule": crontab(hour=4, minute=47),
    },
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "config.exceptions.custom_exception_handler",
}

ACCESS_MIN = int(os.environ.get("ACCESS_TOKEN_LIFETIME_MINUTES", "15"))
REFRESH_DAYS = int(os.environ.get("REFRESH_TOKEN_LIFETIME_DAYS", "7"))

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=ACCESS_MIN),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=REFRESH_DAYS),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

# Fernet key for Telegram bot token encryption (url-safe base64, 32 bytes)
ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", "")

# Direct HTTP downloader (SSRF-guarded; size / redirect limits)
DOWNLOAD_HTTP_MAX_BYTES = int(os.environ.get("DOWNLOAD_HTTP_MAX_BYTES", str(5 * 1024**3)))
DOWNLOAD_HTTP_MAX_REDIRECTS = int(os.environ.get("DOWNLOAD_HTTP_MAX_REDIRECTS", "8"))
DOWNLOAD_HTTP_CHUNK_BYTES = int(os.environ.get("DOWNLOAD_HTTP_CHUNK_BYTES", str(256 * 1024)))
DOWNLOAD_HTTP_MAX_CONNECTIONS_PER_FILE = int(os.environ.get("DOWNLOAD_HTTP_MAX_CONNECTIONS_PER_FILE", "8"))
