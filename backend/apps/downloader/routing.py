from django.urls import path

from .consumers import DownloadProgressConsumer

websocket_urlpatterns = [
    path("ws/downloads/<uuid:job_id>/", DownloadProgressConsumer.as_asgi()),
]
