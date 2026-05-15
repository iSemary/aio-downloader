# Downloader (jobs and pipeline)

## `DownloadJob`

Each row represents one download (or a playlist parent that coordinates children). Important fields:

- `status` — `pending`, `downloading`, `done`, `error`, `cancelled`, etc.
- `file_path` — path relative to `MEDIA_ROOT` when a file exists; empty after manual delete or retention cleanup.
- `file_size` — bytes on disk when present.
- `completed_at` — set when a job reaches `done` with a file; used for retention timing.
- `playlist_parent` — optional FK for playlist child jobs.

## Flow

1. **Create** `POST /downloads/` — probes URL, creates job(s), enqueues Celery `download_video_task`.
2. **Worker** (`apps.downloader.tasks.download_video_task`) runs `run_download` → yt-dlp writes under the user’s UUID folder, then updates the job including `completed_at`.
3. **WebSocket** — `apps.downloader.consumers` pushes progress/done/error events to the client group `download_<job_id>`.

## Retry

`POST /downloads/<id>/retry/` resets status and clears `file_path`, `file_size`, and `completed_at`, then re-queues the task.

## Integrations

On success, `maybe_auto_send` in `apps.integrations.telegram` may push the file to Telegram if configured.
