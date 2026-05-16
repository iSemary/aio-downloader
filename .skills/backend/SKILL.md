---
name: aio-downloader-backend
description: >-
  Implements and maintains the AIO Downloader Django 6 backend (DRF, models,
  serializers, views, URLs, authentication, admin). Use when editing
  backend/apps, adding API endpoints, changing models, writing migrations,
  or when the user mentions the API, backend, database, or admin.
---

# AIO Downloader — Backend

## Stack

- **Django 6** + **Django REST Framework**, **Python 3.14**
- **Database**: SQLite dev / PostgreSQL prod
- **Auth**: Simple JWT (access + refresh tokens), custom user model (email as username, UUID PK)
- **ASGI**: Daphne for HTTP + WebSocket
- **Celery**: async task queue with Redis broker
- **Django Channels**: WebSocket via Redis channel layer

## App structure (`backend/apps/`)

| App | Purpose |
|-----|---------|
| `auth_app/` | Custom user model, register/login/logout/refresh, profile, preferences, roles (Owner/Admin) |
| `downloader/` | Download jobs, file management, queue, events, playlists, yt-dlp + HTTP engines, dashboard stats |
| `grabber/` | Site crawling projects, discovered files, filters, logs, site accounts |
| `integrations/` | Telegram bot config + send, Google Drive OAuth + upload |
| `storage_manager/` | File listing, disk stats, deletion |

## Conventions

- **API prefix**: all routes under `/api/` (defined in `config/urls.py` including nested routers)
- **Views**: DRF `ModelViewSet` with `permission_classes = [IsAuthenticated]`; custom actions via `@action(detail=True/False)`
- **Serializers**: DRF `ModelSerializer`; nest read-only fields where sensible
- **Permissions**: Custom per-object checks in views (`request.user == obj.user`); `IsAuthenticated` globally
- **Pagination**: `PageNumberPagination`, default `page_size = 50`
- **Filters**: `django-filter` + `SearchFilter`, `OrderingFilter`
- **Error handling**: Custom `exception_handler` in `config/exceptions.py` returning `{"detail": ...}` or field errors
- **UUID PKs**: Every model uses UUID primary key
- **Soft delete**: Files use a `deleted` flag; `DownloadJob` status set to `cancelled`/`error` rather than deleting rows
- **Encryption at rest**: Fernet symmetric encryption for Telegram bot tokens and Google Drive OAuth tokens (via `config/token_auth.py`)
- **Signals**: Auto-create `UserPreferences` and `TelegramConfig` on user creation
- **Management commands**: `seed_test_user` for local dev (`manage.py seed_test_user`)

## Models

- Every model includes `id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)` and `created_at = models.DateTimeField(auto_now_add=True)`
- `updated_at` = `auto_now=True` on mutable models
- `FileField` / `FilePathField` paths are relative to `MEDIA_ROOT`
- Foreign keys use `related_name` (often `+` if no reverse needed)

## Migrations

- After model changes: `python manage.py makemigrations <app_name> && python manage.py migrate`
- Always review generated migration before committing

## Key files

| File | Purpose |
|------|---------|
| `config/settings/*.py` | Django settings split by environment |
| `config/urls.py` | Root URL conf + router registration |
| `config/asgi.py` | ASGI app for Daphne + Channels |
| `config/celery.py` | Celery app + periodic task discovery |
| `config/exceptions.py` | DRF custom exception handler |
| `config/token_auth.py` | Fernet encryption utility |

## Commands

```bash
cd backend && source venv/bin/activate && python manage.py runserver  # Dev server
cd backend && python manage.py makemigrations
cd backend && python manage.py migrate
cd backend && python manage.py seed_test_user
cd backend && python -m pytest apps/downloader/tests/  # Run tests
```
