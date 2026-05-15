# Integrations

## Telegram (`apps.integrations`)

- **Model** `TelegramConfig` — one row per user: **receiver** (`chat_id`), `enabled`, `auto_send`, and optionally encrypted bot token material on the owner’s row only.
- **Roles** — Users have `role` `owner` or `admin` (default `admin` on registration). Only **`owner`** may set or change `bot_token` via the API. Test, push, and auto-send use the **decrypted token from the first `owner` user** (by primary key) together with **each user’s own** `chat_id`.
- **API** under `/integrations/telegram/` — Settings page: owners edit the bot token and their receiver; admins edit only receiver and toggles. GET responses include `bot_configured` so the UI can show whether the owner has saved a token.
- **Send** — `send_job_to_telegram` reads `MEDIA_ROOT / job.file_path`. If the file was removed by retention, send will fail with “file missing”; history still shows the job.

For more detail see code in `backend/apps/integrations/`.
