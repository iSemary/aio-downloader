import base64
import logging
from pathlib import Path

from django.conf import settings

from apps.downloader.models import DownloadJob, DownloadedFile
from apps.integrations.crypto import encrypt_str, decrypt_str
from apps.integrations.models import GoogleDriveConfig

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive.file"]


def _get_client_config() -> dict:
    client_id = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "")
    client_secret = getattr(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        raise ValueError("Google OAuth not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.")
    return {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uris": [getattr(settings, "GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:5173/integrations/gdrive/callback/")],
        }
    }


def get_user_config(user) -> GoogleDriveConfig | None:
    try:
        return GoogleDriveConfig.objects.get(user=user)
    except GoogleDriveConfig.DoesNotExist:
        return None


def get_user_credentials(user) -> dict | None:
    cfg = get_user_config(user)
    if not cfg or not cfg.credentials_encrypted:
        return None
    try:
        encrypted = cfg.credentials_encrypted.get("token", "")
        if not encrypted:
            return None
        decrypted = decrypt_str(encrypted)
        import json
        return json.loads(decrypted)
    except Exception:
        logger.exception("Failed to decrypt Google Drive credentials")
        return None


def save_user_credentials(user, credentials: dict) -> None:
    cfg, _ = GoogleDriveConfig.objects.get_or_create(user=user)
    import json
    encrypted_token = encrypt_str(json.dumps(credentials))
    cfg.credentials_encrypted = {"token": encrypted_token}
    cfg.save()


def build_credentials(user) -> "google.oauth2.credentials.Credentials":
    creds_data = get_user_credentials(user)
    if not creds_data:
        raise ValueError("No credentials for user")
    from google.oauth2.credentials import Credentials
    return Credentials(**creds_data)


def get_authorization_url(user_id: int) -> tuple[str, str]:
    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_config(_get_client_config(), scopes=SCOPES)
    state = str(user_id)
    flow.redirect_uri = getattr(settings, "GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:5173/integrations/gdrive/callback/")
    auth_url, _ = flow.authorization_url(prompt="consent", state=state)
    return auth_url, state


def exchange_code(user_id: int, code: str) -> None:
    from google_auth_oauthlib.flow import Flow
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        raise ValueError("User not found")
    flow = Flow.from_client_config(_get_client_config(), scopes=SCOPES)
    flow.redirect_uri = getattr(settings, "GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:5173/integrations/gdrive/callback/")
    flow.fetch_token(code=code)
    save_user_credentials(user, flow.credentials.to_dict())


def get_drive_service(user):
    from googleapiclient.discovery import build
    creds = build_credentials(user)
    return build("drive", "v3", credentials=creds)


def upload_file(user, file_path: Path, folder_id: str = None) -> str:
    from googleapiclient.http import MediaFileUpload
    service = get_drive_service(user)
    metadata = {
        "name": file_path.name,
        "parents": [folder_id] if folder_id else [],
    }
    media = MediaFileUpload(str(file_path), resumable=True)
    result = service.files().create(body=metadata, media_body=media, fields="id").execute()
    return result.get("id", "")


def maybe_auto_upload(job: DownloadJob) -> None:
    try:
        cfg = get_user_config(job.user)
    except Exception:
        return
    if not cfg or not cfg.enabled:
        return
    # Check both global auto-upload and per-job upload setting
    if not (cfg.auto_upload or job.upload_to_google_drive):
        return
    try:
        build_credentials(job.user)
    except Exception:
        return
    dfile = DownloadedFile.objects.filter(job=job, is_deleted=False).order_by("-created_at").first()
    if not dfile:
        return
    root = settings.MEDIA_ROOT
    rel = dfile.file_path
    if not rel:
        return
    path = root / rel
    if not path.is_file():
        return
    try:
        upload_file(job.user, path, cfg.root_folder_id or None)
    except Exception:
        logger.exception("Google Drive upload failed")


def test_connection(user) -> str:
    service = get_drive_service(user)
    about = service.about().get(fields="user").execute()
    return about.get("user", {}).get("emailAddress", "unknown")