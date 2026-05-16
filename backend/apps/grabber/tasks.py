import asyncio
import logging
from datetime import datetime

from asgiref.sync import async_to_sync, sync_to_async
from celery import shared_task
from channels.layers import get_channel_layer
from django.db import transaction
from django.utils import timezone

from apps.downloader.classification import classify_download
from apps.downloader.models import DownloadJob
from apps.downloader.tasks import enqueue_download

from .crawler import run_crawl
from .filters import FilterEngine, classify_file_extension
from .log_utils import log
from .models import GrabberCrawlTask, GrabberDiscoveredFile, GrabberProject

logger = logging.getLogger(__name__)


def send_ws_event(project_id: str, event_type: str, data: dict):
    """Send a WebSocket event to the project's channel group."""
    try:
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"grabber_{project_id}",
                {"type": "grabber.event", "event": event_type, "data": data},
            )
    except Exception as e:
        logger.warning("WS send failed: %s", e)


@shared_task(bind=True, max_retries=1)
def crawl_project_task(self, project_id: str):
    """Main Celery task for crawling a project."""
    project = GrabberProject.objects.select_related("user").prefetch_related("filters").get(id=project_id)

    if project.status not in (GrabberProject.Status.CRAWLING, GrabberProject.Status.IDLE):
        logger.info("Project %s is not in a crawlable state (%s)", project_id, project.status)
        return

    project.status = GrabberProject.Status.CRAWLING
    project.started_at = timezone.now()
    project.pages_crawled = 0
    project.files_discovered = 0
    project.save(update_fields=["status", "started_at", "pages_crawled", "files_discovered"])

    log(project_id, "info", "Crawl started")
    send_ws_event(project_id, "crawl_started", {"project_id": project_id})

    filter_engine = FilterEngine(project)

    async def progress_callback(child_count, file_count, pages_done, files_done):
        from asgiref.sync import sync_to_async

        await sync_to_async(GrabberProject.objects.filter(id=project_id).update)(
            pages_crawled=pages_done + 1,
            files_discovered=files_done + file_count,
        )
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                await channel_layer.group_send(
                    f"grabber_{project_id}",
                    {
                        "type": "grabber.event",
                        "event": "crawl_progress",
                        "data": {
                            "project_id": project_id,
                            "pages_crawled": pages_done + 1,
                            "files_discovered": file_count,
                            "pending_tasks": child_count,
                        },
                    },
                )
        except Exception:
            pass

    def sync_crawl():
        agen = run_crawl(project, filter_engine, progress_callback)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            while True:
                try:
                    yield loop.run_until_complete(agen.__anext__())
                except StopAsyncIteration:
                    break
        finally:
            loop.close()

    try:
        file_counter = 0

        for file_info in sync_crawl():
            discovered_file = _process_discovered_file(project, file_info)
            if discovered_file:
                file_counter += 1
            log(project_id, "info", f"Discovered: {file_info.get('file_name', '')} ({file_info.get('file_type', 'other')})", file_info.get("url", ""))
            send_ws_event(project_id, "file_discovered", {
                "project_id": project_id,
                "file_id": str(discovered_file.id) if discovered_file else None,
                "file_name": file_info.get("file_name", ""),
                "file_type": file_info.get("file_type", "other"),
                "total_discovered": file_counter,
            })

        project.refresh_from_db()
        project.status = GrabberProject.Status.DONE
        project.completed_at = timezone.now()
        project.save(update_fields=["status", "completed_at"])
        log(project_id, "info", f"Crawl completed — {project.pages_crawled} pages, {project.files_discovered} files")
        send_ws_event(project_id, "crawl_completed", {
            "project_id": project_id,
            "pages_crawled": project.pages_crawled,
            "files_discovered": project.files_discovered,
        })

    except Exception as e:
        logger.exception("Crawl failed for project %s", project_id)
        project.refresh_from_db()
        project.status = GrabberProject.Status.ERROR
        project.error_message = str(e)
        project.save(update_fields=["status", "error_message"])
        log(project_id, "error", f"Crawl failed: {e}")
        send_ws_event(project_id, "crawl_error", {
            "project_id": project_id,
            "error": str(e),
        })
        raise


