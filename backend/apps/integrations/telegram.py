import asyncio
import logging
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from telegram import Bot, InputFile

from django.utils import timezone

from apps.downloader.models import DownloadJob
from apps.integrations.crypto import decrypt_str
from apps.integrations.models import TelegramConfig


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


async def _send_file_async(token: str, chat_id: str, file_path: Path, caption: str | None = None):
    bot = Bot(token)
    size = file_path.stat().st_size if file_path.exists() else 0
    if size > 50 * 1024 * 1024:
        raise ValueError("File exceeds Telegram Bot API 50 MB limit. Use a local Bot API server for larger files.")
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


def send_job_to_telegram(job: DownloadJob, user_cfg: TelegramConfig) -> None:
    if not user_cfg.chat_id:
        raise ValueError("Telegram receiver (chat or channel ID) is not configured.")
    token = get_owner_bot_token()
    root = settings.MEDIA_ROOT
    rel = job.file_path
    if not rel:
        raise ValueError("No file on disk for this job.")
    path = root / rel
    if not path.is_file():
        raise ValueError("File missing on disk.")
    _run(_send_file_async(token, user_cfg.chat_id, path, caption=job.title))


def maybe_auto_send(job: DownloadJob) -> None:
    try:
        cfg = TelegramConfig.objects.get(user=job.user, enabled=True, auto_send=True)
    except TelegramConfig.DoesNotExist:
        return
    if not cfg.chat_id:
        return
    try:
        get_owner_bot_token()
    except ValueError:
        return
    try:
        send_job_to_telegram(job, cfg)
        DownloadJob.objects.filter(pk=job.pk).update(sent_to_telegram=True, telegram_sent_at=timezone.now())
    except Exception:
        logging.getLogger(__name__).exception("Auto Telegram send failed")


async def test_connection_async(token: str, chat_id: str) -> str:
    bot = Bot(token)
    await bot.send_message(chat_id=chat_id, text="AIO Downloader: connection test OK.")
    return "ok"


def test_connection(token: str, chat_id: str) -> str:
    return _run(test_connection_async(token, chat_id))
