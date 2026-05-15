import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

django_asgi_app = get_asgi_application()

from apps.downloader.routing import websocket_urlpatterns as download_ws  # noqa: E402
from apps.grabber.routing import websocket_urlpatterns as grabber_ws  # noqa: E402
from config.token_auth import JWTAuthMiddleware  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            JWTAuthMiddleware(URLRouter(download_ws + grabber_ws))
        ),
    }
)
