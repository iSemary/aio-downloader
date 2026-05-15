---
name: aio-downloader-frontend
description: >-
  Implements and maintains the AIO Downloader Vite + React SPA (Tailwind v4,
  shadcn-style UI, react-router, Zustand, i18next, axios). Use when editing
  frontend/src, adding pages or components, styling, API wiring, locales, or
  when the user mentions the web UI, Vite, dashboard, settings, history, or
  storage screens.
---

# AIO Downloader — Frontend

## Stack

- **React 19** + **Vite 8**, **JS** (not TypeScript in app code; `@types/*` exists for tooling).
- **Tailwind CSS v4** via `@tailwindcss/vite`; global styles in `src/index.css` (`@import "tailwindcss"`, shadcn theme tokens).
- **UI**: Radix-based primitives under `src/components/ui/` (shadcn patterns), **lucide-react** icons, **sonner** toasts.
- **Router**: `react-router-dom` v7 — public `/login`, `/register`; private routes wrapped in `PrivateRoute` + `AppLayout` (`App.jsx`).
- **Data**: **axios** instance `api` from `@/api/client` (base `VITE_API_BASE_URL` or `http://localhost:8000/api`, Bearer + refresh on 401).
- **State**: **zustand** (`src/store/*`, persist on auth).
- **i18n**: `react-i18next` + `src/locales/{en,ar,de}.json` — **add keys to all three** when introducing user-visible strings.

## Paths & imports

- Alias **`@/`** → `src/` (`vite.config.js`, `jsconfig.json`).
- Prefer `@/components/...`, `@/api/client`, `@/store/...`, `@/lib/utils` (`cn`).

## Layout & pages

- **New screens** live in `src/pages/*.jsx`; register routes in `src/App.jsx`.
- **Chrome**: `AppLayout` + `AppSidebar` + `DashboardSiteHeader`; RTL handled for Arabic (`ar`) in sidebar/header.
- **Page title** (route name, e.g. Settings): use **`<h5 className="text-2xl font-bold tracking-tight text-foreground">`** — not `h1`.
- **Page hero** (optional but consistent on list/settings pages): row with **`size-12` icon tile** (`rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20`) + title + `text-pretty text-muted-foreground` description.

## Cards & forms

- **Section cards**: `Card` with `className="overflow-hidden border-border/80 shadow-sm"`; header often `className="border-b bg-muted/30"` with **icon in `size-11 rounded-xl`** (muted or tinted `bg-*-500/15`) + `CardTitle` (`text-xl`) + `CardDescription` (`text-pretty`).
- **Forms**: Tailwind **`grid gap-*`**; pair fields with **`sm:grid-cols-2`** or **`md:grid-cols-*`**; stack actions **`flex-col-reverse gap-2 sm:flex-row`** on mobile.
- **Touch-friendly**: primary fields/buttons **`min-h-11`** where appropriate.
- **Tables**: wrap in **`-mx-1 overflow-x-auto rounded-lg border sm:mx-0`** (or similar) so horizontal scroll works on small viewports.
- **Dense actions**: icon + label; hide label with **`hidden sm:inline`** if space is tight.

## API usage

- Use **`api.get/post/patch/delete`** from `@/api/client`; handle errors with **`toast`** from `sonner` and `err.response?.data?.detail` (or field errors) when present.
- Do not hardcode a new base URL; use env + existing client.

## Conventions (match the codebase)

- **Functional components**, hooks at top; keep files focused.
- Reuse **`Button`**, **`Input`**, **`Label`**, **`Card`**, **`Select`**, **`Table`**, **`Badge`**, **`Separator`**, **`Switch`** from `@/components/ui/*`.
- **Icons**: `lucide-react`; keep `aria-hidden` on decorative icons.
- **Charts / dashboard**: Recharts patterns already in `Dashboard.jsx` — follow existing structure for new stats.
- **Do not** add new markdown docs or README edits unless the user asks.
- **Do not** widen scope (no drive-by refactors unrelated to the task).
- After substantive edits, run **`npm run build`** from `frontend/` to verify compile.

## Commands

```bash
cd frontend && npm run dev    # Vite dev server (default port 5173)
cd frontend && npm run build
cd frontend && npm run lint   # may report pre-existing issues; fix new ones you introduce
```

## Quick file map

| Area | Location |
|------|----------|
| Routes | `src/App.jsx` |
| Layout / nav | `src/components/layout/` |
| Pages | `src/pages/` |
| API | `src/api/client.js` |
| Stores | `src/store/` |
| Strings | `src/locales/en.json` (+ `ar.json`, `de.json`) |
| Utilities | `src/lib/utils.js`, `src/lib/formatBytes.js` |

When unsure, mirror **`Dashboard.jsx`**, **`Settings.jsx`**, or **`History.jsx`** for structure, spacing, and responsive behavior.
