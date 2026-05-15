from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken

from apps.auth_app.models import User


@database_sync_to_async
def _user_from_token(token: str):
    try:
        access = AccessToken(token)
        uid = access.get("user_id")
        if uid is None:
            return AnonymousUser()
        return User.objects.get(pk=uid)
    except Exception:  # noqa: BLE001
        return AnonymousUser()


class JWTAuthMiddleware:
    """Populate scope['user'] from ?token=<jwt> on WebSocket handshakes."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope["type"] == "websocket":
            qs = parse_qs(scope.get("query_string", b"").decode())
            token = (qs.get("token") or [None])[0]
            scope["user"] = await _user_from_token(token) if token else AnonymousUser()
        return await self.inner(scope, receive, send)
