# Operations (runtime processes)

## Processes you typically run in development

| Process | Command (from `backend/`) | Purpose |
|---------|---------------------------|---------|
| **Django ASGI** | `daphne -b 0.0.0.0 -p 8000 config.asgi:application` | HTTP API + **WebSocket** consumers (`DJANGO_SETTINGS_MODULE=config.settings.development`). |
| **Celery worker** | `celery -A config worker -l info` | Download tasks (`download_video_task`, `download_http_task`), playlist fan-out, Telegram side effects. |
| **Celery beat** | `celery -A config beat -l info` | Scheduled jobs (e.g. retention cleanup in `CELERY_BEAT_SCHEDULE`). |
| **Vite** | `npm run dev` in `frontend/` | SPA dev server (default port 5173). |

Without a **Celery worker**, jobs stay `pending`. Without **Daphne** (or another ASGI server), WebSockets for progress will not work.

## Redis

- **Broker + result backend** for Celery (`CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`).
- **Channel layer** for Django Channels (`CHANNEL_LAYERS` → `channels_redis`).

Default URL: `REDIS_URL` (see `backend/.env.example`).

## In-memory Channels (no Redis)

Set `USE_INMEMORY_CHANNELS=1` so the channel layer runs in-process. **Limitation:** Celery runs in a separate process, so **progress events from workers will not reach** browser WebSockets unless you also run workers in-process (not typical). Prefer Redis for real download progress.

## Settings modules

- `config.settings.development` — SQLite, dev-friendly defaults.
- `config.settings.production` — MySQL via `MYSQL_*` env vars, stricter defaults.

`DJANGO_SETTINGS_MODULE` must point at one of these (see `backend/manage.py` and deployment docs in root `README.md`).

## Related code

- `backend/config/asgi.py` — ASGI entry, HTTP + WebSocket routing.
- `backend/config/celery.py` — Celery app and autodiscover.
- `backend/config/settings/base.py` — shared settings, `CELERY_BEAT_SCHEDULE`, download HTTP limits.
