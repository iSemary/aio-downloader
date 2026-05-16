# AIO Downloader

Self-hosted files downloader: paste a URL, download with **yt-dlp** + **FFmpeg** for videos, track progress over **WebSocket**, manage files, and optionally push to **Telegram** and **Google Drive**.

| Area | Stack |
| --- | --- |
| API | Django 6, Django REST Framework, JWT |
| Realtime | Django Channels, Redis channel layer |
| Workers | Celery, Redis broker |
| UI | React 19, Vite, Tailwind 4, shadcn/ui, Zustand, Recharts |

More detail: **[backend/README.md](backend/README.md)** · **[frontend/README.md](frontend/README.md)**

## Features

- **Universal URL Downloads** — Paste a link from YouTube, TikTok, Instagram, Twitter/X, Facebook, and hundreds more. Dual engines: yt-dlp (video/audio/playlists) + native HTTP (direct files, resume, SSRF protection).
- **Format & Quality Selection** — MP4, MP3, WebM; presets from Best down to Audio Only.
- **Playlist Support** — Auto-detection, hierarchical parent/child jobs, per-item tracking.
- **Download Queue** — Priority ordering, pause/resume (HTTP), retry, cancel, drag-and-drop reorder, bulk URL submission (up to 50), scheduling.
- **Real-Time Progress** — WebSocket streaming per job: percentage, speed, ETA, bytes, events (created → done/error).
- **Dashboard & Analytics** — Active/queue/health widgets, charts powered by Recharts: 12-month activity heatmap, platform donut, speed histogram, storage breakdown.
- **Download History** — Paginated, filterable by status/category/date, with job detail side sheet, Telegram push, retry, export to Excel.
- **File Storage Manager** — Browse all files, total/category breakdown, deletion from disk with security checks.
- **Auto-Retention** — Per-user auto-delete after N days via Celery periodic task.
- **Telegram Integration** — Bot token management (encrypted), per-user config, auto-send on complete, failure alerts, manual push, connection test, Local Bot API support.
- **Google Drive Integration** — OAuth 2.0 flow, encrypted tokens, auto-upload, per-job upload, folder selection, connection test.
- **Site Crawler / Grabber** — Crawl websites to discover media/docs/archives; configurable depth, concurrency, JS rendering (Playwright), robots.txt respect, include/exclude filters (URL/extension/size/domain/keyword), cron-based re-crawls, duplicate detection (SHA256), bulk queue discovered files.
- **Authenticated Crawling** — Site Accounts with cookie injection, header auth, basic auth, form-based login; credentials encrypted at rest.
- **URL Analysis Tool** — Probe any URL before downloading to see platform, media type, available formats, playlist detection.
- **User Management** — Email-based auth, JWT (access + refresh + blacklist), roles (Owner/Admin), registration, profile, password change.
- **User Preferences** — Default format/quality/engine, retention days, Telegram/Drive toggles, timezone, notification preferences.
- **Multi-Language** — English, Arabic (RTL), German.
- **Dark/Light/System Theme** — Toggle in header.
- **REST API** — Django 6 + DRF under `/api/` with full JWT auth, CORS, rate limiting.
- **Security** — SSRF protection, path traversal prevention, Fernet encryption for tokens, JWT blacklist.

## Figma Snapshots

For a visual preview of the project, check out my Figma designs:
[Open With Figma](https://www.figma.com/design/lqoxCKrZ7CUJAcNKfbs2fN/AIO-Downloader?node-id=1-4&t=GWkxgkhJVgtUwf4X-1)

<img alt="snapshot" src="https://i.ibb.co/zd7x7cV/Screenshot-From-2026-05-16-23-32-34.png" />


## Test credentials (local development)

| Field | Value |
| --- | --- |
| **Email** | `test@example.com` |
| **Password** | `testpassword123` |

## Postman

Import [postman/collection.json](postman/collection.json) and [postman/environment.json](postman/environment.json).

## Repository layout

```
backend/          Django project
frontend/         Vite + React SPA
postman/          API collection + environment
```
