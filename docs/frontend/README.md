# Frontend (React SPA)

## Stack

- **React 19** + **Vite** + **Tailwind 4** + shadcn-style UI under `frontend/src/components/ui/`.
- **Routing** — `react-router-dom` in `frontend/src/App.jsx` (private layout wraps dashboard, downloads, queue, history, storage, settings, grabber, sites).
- **State** — `zustand` stores in `frontend/src/store/` (`useAuthStore`, `useDownloadStore`, `useThemeStore`).
- **API** — Axios instance `frontend/src/api/client.js` (JWT on requests, refresh on 401).
- **i18n** — `react-i18next`; strings in `frontend/src/locales/{en,ar,de}.json`.

## Environment variables

| Variable | Role |
|----------|------|
| `VITE_API_BASE_URL` | REST API base (default `http://localhost:8000/api`). |
| `VITE_WS_BASE_URL` | WebSocket origin for progress (default `ws://localhost:8000`). |

See `frontend/.env.example`.

## Download progress (WebSocket)

- Hook `frontend/src/hooks/useJobWebSocket.js` opens `ws://…/ws/downloads/<job_id>/?token=<access_jwt>`.
- `JobWebSocketListener` mounts the hook for a given `jobId` (used on Dashboard and Queue for active jobs).
- Messages: `progress` (may include `bytes_downloaded`, `expected_size` for HTTP), `done`, `error`, `paused`, `playlist_enqueued`.

## Queue manager UI

- Page: `frontend/src/pages/Queue.jsx` (route `/queue`).
- Resizable split: `react-resizable-panels` (`Group` / `Panel` / `Separator`).
- Virtualized list: `@tanstack/react-virtual`.
- Command palette: `cmdk` (⌘K / Ctrl+K).
- Motion: `motion/react` for light transitions on the inspector card.
- Reorder: `@dnd-kit` sortable sheet + `POST /api/downloads/reorder/`.
- Bulk URLs: `POST /api/downloads/bulk/`.

## Sidebar navigation

- **Downloads** — All Downloads, Unfinished, Finished, Scheduled (filter via query params: `?filter=unfinished|finished|scheduled`)
- **Categories** — Compressed, Documents, Music/Video, Programs
- **Automation** — Grabber (`/grabber`), Sites Manager (`/sites`)
- **Application** — Dashboard, Queue, Bulk add, Analyze, Playlists, History, Storage, Settings
- Resizable (drag right edge, 13rem–24rem)

## Related code

- `frontend/src/components/layout/AppLayout.jsx` — shell, sidebar, header.
- `frontend/src/components/layout/AppSidebar.jsx` — navigation items.
- `frontend/src/pages/Dashboard.jsx` — stats, new download form, active jobs.
- `frontend/src/pages/History.jsx` — paginated job table.
- `frontend/src/pages/Downloads.jsx` — filtered job list page.
- `frontend/src/pages/Grabber.jsx` — media grabber page.
- `frontend/src/pages/SitesManager.jsx` — sites manager page.
