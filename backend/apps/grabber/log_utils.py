import logging

from asgiref.sync import sync_to_async

from .models import GrabberLog, GrabberProject

logger = logging.getLogger(__name__)


def log(project_id: str, level: str, message: str, url: str = ""):
    try:
        GrabberLog.objects.create(
            project_id=project_id,
            level=level,
            message=message,
            url=url,
        )
    except Exception as e:
        logger.warning("Failed to save grabber log: %s", e)

    log_fn = getattr(logger, level, logger.info)
    log_fn("[%s] %s", project_id[:8], message)


async def log_async(project_id: str, level: str, message: str, url: str = ""):
    await sync_to_async(log)(project_id, level, message, url)
