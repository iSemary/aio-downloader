# AIO Downloader — Backend

Django 6 project exposing a JSON API for auth, download jobs, on-disk storage metadata, and Telegram integration. Heavy work runs in **Celery**; live progress uses **Django Channels** + **Redis**.

## Layout

```
apps/
  auth_app/          Custom User (email login), JWT views, `seed_test_user` command
  downloader/      DownloadJob model, yt-dlp wrapper, Celery tasks, WebSocket consumer
  storage_manager/ Lists/deletes files under MEDIA_ROOT scoped to the user’s jobs
  integrations/    TelegramConfig (encrypted token), push + test helpers
config/
  settings/        base.py (shared), development.py (SQLite, DEBUG), production.py (MySQL)
  asgi.py          HTTP + WebSocket (JWT query auth for WS)
  celery.py        Celery app; loaded from config/__init__.py
  urls.py          /api/auth/, /api/downloads/, /api/storage/, /api/integrations/
manage.py          Defaults to config.settings.development
requirements.txt
storage/           Download output (gitignored except .gitkeep)
```

## Setup

```bash
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_test_user   # optional dev user; see root README
```

## Run (development)

**ASGI server** (needed for WebSockets; `runserver` is not recommended for Channels):

```bash
DJANGO_SETTINGS_MODULE=config.settings.development daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

**Celery worker:**

```bash
celery -A config worker --loglevel=info
```

Redis must match `REDIS_URL` in `.env` unless you set `USE_INMEMORY_CHANNELS=1` (development only; WS updates from workers will not cross processes).

## Environment (summary)

See [`.env.example`](.env.example) for the full list. Important entries:

| Variable | Role |
| --- | --- |
| `DJANGO_SETTINGS_MODULE` | `config.settings.development` or `.production` |
| `DJANGO_SECRET_KEY` | Required for signing; use a long random value in production |
| `REDIS_URL` | Broker + Channels + Celery results |
| `USE_INMEMORY_CHANNELS` | `1` to skip Redis for channel layer (dev tradeoff) |
| `ENCRYPTION_KEY` | Fernet-related material for Telegram token encryption (optional in dev) |
| `MYSQL_*` | Used only when `DJANGO_SETTINGS_MODULE=config.settings.production` |
| `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` | Defaults for `seed_test_user` |

MySQL client library: **PyMySQL** is installed and `pymysql.install_as_MySQLdb()` runs only in **production** settings so SQLite dev does not require MySQL drivers.

## API prefix

All app routes are under **`/api/`** (e.g. `POST /api/auth/login/`, `POST /api/downloads/`, `GET /api/storage/stats/`).

## Management commands

| Command | Description |
| --- | --- |
| `python manage.py seed_test_user` | Create `test@example.com` / `testpassword123` if missing |
| `python manage.py seed_test_user --force` | Reset password for that user |

## Security notes

- JWT access/refresh; refresh blacklist on logout.
- Telegram bot tokens encrypted at rest (Fernet-style key handling in `apps/integrations/crypto.py`).
- Storage delete checks that the file path belongs to the requesting user’s `DownloadJob`.

## Related docs

- Full stack + test credentials: **[../README.md](../README.md)**
- SPA env and structure: **[../frontend/README.md](../frontend/README.md)**
