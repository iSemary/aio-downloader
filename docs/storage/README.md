# Storage

## On-disk layout

Media root is `backend/storage/` (`MEDIA_ROOT`). Each user has a dedicated directory named after their **user UUID** (not the numeric primary key):

```text
storage/
  <user-uuid>/
    youtube/
      …downloaded files…
    instagram/
      …
    http/
      …direct HTTP downloads (see downloader docs)…
```

New downloads are written under `MEDIA_ROOT/<user_uuid>/<platform>/` by `apps.downloader.ytdlp_utils.job_output_dir` (yt-dlp), or under `MEDIA_ROOT/<user_uuid>/http/` for the native HTTP engine (`apps.downloader.http_download`).

Older rows may still reference legacy paths (without a UUID prefix); the storage delete API allows those paths only when a `DownloadJob` owned by the same user points at that path.

## HTTP API (`storage_manager`)

- **List files** `GET /storage/` — builds the list from the authenticated user’s completed jobs that still have a non-empty `file_path` and an existing file.
- **Stats** `GET /storage/stats/`
- **Delete** `DELETE /storage/<relative-path>/` — deletes the file and clears `file_path` / `file_size` on the associated job (history row remains).

## Automatic deletion (retention)

Each user has `storage_retention_days` (default **7**, **0** = never auto-delete).

A Celery task `apps.downloader.tasks.cleanup_expired_download_files`:

- Selects completed jobs (`status=done`) with a non-empty `file_path`.
- Compares `completed_at` (fallback `created_at`) to “now minus retention days”.
- Deletes the file from disk and clears `file_path` and `file_size` on the job. **The `DownloadJob` row is kept** for history, analytics, and Telegram flags.

Schedule is defined in `CELERY_BEAT_SCHEDULE` in `config/settings/base.py` (daily). You must run **Celery worker** and **Celery beat** against the same Redis broker for scheduled cleanup to run.

## Related code

- `apps/downloader/ytdlp_utils.py` — output directory and yt-dlp template.
- `apps/downloader/tasks.py` — `cleanup_expired_download_files`, sets `completed_at` when a download finishes.
- `apps/storage_manager/views.py` — list/delete/stats.
