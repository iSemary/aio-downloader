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
    int storage_retention_days
    string default_format
    string default_quality
  }

  DownloadJob {
    uuid id PK
    bigint user_id FK
    string status
    string file_path
    bigint file_size
    datetime completed_at
    uuid playlist_parent_id FK
  }

  TelegramConfig {
    bigint id PK
    bigint user_id FK
    bool enabled
    bool auto_send
  }
```

## Notes

- `DownloadJob.id` is a UUID primary key; `User.id` is the default bigint from `AbstractUser`.
- `User.uuid` is the folder name under `MEDIA_ROOT` for that user’s files.
- Telegram tokens are stored encrypted; see `apps.integrations`.
