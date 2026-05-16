---
name: aio-downloader-websocket
description: >-
  Manages Django Channels WebSocket consumers, routing, and real-time event
  streaming for the AIO Downloader project. Use when editing consumers,
  channel layers, WS auth, or when the user mentions live updates, real-time
  progress, or WebSocket events.
---

# AIO Downloader — WebSocket / Channels

## Stack

- **Django Channels** with Redis channel layer
- **ASGI**: Daphne serves both HTTP and WebSocket
- **Auth**: JWT token verified during WebSocket handshake (via `channels.auth` or custom middleware)

## Architecture

- WebSocket connections are per-job (or per-project for grabber), authenticated via JWT token passed as a query param during connection
- Events flow from **Celery tasks → channel layer → consumer → frontend**
- Consumers are `AsyncWebsocketConsumer` subclasses (not `JsonWebsocketConsumer`)

## Consumer patterns

- **`async def connect()`**: accepts connection, validates user/token, creates/joins a group named after the job/project UUID
- **`async def disconnect()`**: leaves the group
- **`async def receive()`**: typically not used (server→client only), but can handle ping/pong
- **Event handlers**: named `async def job_event(self, event)` — receive dict from `channel_layer.group_send` and forward to WebSocket as JSON

## Sending events from Celery tasks

```python
from asgiref.sync import sync_to_async
from channels.layers import get_channel_layer

# Inside an async context:
channel_layer = get_channel_layer()
await channel_layer.group_send(
    f"job_{job_id}",
    {
        "type": "job.progress",
        "progress": 50,
        "speed": "5.2 MB/s",
        "eta": "30s",
    }
)
```

## Frontend integration

- `JobWebSocketListener` component in `frontend/src/components/` manages connection lifecycle per job WS ID
- **Zustand store** (`useDownloadStore`) is the single source of truth; WS messages call store methods (`upsertJob`, `updateJobProgress`) to update UI
- Reconnection on WS close is handled client-side

## Key files

| File | Purpose |
|------|---------|
| `backend/config/asgi.py` | ASGI routing — ProtocolTypeRouter for HTTP + WebSocket |
| `backend/config/routing.py` | WebSocket URL routing |
| `backend/apps/*/consumers.py` | Consumer classes per feature area |
| `frontend/src/components/JobWebSocketListener.jsx` | Client-side WS connection component |

## Commands

```bash
cd backend && python manage.py runserver  # Daphne dev server (handles WS)
```
