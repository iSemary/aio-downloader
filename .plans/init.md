# 🎬 All-In-One Downloader — Project Plan

> Self-hosted video downloader with React dashboard, Django backend, multi-platform support, and Telegram integration.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Architecture Overview](#4-architecture-overview)
5. [Backend — Django](#5-backend--django)
6. [Frontend — React + Shadcn + Tailwind](#6-frontend--react--shadcn--tailwind)
7. [Downloader Engine](#7-downloader-engine)
8. [Telegram Integration](#8-telegram-integration)
9. [Auth System](#9-auth-system)
10. [Postman Collection](#10-postman-collection)
11. [Storage & .gitignore](#11-storage--gitignore)
12. [Environment Variables](#12-environment-variables)
13. [Build & Run Guide](#13-build--run-guide)
14. [Development Phases](#14-development-phases)
15. [API Endpoints Reference](#15-api-endpoints-reference)
16. [Error Handling Strategy](#16-error-handling-strategy)
17. [Security Checklist](#17-security-checklist)

---

## 1. Project Overview

A fully self-hosted web application that allows authenticated users to paste any video URL (YouTube, YouTube Playlist, Facebook, Instagram, TikTok, Twitter/X, Vimeo, and more) and download it to local storage. Downloaded files can optionally be forwarded to a configured Telegram channel.

**Core features:**
- Paste any URL → download video/audio
- YouTube playlist batch downloads
- Real-time progress tracking via WebSocket
- Storage management dashboard
- Telegram channel push (per-download or auto)
- User authentication (register/login/JWT)
- Integration settings page for Telegram
- Download history with file management

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + Vite |
| UI components | shadcn/ui |
| Styling | Tailwind CSS v3 |
| Backend framework | Django 5 + Django REST Framework |
| Auth | JWT via `djangorestframework-simplejwt` |
| Realtime | Django Channels + WebSocket |
| Download engine | yt-dlp |
| Media processing | FFmpeg |
| Task queue | Celery + Redis |
| Database | PostgreSQL (prod) / SQLite (dev) |
| Telegram | python-telegram-bot |
| API docs / testing | Postman |

---

## 3. Folder Structure

```
project-root/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/               # Axios instances, API calls
│   │   ├── components/        # shadcn + custom components
│   │   │   ├── ui/            # shadcn primitives (button, card, input…)
│   │   │   ├── layout/        # Sidebar, Navbar, PageWrapper
│   │   │   └── downloader/    # URLInput, ProgressCard, QueueList
│   │   ├── hooks/             # useDownload, useWebSocket, useAuth
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx      # Download URL input + active queue
│   │   │   ├── History.jsx        # Past downloads with file actions
│   │   │   ├── Storage.jsx        # Browse /storage folder
│   │   │   └── Settings.jsx       # Telegram integration config
│   │   ├── store/             # Zustand global state
│   │   ├── lib/               # utils, cn(), formatBytes
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
│
├── backend/
│   ├── config/                # Django project settings
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── development.py
│   │   │   └── production.py
│   │   ├── urls.py
│   │   ├── asgi.py            # WebSocket support
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── auth_app/          # Custom user model, register, login
│   │   ├── downloader/        # Download jobs, yt-dlp wrapper, Celery tasks
│   │   ├── storage_manager/   # File listing, delete, size stats
│   │   └── integrations/      # Telegram bot config & push
│   ├── storage/               # ← GITIGNORED — downloaded files land here
│   │   └── .gitkeep
│   ├── requirements.txt
│   ├── manage.py
│   └── .env
│
└── postman/
    ├── collection.json
    └── environment.json
```

---

## 4. Architecture Overview

```
Browser (React)
    │
    ├── REST API (DRF) ──────────────────────────────────────────────┐
    │   POST /api/downloads/start                                    │
    │   GET  /api/downloads/                                         │
    │   GET  /api/storage/                                           │
    │   POST /api/integrations/telegram/push/{id}                   │
    │                                                                │
    └── WebSocket ws://…/ws/downloads/{job_id}/                      │
            │ (progress, speed, ETA, status events)                  │
            │                                                        ▼
       Django Channels                                         Celery Worker
            │                                                        │
            └───────── Redis (broker + channel layer) ───────────────┘
                                                                     │
                                                              yt-dlp + FFmpeg
                                                                     │
                                                            /backend/storage/
                                                                     │
                                                         python-telegram-bot
                                                                     │
                                                          Telegram Channel/Chat
```

---

## 5. Backend — Django

### 5.1 Apps

#### `auth_app`
- Custom `User` model extending `AbstractUser`
- Endpoints: `/api/auth/register/`, `/api/auth/login/`, `/api/auth/refresh/`, `/api/auth/me/`
- JWT tokens via `djangorestframework-simplejwt`
- Password validation, email uniqueness

#### `downloader`
- `DownloadJob` model:
  ```
  id (UUID)
  user (FK)
  url (TextField)
  title (CharField, filled after probe)
  platform (CharField: youtube | instagram | facebook | tiktok | etc)
  status (CharField: pending | downloading | processing | done | error)
  progress (IntegerField 0–100)
  speed (CharField)
  eta (CharField)
  file_path (CharField)
  file_size (BigIntegerField)
  format (CharField: mp4 | mp3 | webm)
  quality (CharField: best | 1080p | 720p | 480p | audio_only)
  error_message (TextField, nullable)
  created_at / updated_at
  sent_to_telegram (BooleanField)
  ```
- Celery task `download_video_task(job_id)`:
  - Calls yt-dlp with progress hook
  - Sends WebSocket events via Django Channels on each progress tick
  - Updates DB on completion or error
- Platform auto-detection from URL (regex match)
- Playlist detection → spawns one job per video

#### `storage_manager`
- Lists files in `/backend/storage/`
- Returns: filename, size, created_at, download_job reference
- DELETE endpoint removes file from disk + marks job record
- Stats endpoint: total files, total size, breakdown by platform

#### `integrations`
- `TelegramConfig` model (one per user or global admin config):
  ```
  bot_token (CharField, encrypted)
  chat_id (CharField)
  auto_send (BooleanField)
  enabled (BooleanField)
  ```
- Endpoint to save/update config
- Endpoint to test connection (send a test message)
- Push endpoint: `POST /api/integrations/telegram/push/{job_id}/`
  - Reads file from storage, sends via `bot.send_document()` or `bot.send_video()`

### 5.2 Key Django Settings

```python
# base.py additions
INSTALLED_APPS += [
    "channels",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "apps.auth_app",
    "apps.downloader",
    "apps.storage_manager",
    "apps.integrations",
]

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [("redis", 6379)]},
    }
}

CELERY_BROKER_URL = "redis://redis:6379/0"
CELERY_RESULT_BACKEND = "redis://redis:6379/0"

MEDIA_ROOT = BASE_DIR / "storage"
MEDIA_URL = "/storage/"

CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication"
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated"
    ],
}
```

### 5.3 requirements.txt

```
django>=5.0
djangorestframework
djangorestframework-simplejwt
django-cors-headers
channels
channels-redis
celery
redis
yt-dlp
python-telegram-bot
cryptography         # for encrypting bot tokens at rest
psycopg2-binary      # PostgreSQL adapter
python-dotenv
whitenoise           # static files in production
```

---

## 6. Frontend — React + Shadcn + Tailwind

### 6.1 Pages

#### `/login` and `/register`
- Clean auth forms using shadcn `Card`, `Input`, `Button`
- JWT stored in `localStorage` (access token) + `httpOnly` cookie (refresh — optional)
- Redirect to dashboard on success

#### `/dashboard` — Main Download Page
- Large URL input field with paste button
- Format + quality selectors (mp4/mp3, best/1080p/720p/audio)
- Submit → creates job → subscribes to WebSocket for that `job_id`
- Active downloads queue: progress bars, speed, ETA, cancel button
- Each card shows: platform icon, title (once probed), thumbnail (YouTube)

#### `/history`
- Table of all past downloads (paginated)
- Columns: title, platform, size, date, status, actions
- Actions: re-download, delete file, send to Telegram, open file info

#### `/storage`
- File browser of the `/storage` folder
- Stats bar: total size used, file count
- Bulk delete, individual delete
- Send to Telegram button per file

#### `/settings`
- **Telegram Integration** section:
  - Bot Token input (masked)
  - Chat ID / Channel Username input
  - Auto-send toggle (send every download automatically)
  - Test Connection button
  - Save button
- **Account** section: change password, display name
- **Preferences**: default format, default quality

### 6.2 State Management (Zustand)

```javascript
// store/useDownloadStore.js
{
  activeJobs: [],          // jobs currently downloading
  addJob: (job) => {},
  updateJobProgress: (id, data) => {},
  removeJob: (id) => {},
}

// store/useAuthStore.js
{
  user: null,
  token: null,
  login: (token, user) => {},
  logout: () => {},
}
```

### 6.3 WebSocket Hook

```javascript
// hooks/useJobWebSocket.js
// Connects to ws://localhost:8000/ws/downloads/{jobId}/
// Dispatches progress updates to Zustand store
// Events received: { type: "progress", percent, speed, eta }
//                  { type: "done", file_path, file_size }
//                  { type: "error", message }
```

### 6.4 shadcn Components to Install

```bash
npx shadcn@latest add button card input label select
npx shadcn@latest add progress badge table tabs
npx shadcn@latest add toast dialog alert-dialog
npx shadcn@latest add sidebar navigation-menu
npx shadcn@latest add switch form
```

### 6.5 Key UI Details

- Sidebar navigation with icons for each page
- Platform detection shown as colored badge (YouTube red, Instagram gradient, etc.)
- Progress bar animates smoothly, shows speed + ETA inline
- Toast notifications for: download started, completed, errors, Telegram sent
- Dark mode support via Tailwind `dark:` classes

---

## 7. Downloader Engine

### 7.1 yt-dlp Wrapper (`apps/downloader/ytdlp_utils.py`)

```python
import yt_dlp

PLATFORM_PATTERNS = {
    "youtube":    r"(youtube\.com|youtu\.be)",
    "instagram":  r"instagram\.com",
    "facebook":   r"(facebook\.com|fb\.watch)",
    "tiktok":     r"tiktok\.com",
    "twitter":    r"(twitter\.com|x\.com)",
    "vimeo":      r"vimeo\.com",
}

def detect_platform(url: str) -> str: ...

def probe_url(url: str) -> dict:
    """Returns title, thumbnail, duration, is_playlist, entries count."""

def build_ydl_opts(job, progress_hook) -> dict:
    """Builds yt-dlp options dict from job settings (format, quality, output path)."""

def run_download(job, send_progress_callback):
    """Blocking call — runs inside Celery worker."""
```

### 7.2 Celery Task

```python
# apps/downloader/tasks.py
@shared_task(bind=True)
def download_video_task(self, job_id: str):
    job = DownloadJob.objects.get(id=job_id)
    job.status = "downloading"
    job.save()

    def progress_hook(d):
        if d["status"] == "downloading":
            percent = d.get("_percent_str", "0%")
            speed = d.get("_speed_str", "")
            eta = d.get("_eta_str", "")
            # Send to WebSocket channel group
            channel_layer.group_send(f"download_{job_id}", {
                "type": "download.progress",
                "percent": percent,
                "speed": speed,
                "eta": eta,
            })
            job.progress = int(float(percent.strip('%')))
            job.save(update_fields=["progress"])

    run_download(job, progress_hook)
```

### 7.3 Supported Platforms

yt-dlp natively supports 1000+ sites. The following are explicitly tested and highlighted in the UI:

| Platform | Notes |
|---|---|
| YouTube | Single video, playlists, shorts, live (post) |
| YouTube Music | Audio extraction |
| Instagram | Reels, posts, stories (public) |
| Facebook | Public videos, reels |
| TikTok | Public videos |
| Twitter / X | Video tweets |
| Vimeo | Public videos |
| Twitch | VODs, clips |
| Reddit | Video posts |
| Generic | Most other sites via yt-dlp generic extractor |

---

## 8. Telegram Integration

### 8.1 Flow

```
User configures bot token + chat_id → saved in TelegramConfig
     ↓
User clicks "Send to Telegram" on a completed download (or auto_send = true)
     ↓
apps/integrations/telegram.py → python-telegram-bot
     ↓
bot.send_document(chat_id, file) or bot.send_video(chat_id, file)
     ↓
File appears in Telegram channel/chat
     ↓
job.sent_to_telegram = True, timestamp recorded
```

### 8.2 Setup Instructions (documented in Settings page)

1. Talk to `@BotFather` on Telegram → create bot → copy token
2. Add bot to your channel as admin
3. Get Chat ID: forward a message from the channel to `@userinfobot`
4. Paste both into Settings → Test → Save

### 8.3 Limits to handle

- Telegram max file size via Bot API: **50 MB** for documents, **2 GB** for local Bot API server
- Show warning in UI when file > 50 MB with option to set up local Bot API server
- For large files: document the local Telegram Bot API server setup in Settings help text

---

## 9. Auth System

### 9.1 Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register/` | No | Create account |
| POST | `/api/auth/login/` | No | Get JWT tokens |
| POST | `/api/auth/refresh/` | No | Refresh access token |
| GET | `/api/auth/me/` | Yes | Get current user |
| POST | `/api/auth/logout/` | Yes | Blacklist refresh token |

### 9.2 Token Strategy

- Access token: short-lived (15 min), stored in memory / localStorage
- Refresh token: long-lived (7 days), stored in `httpOnly` cookie (or localStorage for simplicity)
- Axios interceptor auto-refreshes on 401 response

### 9.3 Route Guards (Frontend)

```jsx
// PrivateRoute.jsx — wraps all authenticated pages
// Checks useAuthStore for token, redirects to /login if missing
```

---

## 10. Postman Collection

### `postman/collection.json` — Folder Structure

```
All-In-One Downloader
├── Auth
│   ├── Register
│   ├── Login
│   ├── Refresh Token
│   └── Me
├── Downloads
│   ├── Start Download
│   ├── List Downloads
│   ├── Get Download (by ID)
│   └── Cancel Download
├── Storage
│   ├── List Files
│   ├── Get Storage Stats
│   └── Delete File
└── Integrations
    ├── Get Telegram Config
    ├── Save Telegram Config
    ├── Test Telegram Connection
    └── Push File to Telegram
```

### `postman/environment.json` — Variables

| Variable | Example Value |
|---|---|
| `base_url` | `http://localhost:8000` |
| `access_token` | (auto-filled by login test script) |
| `refresh_token` | (auto-filled by login test script) |
| `job_id` | (set manually after start download) |

> Login request has a **Postman test script** that auto-sets `access_token` and `refresh_token` environment variables on success.

---

## 11. Storage & .gitignore

### Storage Folder

Downloaded files land in `/backend/storage/`. Organized as:

```
backend/storage/
├── youtube/
│   └── [video-title].mp4
├── instagram/
│   └── [video-title].mp4
├── facebook/
│   └── [video-title].mp4
└── ...
```

yt-dlp output template:
```python
"outtmpl": f"storage/%(extractor)s/%(title)s.%(ext)s"
```

### `.gitignore` additions

```gitignore
# Downloaded media
backend/storage/*
!backend/storage/.gitkeep

# Env files
backend/.env
frontend/.env
frontend/.env.local

# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.venv/
venv/

# Node
node_modules/
dist/
.vite/

# DB
*.sqlite3

# Logs
*.log
celerybeat-schedule
```

---

## 12. Environment Variables

### `backend/.env`

```env
# Django
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (leave blank to use SQLite in dev)
DATABASE_URL=postgres://user:pass@localhost:5432/downloader_db

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
ACCESS_TOKEN_LIFETIME_MINUTES=15
REFRESH_TOKEN_LIFETIME_DAYS=7

# Storage
STORAGE_ROOT=storage/

# Telegram (optional global default — users can also set per-account)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Security
ENCRYPTION_KEY=your-fernet-key-for-token-encryption
```

### `frontend/.env`

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_WS_BASE_URL=ws://localhost:8000/ws
```

---

## 13. Build & Run Guide

### Prerequisites

```bash
# System dependencies
sudo apt install ffmpeg redis-server postgresql   # Linux
brew install ffmpeg redis postgresql              # macOS

# Python 3.11+
python --version

# Node 20+
node --version
```

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # fill in your values

python manage.py migrate
python manage.py createsuperuser  # optional admin access

# Start Django dev server
python manage.py runserver

# Start Celery worker (separate terminal)
celery -A config worker --loglevel=info

# Start Celery beat scheduler (optional, for future scheduled tasks)
celery -A config beat --loglevel=info
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local       # fill in API URL

# Initialize shadcn (first time only)
npx shadcn@latest init

# Install all required components
npx shadcn@latest add button card input label select progress badge \
  table tabs toast dialog alert-dialog sidebar navigation-menu switch form

npm run dev
```

### Access the App

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Django API | http://localhost:8000/api |
| Django Admin | http://localhost:8000/admin |
| WebSocket | ws://localhost:8000/ws/downloads/{id}/ |

---

## 14. Development Phases

### Phase 1 — Foundation (Week 1)
- [ ] Django project scaffolding with all apps
- [ ] Custom User model + JWT auth endpoints
- [ ] `DownloadJob` model and basic CRUD
- [ ] Vite + React + Tailwind + shadcn setup
- [ ] Login/Register pages with working auth flow
- [ ] Axios instance with JWT interceptor
- [ ] PrivateRoute guard

### Phase 2 — Core Download Engine (Week 2)
- [ ] yt-dlp integration + platform detection
- [ ] Celery + Redis setup
- [ ] `download_video_task` Celery task
- [ ] Django Channels WebSocket consumer
- [ ] Frontend WebSocket hook (`useJobWebSocket`)
- [ ] Dashboard page: URL input → start download → progress tracking
- [ ] Storage folder + output template

### Phase 3 — Storage & History (Week 3)
- [ ] Storage manager app (list, delete, stats)
- [ ] History page with paginated table
- [ ] Storage page (file browser + stats)
- [ ] File deletion (disk + DB)
- [ ] Download re-triggering from history

### Phase 4 — Telegram Integration (Week 4)
- [ ] `TelegramConfig` model + encrypted token storage
- [ ] Telegram settings page
- [ ] Test connection endpoint
- [ ] Push-to-Telegram endpoint + python-telegram-bot
- [ ] Auto-send toggle (post-download hook in Celery task)
- [ ] File size warning for > 50 MB

### Phase 5 — Polish & Production (Week 5)
- [ ] Playlist support (batch jobs from single URL)
- [ ] Toast notifications throughout the app
- [ ] Dark mode
- [ ] Postman collection finalization
- [ ] Error handling, retry logic
- [ ] PostgreSQL migration + production settings
- [ ] README with full setup guide

---

## 15. API Endpoints Reference

### Auth

| Method | Endpoint | Body | Response |
|---|---|---|---|
| POST | `/api/auth/register/` | `{username, email, password}` | `{user, tokens}` |
| POST | `/api/auth/login/` | `{email, password}` | `{access, refresh}` |
| POST | `/api/auth/refresh/` | `{refresh}` | `{access}` |
| GET | `/api/auth/me/` | — | `{id, username, email}` |

### Downloads

| Method | Endpoint | Body / Params | Response |
|---|---|---|---|
| POST | `/api/downloads/` | `{url, format, quality}` | `{job_id, status}` |
| GET | `/api/downloads/` | `?page=1&status=done` | Paginated job list |
| GET | `/api/downloads/{id}/` | — | Job detail |
| DELETE | `/api/downloads/{id}/` | — | Cancels job |
| POST | `/api/downloads/{id}/retry/` | — | Retries failed job |

### Storage

| Method | Endpoint | Response |
|---|---|---|
| GET | `/api/storage/` | File list with sizes |
| GET | `/api/storage/stats/` | Total size, count, breakdown |
| DELETE | `/api/storage/{filename}/` | `{deleted: true}` |

### Integrations

| Method | Endpoint | Body | Response |
|---|---|---|---|
| GET | `/api/integrations/telegram/` | — | Current config (masked token) |
| POST | `/api/integrations/telegram/` | `{bot_token, chat_id, auto_send}` | Saved config |
| POST | `/api/integrations/telegram/test/` | — | `{ok: true, message}` |
| POST | `/api/integrations/telegram/push/{job_id}/` | — | `{sent: true}` |

### WebSocket

```
ws://localhost:8000/ws/downloads/{job_id}/

# Messages received (server → client):
{ "type": "progress", "percent": 45, "speed": "2.3 MiB/s", "eta": "00:32" }
{ "type": "done", "file_path": "storage/youtube/video.mp4", "file_size": 104857600 }
{ "type": "error", "message": "Video unavailable" }
```

---

## 16. Error Handling Strategy

### Backend
- yt-dlp errors caught in Celery task → `job.status = "error"`, `job.error_message` set
- WebSocket `error` event sent to frontend
- DRF exception handler returns structured `{error, detail, code}` responses
- Celery task auto-retry on transient network errors (max 3 retries, exponential backoff)

### Frontend
- Axios response interceptor catches 401 → auto-refresh token or redirect to login
- All API calls wrapped in try/catch with toast notifications on error
- WebSocket disconnect → auto-reconnect with exponential backoff (max 5 attempts)
- Job cards show error state with message + retry button

---

## 17. Security Checklist

- [ ] JWT `SECRET_KEY` is long, random, and never committed to git
- [ ] Bot tokens encrypted at rest with Fernet symmetric encryption
- [ ] `.env` in `.gitignore`
- [ ] CORS restricted to frontend origin only
- [ ] All download endpoints require authentication (`IsAuthenticated`)
- [ ] `ALLOWED_HOSTS` set correctly in production
- [ ] `DEBUG = False` in production
- [ ] Storage folder not publicly accessible (served through authenticated endpoint, not `MEDIA_URL` directly)
- [ ] File deletion validates ownership (user can only delete their own jobs)
- [ ] Rate limiting on auth endpoints (django-ratelimit or similar)
- [ ] HTTPS in production (Nginx + Let's Encrypt)

---

*Generated for: All-In-One Downloader Project*  
*Stack: React 18 + shadcn/ui + Tailwind | Django 5 + DRF + Channels + Celery | yt-dlp + FFmpeg | Telegram*

Use mysql for backend db

Stats row (5 cards)

URLs Fetched, Successfully Downloaded, Sent to Telegram, Failed, GB Stored — each with a live delta and color-coded accent stripe

Charts

Line chart with 7D / 30D / All switcher — tracks Downloaded, Sent to TG, and Failed as three series
Platform breakdown bar chart (YouTube, Instagram, TikTok, Facebook, X) with animated fill bars
Donut chart for storage utilization with raw GB numbers

Active downloads queue

Animated striped progress bar for active downloads, solid green for done
Speed + ETA inline per job, platform badge, file size
Per-item pause / cancel / send-to-Telegram buttons
Try it: paste any URL in the top bar and click Download — it simulates a live download with a real progress animation

Recent history table — title, platform, size, status badge, Telegram sent indicator
Storage breakdown — animated per-platform bars with GB amounts + footer stats

