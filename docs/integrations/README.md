# Integrations

## Telegram (`apps.integrations`)

- **Model** `TelegramConfig` — one row per user with encrypted bot token, chat ID, `enabled`, and `auto_send`.
- **API** under `/integrations/telegram/` — CRUD-style access from the Settings page.
- **Send** — `send_job_to_telegram` reads `MEDIA_ROOT / job.file_path`. If the file was removed by retention, send will fail with “file missing”; history still shows the job.

For more detail see code in `backend/apps/integrations/`.
