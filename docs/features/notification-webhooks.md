# Notification Webhooks - Telegram Alerts

## Overview

The AIO Downloader now supports Telegram notifications for download completion and failure events. This feature extends the existing Telegram auto-send capability to include failure alerts.

## Features

- **Failure Notifications**: Receive Telegram alerts when downloads fail
- **Configurable**: Enable/disable failure notifications per user
- **Informative**: Alerts include download title and error message
- **Non-Intrusive**: Works alongside existing auto-send file functionality

## Configuration

### Backend Settings

No additional backend configuration is required beyond the existing Telegram setup.

### User Preferences

Users can enable failure notifications via:

1. **Settings Page**: Navigate to Settings → Telegram
2. **Toggle**: Enable "Notify on failure" checkbox
3. **Save**: Click "Save Telegram" to apply changes

### API Endpoints

The existing Telegram API endpoints handle failure notification preferences:

- `PATCH /api/auth/preferences/` - Update `notify_on_failure` field
- `GET /api/auth/me/` - Returns current `notify_on_failure` preference

## Implementation Details

### Models

Added `notify_on_failure` boolean field to `UserPreferences` model:
- Default: `False`
- When `True`: User receives Telegram alerts on download failure

### Backend Logic

1. **Failure Detection**: Both `download_video_task` and `download_http_task` detect download failures
2. **Notification Trigger**: On failure, `send_failure_alert()` is called if:
   - User has `notify_on_failure = True`
   - Telegram is configured and enabled for the user
   - Owner has configured the Telegram bot token
3. **Alert Content**: Includes:
   - Download title
   - Error message (truncated to 500 characters if needed)

### Frontend

- Added "Notify on failure" toggle in Settings → Telegram card
- Bound to `notify_on_failure` user preference
- Saved via `/api/auth/preferences/` endpoint

## Usage

1. Configure Telegram bot in Settings → Telegram (existing feature)
2. Enable "Notify on failure" toggle
3. Save settings
4. When a download fails, you'll receive a Telegram message like:
   ```
   Download failed: [Download Title]
   Error: [Error Message]
   ```

## Testing

Unit tests are available in:
- `backend/apps/integrations/tests/test_gdrive.py` (TelegramFailureNotificationTests class)

## Security

- Failure alerts only sent to the user's configured Telegram chat
- Requires user to have notifications enabled
- Uses existing Telegram bot authentication (owner-only token setting)