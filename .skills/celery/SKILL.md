---
name: aio-downloader-celery
description: >-
  Manages Celery task configuration, periodic tasks, and async job execution
  for the AIO Downloader backend. Use when editing backend/config/celery.py,
  tasks modules in apps, or when the user mentions background jobs, workers,
  task queues, or periodic cleanup.
---

# AIO Downloader — Celery & Tasks

## Stack

- **Celery** with Redis broker
- **Periodic tasks** via `celery beat` schedule in `config/celery.py`
- **Task modules** live in each app: `apps/*/tasks.py`

## Configuration

- Celery app defined in `backend/config/celery.py`
- Broker: `REDIS_URL` env var (default `redis://localhost:6379/0`)
- Result backend: not used (status tracked via DB model fields + WebSocket events)
- Periodic tasks are declared in `celery.py` using `Celery.conf.beat_schedule`

## Task patterns

- **Shared tasks**: defined with `@shared_task(bind=True)` in `apps/*/tasks.py`
- **Progress reporting**: tasks update DB model fields (`progress`, `status`, `speed`, `eta`) and broadcast via Django Channels
- **Async generators**: when a task needs to yield intermediate results (e.g. crawl progress), use a wrapper pattern with `asyncio.run()` / `loop.run_until_complete()` and a `sync_to_async` progress callback
- **Error handling**: wrap core logic in try/except; save `error_message` on the model; log errors with both Django logger and DB log entries

## Worker lifecycle

```bash
# Start Celery worker (must restart after every backend code change)
cd backend && source venv/bin/activate && celery -A config worker -l info --pool=solo

# Start Celery beat for periodic tasks
cd backend && celery -A config beat -l info

# Kill all workers before restarting
pkill -f celery
```

## Periodic tasks

| Task | Schedule | Description |
|------|----------|-------------|
| `cleanup_expired_download_files` | Daily | Deletes files past per-user retention period |
| `cleanup_stale_crawls` | Every 10 min | Marks crawls stuck >6 hours as errored |

## Important notes

- **Import changes**: after adding new task modules or importing new modules in tasks, the Celery worker MUST be restarted to pick them up
- **Database calls in async tasks**: use `sync_to_async` wrapper for ORM calls inside `async def` generators
- **Channel layer**: use `await channel_layer.group_send(...)` inside async tasks; never `async_to_sync`
