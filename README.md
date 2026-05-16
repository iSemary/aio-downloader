# AIO Downloader

Self-hosted files downloader: paste a URL, download with **yt-dlp** + **FFmpeg** for videos, track progress over **WebSocket**, manage files, and optionally push to **Telegram** and **Google Drive**.

| Area | Stack |
| --- | --- |
| API | Django 6, Django REST Framework, JWT |
| Realtime | Django Channels, Redis channel layer |
| Workers | Celery, Redis broker |
| UI | React 19, Vite, Tailwind 4, shadcn/ui, Zustand, Recharts |

More detail: **[backend/README.md](backend/README.md)** · **[frontend/README.md](frontend/README.md)**

## Features (vs product plan)

- Auth: register, login, refresh, me, password change, logout (token blacklist)
- Downloads: start job, list/cancel/retry, playlist → child jobs, yt-dlp wrapper + Celery task + WS progress
- Dashboard: stats, charts, active queue, recent rows, storage breakdown
- History & storage: paginated history, file list tied to your jobs, delete + Telegram push
- Integrations: encrypted Telegram config, test, auto-send after download, 50 MB guard
- Tooling: Postman collection, `seed_test_user`, root `.gitignore`

**Small gaps vs the written plan (optional follow-ups):** no bulk-delete on the Storage UI (only per-row delete); no dedicated “file info” dialog on History; Celery does not auto-retry failed downloads with exponential backoff; production DB is configured with `MYSQL_*` variables rather than a single `DATABASE_URL`; navigation lives in `AppLayout.jsx` instead of separate `Navbar.jsx` / `Sidebar.jsx` files.

## Test credentials (local development)

```bash
cd backend && source venv/bin/activate
python manage.py seed_test_user
```

| Field | Value |
| --- | --- |
| **Email** | `test@example.com` |
| **Password** | `testpassword123` |

If the user already exists: `python manage.py seed_test_user --force`. Override defaults with `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` (see `backend/.env.example`).

Then open **http://localhost:5173** and sign in on the Login page.

## Prerequisites

- Python 3.11+
- Node 20+
- **Redis** (recommended). If Redis is unavailable, set `USE_INMEMORY_CHANNELS=1` in `backend/.env` (in-process channel layer; progress from Celery will not reach the browser across processes).
- **FFmpeg** (for merges and audio extraction)
- **MySQL** when using `config.settings.production`; **SQLite** for default development settings

## Quick start

**1. Backend** (from repo root)

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set DJANGO_SECRET_KEY, REDIS_URL, ENCRYPTION_KEY as needed

python manage.py migrate
python manage.py seed_test_user
```

**2. Run API + WebSockets** (Channels expects ASGI)

```bash
DJANGO_SETTINGS_MODULE=config.settings.development daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

**3. Celery worker** (second terminal)

```bash
cd backend && source venv/bin/activate
celery -A config worker --loglevel=info
```

**4. Frontend** (third terminal)

```bash
cd frontend
npm install && cp .env.example .env
npm run dev
```

- App: **http://localhost:5173**
- API: **http://localhost:8000/api/**
- WebSocket: `ws://localhost:8000/ws/downloads/<job_id>/?token=<access_jwt>`

Production: set `DJANGO_SETTINGS_MODULE=config.settings.production` and MySQL-related variables from `backend/.env.example`.

## Postman

Import [postman/collection.json](postman/collection.json) and [postman/environment.json](postman/environment.json).

## Repository layout

```
backend/          Django project (apps/, config/, storage/, requirements.txt)
frontend/         Vite + React SPA
postman/          API collection + environment
```
