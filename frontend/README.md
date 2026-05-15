# AIO Downloader — Frontend

Vite + React 19 SPA for the downloader dashboard: auth, downloads, history, storage browser, settings (Telegram + profile), and a live-progress dashboard wired to the Django API and WebSockets.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (default **http://localhost:5173**) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint |

## Environment

Copy [`.env.example`](.env.example) to `.env` (or `.env.local`).

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | REST API base, e.g. `http://localhost:8000/api` |
| `VITE_WS_BASE_URL` | WebSocket origin, e.g. `ws://localhost:8000` (no trailing path; job path is appended in code) |

The backend must allow your dev origin in CORS (already includes `http://localhost:5173` in development settings).

## Project structure (high level)

```
src/
  api/client.js          Axios instance + JWT attach + 401 refresh
  components/
    layout/AppLayout.jsx Sidebar + header + theme toggle + outlet
    ui/                  shadcn-style primitives
    PrivateRoute.jsx
    JobWebSocketListener.jsx
  hooks/useJobWebSocket.js
  pages/                 Login, Register, Dashboard, History, Storage, Settings
  store/                 useAuthStore, useDownloadStore, useThemeStore
  lib/formatBytes.js
  App.jsx                React Router routes
  main.jsx               TooltipProvider, Toaster, theme bootstrapping
```

## Routing

| Path | Notes |
| --- | --- |
| `/login`, `/register` | Public |
| `/dashboard`, `/history`, `/storage`, `/settings` | Behind `PrivateRoute` (requires access token in persisted Zustand store) |

## State and API

- **Auth:** Zustand + `localStorage` persist (`aio-auth-storage`). Login/register store `access` / `refresh`; `/auth/me/` fills `user`.
- **Downloads:** `useDownloadStore` holds active jobs updated by `useJobWebSocket` (JWT passed as `?token=` query param on the WebSocket handshake).
- **Theme:** `useThemeStore` — system / light / dark; `document.documentElement` class `dark` for Tailwind.

## shadcn / Tailwind

Styling uses Tailwind v4 with CSS variables in `src/index.css` and components under `src/components/ui/`. New primitives can be added with `npx shadcn@latest add <component>`.

## Related docs

- Root overview and full stack runbook: **[../README.md](../README.md)**
- Backend API, Celery, Channels: **[../backend/README.md](../backend/README.md)**
