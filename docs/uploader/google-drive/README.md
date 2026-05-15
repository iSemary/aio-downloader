# Google Drive Mirroring

## Overview

The AIO Downloader now supports automatic mirroring of completed downloads to Google Drive. Users can configure global auto-upload or select per-download upload options.

## Features

- **Automatic Upload**: Completed downloads are automatically uploaded to Google Drive
- **Flexible Configuration**: Global auto-upload setting or per-download toggle
- **OAuth2 Authentication**: Secure connection to Google Drive using industry-standard OAuth2 flow
- **Folder Selection**: Option to specify a root folder ID for organized uploads
- **Error Handling**: Graceful handling of authentication and upload errors

## Configuration

### Backend Settings

Add the following to your `.env` file or Django settings:

```bash
# Google OAuth2 Credentials (required)
GOOGLE_OAUTH_CLIENT_ID=your_client_id_from_google_cloud_console
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret_from_google_cloud_console
GOOGLE_OAUTH_REDIRECT_URI=http://your-domain.com/integrations/gdrive/callback/
```

### Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Drive API for your project
4. Go to "APIs & Services" → "Credentials"
5. Create OAuth 2.0 Client ID (Application type: Web application)
6. Set authorized redirect URI to: `http://your-domain.com/integrations/gdrive/callback/`
7. Copy the Client ID and Client Secret to your `.env` file

## Usage

### Connecting Google Drive

1. Navigate to Settings → Google Drive
2. Click "Connect Google Drive" button
3. Complete the OAuth2 consent flow in the popup window
4. Upon successful connection, you'll see your connected email address
5. Optionally set a Root Folder ID (leave blank for root of your Drive)
6. Configure upload preferences:
   - **Enabled**: Turn Google Drive integration on/off
   - **Auto-upload**: Automatically upload all completed downloads
7. Click "Save" to apply settings

### Per-Download Upload

When adding a new download:
1. In the download form (Dashboard or Bulk Add), look for the "Upload to Google Drive" toggle
2. Enable the toggle for specific downloads you want mirrored
3. The toggle respects your global settings:
   - If global Auto-upload is ON: Toggle acts as an override (can disable for specific downloads)
   - If global Auto-upload is OFF: Toggle enables upload for specific downloads

### Testing Connection

Use the "Test connection" button in Settings → Google Drive to verify:
- Authentication is working
- You can access your Google Drive account
- The connection is ready for uploads

## API Endpoints

### Google Drive Configuration
- `GET /api/integrations/gdrive/` - Get current configuration
- `PATCH /api/integrations/gdrive/` - Update configuration (enabled, auto_upload, root_folder_id)

### OAuth2 Flow
- `GET /api/integrations/gdrive/auth/` - Get authorization URL to start OAuth flow
- `POST /api/integrations/gdrive/callback/` - Handle OAuth callback from Google
- `POST /api/integrations/gdrive/test/` - Test Google Drive connection

## Implementation Details

### Models

Added `GoogleDriveConfig` model:
- `user`: OneToOneField to User
- `enabled`: Boolean (default: False)
- `credentials_encrypted`: Encrypted OAuth2 tokens (JSONField)
- `root_folder_id`: CharField for optional folder specification (max_length=64)
- `auto_upload`: Boolean for global auto-upload setting (default: False)

Added `upload_to_google_drive` field to `DownloadJob` model:
- Boolean field (default: False)
- Controls per-download upload behavior

### Backend Logic

1. **OAuth2 Flow**:
   - `/gdrive/auth/` returns authorization URL for user consent
   - `/gdrive/callback/` handles Google's response and stores encrypted tokens
   - Uses `google-auth-oauthlib` and `google-api-python-client` libraries

2. **Upload Trigger**:
   - After successful download completion (status = DONE)
   - `maybe_auto_upload()` checks:
     - Google Drive configuration exists and is enabled
     - Either global auto_upload is True OR job's upload_to_google_drive is True
     - Valid credentials are available
   - Calls Google Drive API `files.create()` to upload the file
   - Uploads to specified folder ID or root if none specified

3. **Token Security**:
   - OAuth2 tokens are encrypted at rest using Django's SECRET_KEY
   - Only decrypted in memory during API calls
   - Never logged or exposed in API responses

### Frontend

- Settings page: Google Drive card with connection status, controls, and test button
- Dashboard page: Per-download upload toggle in the download form
- Callback page: Handles OAuth redirect and exchanges code for tokens
- All interactions use secure API endpoints with JWT authentication

## Usage Examples

### Scenario 1: Selective Upload (Recommended)
1. In Settings → Google Drive:
   - Enable: ON
   - Auto-upload: OFF
   - Root Folder ID: (leave blank or set specific folder)
2. When adding downloads:
   - Toggle "Upload to Google Drive" ON for specific downloads you want mirrored
   - Leave OFF for downloads you don't want mirrored

### Scenario 2: Complete Automation
1. In Settings → Google Drive:
   - Enable: ON
   - Auto-upload: ON
   - Root Folder ID: "your_folder_id_here" (optional)
2. All completed downloads are automatically uploaded
3. Per-download toggle still available as override

### Scenario 3: Disabled
1. In Settings → Google Drive:
   - Enable: OFF
2. No uploads occur regardless of other settings

## Error Handling

### Authentication Errors
- Invalid/expired tokens: User must reconnect via Settings
- Missing credentials: Clear error message in UI
- OAuth failures: Detailed error messages during connection process

### Upload Errors
- Network issues: Logged internally, no UI disruption
- Permission errors: Check Google Drive folder permissions
- Quota exceeded: Monitor Google Drive storage usage
- File not found: Verifies file exists before upload attempt

### Frontend Error Display
- Connection errors shown in Settings page
- Upload failures logged to console (visible in browser dev tools)
- Automatic retry not implemented to avoid duplicate uploads

## Limitations

- **File Size**: Limited by Google Drive API constraints (currently 5TB per file)
- **File Types**: All file types supported by Google Drive
- **Simultaneous Uploads**: Uploads occur sequentially per download completion
- **Folder Changes**: Changing root_folder_id affects future uploads only
- **Team Drives**: Currently configured for personal My Drive (future enhancement for Shared Drives)

## Testing

Unit tests are available in:
- `backend/apps/integrations/tests/test_gdrive.py`
- `backend/apps/downloader/tests/test_upload_to_gdrive.py`

## Performance

- Uploads occur asynchronously via Celery (non-blocking to user interface)
- Only initiated after download completion
- Bandwidth usage: Concurrent with other applications
- Memory: Minimal footprint (token handling + API client)

## Troubleshooting

### "Google Drive not connected"
- Solution: Go to Settings → Google Drive and click "Connect Google Drive"

### "Invalid credentials"
- Solution: Reconnect Google Drive (tokens may have expired)

### Uploads not happening
- Check:
  1. Google Drive integration is enabled in Settings
  2. Either Auto-upload is ON or per-download toggle is enabled
  3. Download completed successfully (status = DONE)
  4. No error messages in browser console or server logs

### Permission errors
- Solution: Ensure the authenticated user has write access to the target folder