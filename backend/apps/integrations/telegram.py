import asyncio
import logging
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from telegram import Bot, InputFile

from apps.downloader.models import DownloadJob, DownloadedFile
from apps.integrations.crypto import decrypt_str
from apps.integrations.models import TelegramConfig, TelegramSend


def _run(coro):
    return asyncio.run(coro)


def owner_has_bot_token() -> bool:
    User = get_user_model()
    owner = User.objects.filter(role=User.Role.OWNER).order_by("pk").first()
    if not owner:
        return False
    return TelegramConfig.objects.filter(user=owner).exclude(bot_token_encrypted="").exists()


def get_owner_bot_token() -> str:
    User = get_user_model()
    owner = User.objects.filter(role=User.Role.OWNER).order_by("pk").first()
    if not owner:
        raise ValueError("No project owner account exists.")
    cfg = TelegramConfig.objects.filter(user=owner).first()
    if cfg is None or not cfg.bot_token_encrypted:
        raise ValueError("The project owner has not configured the Telegram bot token yet.")
    return decrypt_str(cfg.bot_token_encrypted)


def _make_bot(token: str, owner_cfg: TelegramConfig | None) -> Bot:
    if owner_cfg and owner_cfg.use_local_bot_api and owner_cfg.local_bot_api_url:
        base = owner_cfg.local_bot_api_url.rstrip("/")
        return Bot(
            token,
            base_url=f"{base}/bot{token}/",
            base_file_url=f"{base}/file/bot{token}/",
        )
    return Bot(token)


async def _send_file_async(
    bot: Bot,
    chat_id: str,
    file_path: Path,
    caption: str | None = None,
):
    size = file_path.stat().st_size if file_path.exists() else 0
    ext = file_path.suffix.lower()
    with open(file_path, "rb") as f:
        data = f.read()
    if ext in {".mp4", ".webm", ".mov", ".mkv"}:
        await bot.send_video(
            chat_id=chat_id,
            video=InputFile(data, filename=file_path.name),
            caption=caption or file_path.name,
        )
    else:
        await bot.send_document(
            chat_id=chat_id,
            document=InputFile(data, filename=file_path.name),
            caption=caption,
        )


def get_owner_telegram_config() -> TelegramConfig | None:
    User = get_user_model()
    owner = User.objects.filter(role=User.Role.OWNER).order_by("pk").first()
    if not owner:
        return None
    return TelegramConfig.objects.filter(user=owner).first()


def send_downloaded_file_to_telegram(
    job: DownloadJob,
    user_cfg: TelegramConfig,
    dfile: DownloadedFile,
    *,
    owner_cfg: TelegramConfig | None = None,
) -> TelegramSend:
    if not user_cfg.chat_id:
        raise ValueError("Telegram receiver (chat or channel ID) is not configured.")
    token = get_owner_bot_token()
    root = settings.MEDIA_ROOT
    rel = dfile.file_path
    if not rel:
        raise ValueError("No file path for this download.")
    path = root / rel
    if not path.is_file():
        raise ValueError("File missing on disk.")

    max_mb = int(user_cfg.max_file_size_mb or 50)
    size = path.stat().st_size if path.exists() else 0
    if size > max_mb * 1024 * 1024:
        raise ValueError(f"File exceeds configured limit of {max_mb} MB.")

    owner_cfg = owner_cfg or get_owner_telegram_config()
    bot = _make_bot(token, owner_cfg)

    send_row = TelegramSend.objects.create(
        config=user_cfg,
        file=dfile,
        job=job,
        status=TelegramSend.Status.PENDING,
        attempt_count=1,
    )
    try:
        _run(_send_file_async(bot, user_cfg.chat_id, path, caption=job.title))
        TelegramSend.objects.filter(pk=send_row.pk).update(
            status=TelegramSend.Status.SENT,
            sent_at=timezone.now(),
        )
    except Exception:
        logging.getLogger(__name__).exception("Telegram send failed")
        TelegramSend.objects.filter(pk=send_row.pk).update(
            status=TelegramSend.Status.FAILED,
            error_message="Send failed",
        )
        raise
    return send_row


def send_job_to_telegram(job: DownloadJob, user_cfg: TelegramConfig) -> TelegramSend:
    dfile = DownloadedFile.objects.filter(job=job, is_deleted=False).order_by("-created_at").first()
    if not dfile:
        raise ValueError("No file on disk for this job.")
    return send_downloaded_file_to_telegram(job, user_cfg, dfile, owner_cfg=get_owner_telegram_config())


def maybe_auto_send(job: DownloadJob) -> None:
    try:
        prefs = job.user.preferences
    except Exception:
        return
    if not prefs.auto_send_telegram:
        return
    try:
        cfg = TelegramConfig.objects.get(user=job.user, enabled=True)
    except TelegramConfig.DoesNotExist:
        return
    if not cfg.chat_id:
        return
    try:
        get_owner_bot_token()
    except ValueError:
        return
    dfile = DownloadedFile.objects.filter(job=job, is_deleted=False).order_by("-created_at").first()
    if not dfile:
        return
    try:
        send_downloaded_file_to_telegram(job, cfg, dfile)
    except Exception:
        logging.getLogger(__name__).exception("Auto Telegram send failed")


async def test_connection_async(token: str, chat_id: str, owner_cfg: TelegramConfig | None = None) -> str:
    bot = _make_bot(token, owner_cfg)
    await bot.send_message(chat_id=chat_id, text="AIO Downloader: connection test OK.")
    return "ok"


def test_connection(token: str, chat_id: str, owner_cfg: TelegramConfig | None = None) -> str:
    return _run(test_connection_async(token, chat_id, owner_cfg))


def send_failure_alert(job: DownloadJob) -> None:
    try:
        prefs = job.user.preferences
    except Exception:
        return
    if not prefs.notify_on_failure:
        return
    try:
        cfg = TelegramConfig.objects.get(user=job.user, enabled=True)
    except TelegramConfig.DoesNotExist:
        return
    if not cfg.chat_id:
        return
    try:
        get_owner_bot_token()
    except ValueError:
        return

    owner_cfg = get_owner_telegram_config()
    token = get_owner_bot_token()
    bot = _make_bot(token, owner_cfg)
    error_msg = job.error_message or "Unknown error"
    text = f"Download failed: {job.title}\nError: {error_msg[:500]}"
    try:
        _run(bot.send_message(chat_id=cfg.chat_id, text=text))
    except Exception:
        logging.getLogger(__name__).exception("Telegram failure alert failed")
