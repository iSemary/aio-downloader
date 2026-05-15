import asyncio
import logging
from pathlib import Path

from django.conf import settings
from telegram import Bot, InputFile

from apps.downloader.models import DownloadJob
from apps.integrations.crypto import decrypt_str
from apps.integrations.models import TelegramConfig


def _run(coro):
    return asyncio.run(coro)


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


def send_job_to_telegram(job: DownloadJob, cfg: TelegramConfig) -> None:
    if not cfg.bot_token_encrypted or not cfg.chat_id:
        raise ValueError("Telegram is not configured.")
    token = decrypt_str(cfg.bot_token_encrypted)
    root = settings.MEDIA_ROOT
    rel = job.file_path
    if not rel:
        raise ValueError("No file on disk for this job.")
    path = root / rel
    if not path.is_file():
        raise ValueError("File missing on disk.")
    _run(_send_file_async(token, cfg.chat_id, path, caption=job.title))


def maybe_auto_send(job: DownloadJob) -> None:
    try:
        cfg = TelegramConfig.objects.get(user=job.user, enabled=True, auto_send=True)
    except TelegramConfig.DoesNotExist:
        return
    if not cfg.bot_token_encrypted:
        return
    try:
        send_job_to_telegram(job, cfg)
        DownloadJob.objects.filter(pk=job.pk).update(sent_to_telegram=True)
    except Exception:
        logging.getLogger(__name__).exception("Auto Telegram send failed")


async def test_connection_async(token: str, chat_id: str) -> str:
    bot = Bot(token)
    await bot.send_message(chat_id=chat_id, text="AIO Downloader: connection test OK.")
    return "ok"


def test_connection(token: str, chat_id: str) -> str:
    return _run(test_connection_async(token, chat_id))
