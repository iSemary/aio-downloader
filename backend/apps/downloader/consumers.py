import json

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from apps.downloader.models import DownloadJob


@database_sync_to_async
def _job_for_user(job_id, user):
    try:
        job = DownloadJob.objects.get(id=job_id)
    except DownloadJob.DoesNotExist:
        return None
    if job.user_id != user.id:
        return None
    return job


class DownloadProgressConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.job_id = self.scope["url_route"]["kwargs"]["job_id"]
        user = self.scope["user"]
        if user.is_anonymous:
            await self.close(code=4401)
            return
        job = await _job_for_user(self.job_id, user)
        if not job:
            await self.close(code=4404)
            return
        self.group = f"download_{self.job_id}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def download_event(self, event):
        await self.send(text_data=json.dumps(event["payload"]))
