# Downloader (jobs and pipeline)

## `DownloadJob`

Each row represents one download (or a playlist parent that coordinates children). Important fields:

- `status` — `pending`, `downloading`, `processing`, `done`, `error`, `cancelled`, `paused`, etc.
- `file_path` — path relative to `MEDIA_ROOT` when a file exists; empty after manual delete or retention cleanup.
- `file_size` — bytes on disk when present.
- `completed_at` — set when a job reaches `done` with a file; used for retention timing.
- `playlist_parent` — optional FK for playlist child jobs.
- `engine` — `ytdlp` (yt-dlp + FFmpeg path) or `http` (native HTTP streamer in `http_download.py`).
- `media_kind` — `video`, `audio`, `image`, `document`, `archive`, `other` (used for UI and classification).
- `content_type`, `bytes_downloaded`, `expected_size` — mainly populated for HTTP jobs (progress and resume).
- `resume_etag`, `resume_last_modified` — stored from the origin for conditional `If-Range` resume where applicable.
- `http_connections` — requested parallel connections (reserved for future multi-range; single-stream today).
- `queue_order` — user-controlled ordering; see **Reorder** and `GET …?sort=queue`.

## Engines (hybrid pipeline)

1. **Classifier** (`apps.downloader.classification.classify_download`) picks `engine` from the URL (extension hints, `analyze_url` / yt-dlp metadata, optional safe `HEAD` probe via `http_download.head_probe`).
2. **yt-dlp** — playlists, known media hosts, and anything not classified as a plain HTTP asset. Same probe/create flow as before; worker is `download_video_task` → `ytdlp_utils.run_download`.
3. **HTTP** — direct files (images, archives, audio/video URLs, `octet-stream`, etc.). Worker is `download_http_task` → `http_download.run_http_download` (SSRF checks, streaming, Range resume, cooperative pause).

**Dispatcher** — `apps.downloader.tasks.enqueue_download` loads the job and calls either `download_video_task` or `download_http_task`.

## Flow (create)

1. **Create** `POST /downloads/` — validates body, runs classification, then either:
   - creates an **HTTP** job and enqueues `download_http_task`, or
   - runs `probe_url` (yt-dlp), creates parent/child jobs for playlists, or a single **yt-dlp** job, then enqueues via `enqueue_download` / `enqueue_playlist_jobs`.
2. **Bulk create** `POST /downloads/bulk/` — body `{ "urls": ["…"], "format", "quality", "http_connections" }`; returns `{ "jobs": [...], "errors": [...] }` (per-URL failures do not fail the whole request).
3. **Worker** updates progress in the database and pushes WebSocket payloads (see below).
4. **WebSocket** — `apps.downloader.consumers` sends events to group `download_<job_id>`.

## HTTP downloader (security and limits)

Implementation: `apps.downloader.http_download`.

- **SSRF** — only `http`/`https`; hostnames are resolved and **private / loopback / link-local / CGNAT** ranges are rejected (`assert_safe_http_url`).
- **Redirects** — capped (`DOWNLOAD_HTTP_MAX_REDIRECTS`); each hop is re-checked.
- **Size** — `DOWNLOAD_HTTP_MAX_BYTES` caps how much will be written.
- **Streaming** — chunked reads (`DOWNLOAD_HTTP_CHUNK_BYTES`); GET uses `follow_redirects=False` on the final URL from probe to avoid silent redirect chains off the validated URL.

Configurable in `config/settings/base.py` (overridable via env — see `backend/.env.example`).

## WebSocket payloads

Clients subscribe to `ws/downloads/<job_id>/` (see frontend `useJobWebSocket`). In addition to existing types:

- `progress` — may include `bytes_downloaded` and `expected_size` for HTTP jobs.
- `paused` — HTTP download cooperatively stopped after `POST …/pause/`.

## List and ordering

- **Default list** — `GET /downloads/` — newest first (`sort` omitted or `sort=recent`).
- **Queue order** — `GET /downloads/?sort=queue` — orders by `queue_order`, then `-created_at` (for manager UIs).
- **Reorder** `POST /downloads/reorder/` — body `{ "order": ["<uuid>", …] }`; assigns `queue_order` 0…n−1 for those ids (must all belong to the user).
- **Status filter** — `GET /downloads/?status=<status>` — filter by single status, or `GET /downloads/?status=pending,queued,downloading` for comma-separated multiple statuses. Valid values: `pending`, `queued`, `downloading`, `processing`, `done`, `error`, `cancelled`, `paused`.

## Pause and resume (HTTP only)

- `POST /downloads/<id>/pause/` — sets status to `paused`; the running worker observes it and exits without marking the job as `error`.
- `POST /downloads/<id>/resume/` — sets status to `pending` and re-enqueues `download_http_task` (Range resume when the server supports it).

yt-dlp jobs still return **501** for pause until a comparable mechanism exists.

## Retry

`POST /downloads/<id>/retry/`:

- **yt-dlp** — resets status, clears `file_path`, `file_size`, progress fields, `completed_at`, then re-queues.
- **HTTP** — clears error state and re-queues while **keeping** partial `file_path` / `bytes_downloaded` / `expected_size` when resuming is intended. If the server rejects Range resume, the worker may clear the partial file and set `error` (see task handler for `resume_not_supported`).

## URL analyze (UI hints)

`POST /downloads/analyze/` — still returns `analyze_url` payload; response now also includes:

- `engine` — `ytdlp` or `http`.
- `capabilities` — `pause_supported`, `resume_supported`, `multiconn_supported` (multi-connection is reserved; currently `false`).

## On-disk layout (HTTP)

HTTP jobs write under `MEDIA_ROOT/<user_uuid>/http/` (see `job_http_output_dir` in `http_download.py`). yt-dlp continues to use `MEDIA_ROOT/<user_uuid>/<platform>/`.

## Integrations

On success, `maybe_auto_send` in `apps.integrations.telegram` may push the file to Telegram if configured (same as yt-dlp completions).

## Related code

- `apps/downloader/models.py` — `DownloadJob` fields and indexes.
- `apps/downloader/classification.py` — engine selection.
- `apps/downloader/http_download.py` — probe, stream, pause, resume.
- `apps/downloader/ytdlp_utils.py` — yt-dlp probe, `run_download`, `analyze_url`.
- `apps/downloader/tasks.py` — `download_video_task`, `download_http_task`, `enqueue_download`, `enqueue_playlist_jobs`, retention cleanup.
- `apps/downloader/views.py` — REST create, bulk, reorder, pause, resume, retry, list `sort` query.
- `apps/downloader/serializers.py` — request/response shapes.
- `frontend/src/pages/Queue.jsx` — queue UI (virtual list, resizable panels, command palette, reorder sheet).
