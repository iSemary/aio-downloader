# Entity relationship overview

Conceptual ERD for the main domain objects. This is documentation only; see Django migrations for the source of truth.

```mermaid
erDiagram
  User ||--|| UserPreferences : has
  User ||--o{ Playlist : owns
  User ||--o{ DownloadJob : owns
  User ||--o{ DownloadedFile : owns
  User ||--|| TelegramConfig : has
  Playlist ||--o{ DownloadJob : contains
  DownloadJob ||--|| DownloadJobMetrics : has
  DownloadJob ||--o{ DownloadedFile : produces
  DownloadJob ||--o{ JobEvent : logs
  TelegramConfig ||--o{ TelegramSend : initiates
  DownloadedFile ||--o{ TelegramSend : sent_via

  User {
    bigint id PK
    uuid uuid UK
    string email UK
    string username UK
    string role
  }

  UserPreferences {
    bigint id PK
    bigint user_id FK
    string default_format
    string default_quality
    string default_engine
    int storage_retention_days
    bool auto_send_telegram
    bool notify_on_complete
    string timezone
  }

  Playlist {
    uuid id PK
    bigint user_id FK
    string source_url
    string title
    string platform
    int total_count
    int completed_count
    int failed_count
    string status
    datetime created_at
    datetime updated_at
  }

  DownloadJob {
    uuid id PK
    bigint user_id FK
    uuid playlist_id FK
    string source_url
    string title
    string platform
    string thumbnail_url
    int duration_seconds
    string status
    string engine
    string format
    string quality
    string media_kind
    string error_message
    int retry_count
    int max_retries
    int queue_order
    int priority
    datetime scheduled_at
    datetime started_at
    datetime completed_at
    datetime created_at
    datetime updated_at
  }

  DownloadJobMetrics {
    bigint id PK
    uuid job_id FK
    bigint bytes_downloaded
    bigint bytes_total
    int progress_pct
    float avg_speed_bps
    float peak_speed_bps
    int duration_seconds
    string last_speed_str
    string last_eta_str
    datetime last_heartbeat
    string partial_rel_path
    string resume_etag
    string resume_last_modified
    string content_type
  }

  DownloadedFile {
    uuid id PK
    uuid job_id FK
    bigint user_id FK
    string file_path
    string file_name
    string mime_type
    bigint file_size_bytes
    string checksum_sha256
    string storage_backend
    bool is_deleted
    datetime expires_at
    datetime created_at
  }

  JobEvent {
    bigint id PK
    uuid job_id FK
    string event_type
    string message
    json payload
    string worker_id
    datetime created_at
  }

  TelegramConfig {
    bigint id PK
    bigint user_id FK
    bool enabled
    bool auto_send
    string bot_token_encrypted
    string chat_id
    string chat_username
    string chat_type
    int max_file_size_mb
    bool use_local_bot_api
    string local_bot_api_url
    datetime created_at
    datetime updated_at
  }

  TelegramSend {
    bigint id PK
    bigint config_id FK
    uuid file_id FK
    uuid job_id FK
    string status
    string telegram_message_id
    string telegram_file_id
    string error_message
    int attempt_count
    datetime sent_at
    datetime created_at
  }
```

## Notes

- `User.uuid` is the folder name under `MEDIA_ROOT` for that user’s files.
- `DownloadJob.engine` is a free-form string (e.g. `yt-dlp`, `http`); classification sets it at create time.
- `DownloadJob.platform` is free text (from yt-dlp / URL hints), not a fixed enum.
- `User.role` is `owner` or `admin` (default `admin`; seeded dev user and Django superusers are `owner`).
- Telegram **bot token** is stored encrypted on the **owner’s** `TelegramConfig` row and used for all Bot API calls. Each user’s row holds receiver settings (`chat_id`, etc.), `enabled`, and optional local Bot API URL. **Auto-send** for completed downloads is driven by `UserPreferences.auto_send_telegram` plus `TelegramConfig.enabled` and a valid `chat_id`.
- `DownloadedFile.expires_at` is set from `UserPreferences.storage_retention_days` when a file is created; `cleanup_expired_download_files` deletes expired files and marks rows `is_deleted`.
- REST exposes backward-compatible aliases on jobs (`url`, `progress`, `speed`, `file_size`, `sent_to_telegram`, `playlist_parent`) alongside nested `metrics` and `files`.