def _process_discovered_file(project, file_info: dict):
    url = file_info.get("url", "")
    file_name = file_info.get("file_name", "")
    extension = file_info.get("extension", "")
    detected_type = file_info.get("file_type") or classify_file_extension(extension)
    page_url = file_info.get("page_url", "")

    existing = GrabberDiscoveredFile.objects.filter(
        project=project,
        file_url=url,
    ).first()
    if existing:
        return existing

    return GrabberDiscoveredFile.objects.create(
        project=project,
        crawl_task=None,
        file_url=url,
        file_name=file_name or url.rsplit("/", 1)[-1][:60] or "unnamed",
        file_size=0,
        file_type=detected_type,
        extension=extension,
        page_url=page_url,
    )


@shared_task
def queue_file_download_task(file_id: str, project_id: str):
    """Queue a download for a discovered file through the existing DownloadJob pipeline."""
    discovered_file = GrabberDiscoveredFile.objects.select_related("project__user").get(
        id=file_id, project_id=project_id
    )
    if discovered_file.download_job_id:
        logger.info("File %s already has a download job", file_id)
        return

    classification = classify_download(discovered_file.file_url)
    download_job = DownloadJob.objects.create(
        user=discovered_file.project.user,
        source_url=discovered_file.file_url,
        title=discovered_file.file_name,
        platform=classification.get("engine", "http"),
        engine=classification.get("engine", "http"),
        media_kind=classification.get("media_kind", "other"),
    )
    discovered_file.download_job = download_job
    discovered_file.status = GrabberDiscoveredFile.Status.QUEUED
    discovered_file.save(update_fields=["download_job", "status"])

    enqueue_download.delay(str(download_job.id))

    send_ws_event(project_id, "file_queued", {
        "file_id": str(discovered_file.id),
        "download_job_id": str(download_job.id),
    })


@shared_task
def queue_bulk_download_task(file_ids: list, project_id: str):
    for file_id in file_ids:
        queue_file_download_task.delay(file_id, project_id)


@shared_task
def stop_crawl_project_task(project_id: str):
    project = GrabberProject.objects.get(id=project_id)
    project.status = GrabberProject.Status.IDLE
    project.completed_at = timezone.now()
    project.save(update_fields=["status", "completed_at"])
    send_ws_event(project_id, "crawl_stopped", {"project_id": project_id})


@shared_task
def pause_crawl_project_task(project_id: str):
    project = GrabberProject.objects.get(id=project_id)
    project.status = GrabberProject.Status.PAUSED
    project.save(update_fields=["status"])
    send_ws_event(project_id, "crawl_paused", {"project_id": project_id})


@shared_task
def scheduled_recrawl(project_id: str):
    project = GrabberProject.objects.get(id=project_id)
    if project.status == GrabberProject.Status.IDLE:
        crawl_project_task.delay(str(project.id))


@shared_task
def cleanup_stale_crawls():
    """Periodic task to mark projects stuck in 'crawling' for > 6 hours as error."""
    threshold = timezone.now() - timezone.timedelta(hours=6)
    stale = GrabberProject.objects.filter(
        status=GrabberProject.Status.CRAWLING,
        started_at__lt=threshold,
    )
    count = stale.update(
        status=GrabberProject.Status.ERROR,
        error_message="Crawl was stuck for more than 6 hours and was automatically cancelled.",
    )
    if count:
        logger.info("Marked %s stale crawl projects as error", count)


@shared_task
def cleanup_expired_grabber_files():
    """Remove grabber discovered files older than 30 days that were never downloaded."""
    threshold = timezone.now() - timezone.timedelta(days=30)
    deleted, _ = GrabberDiscoveredFile.objects.filter(
        status=GrabberDiscoveredFile.Status.DISCOVERED,
        created_at__lt=threshold,
    ).delete()
    if deleted:
        logger.info("Cleaned up %s expired grabber files", deleted)
