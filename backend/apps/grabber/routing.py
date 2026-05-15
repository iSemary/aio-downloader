from django.urls import re_path

from .consumers import GrabberConsumer

websocket_urlpatterns = [
    re_path(r"ws/grabber/(?P<project_id>[0-9a-f-]+)/$", GrabberConsumer.as_asgi()),
]
