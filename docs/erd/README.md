# Entity relationship overview

Conceptual ERD for the main domain objects. This is documentation only; see Django migrations for the source of truth.

```mermaid
erDiagram
  User ||--o{ DownloadJob : owns
  User ||--o| TelegramConfig : has
  DownloadJob ||--o{ DownloadJob : playlist_entries

  User {
    bigint id PK
    uuid uuid UK
    string email UK
    string role
    int storage_retention_days
    string default_format
    string default_quality
  }

  DownloadJob {
    uuid id PK
    bigint user_id FK
    string status
    string engine
    string media_kind
    string file_path
    bigint file_size
    bigint bytes_downloaded
    bigint expected_size
    int queue_order
    datetime completed_at
    uuid playlist_parent_id FK
  }

  TelegramConfig {
    bigint id PK
    bigint user_id FK
    string chat_id
    string bot_token_encrypted  
    bool enabled
    bool auto_send
  }
```

## Notes

- `DownloadJob.id` is a UUID primary key; `User.id` is the default bigint from `AbstractUser`.
- `User.uuid` is the folder name under `MEDIA_ROOT` for that user’s files.
- `DownloadJob.engine` is `ytdlp` or `http`; HTTP jobs use extra progress/resume fields (`bytes_downloaded`, `expected_size`, etc.).
- `User.role` is `owner` or `admin` (default `admin`; seeded dev user and Django superusers are `owner`).
- Telegram **bot token** is stored encrypted on the **owner’s** `TelegramConfig` row and used for all Bot API calls. Each user’s row holds their **receiver** (`chat_id`), plus `enabled` and `auto_send`.
