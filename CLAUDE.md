# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

BBI Father is a Telegram Mini App for students to order and track practical coursework. Three components:

- **frontend/** — React 18 + TypeScript + MUI Mini App (the student/admin UI, opened inside Telegram)
- **backend/** — FastAPI (Python) REST API backed by Supabase (PostgreSQL), also handles Telegram notification delivery
- **bot.py** — a separate long-running Telegram bot process (python-telegram-bot, long polling — no webhook) that serves the Mini App launcher, admin commands, and calls back into the backend over `BOT_API_BASE_URL` (typically `http://127.0.0.1:8000/api`)

All three read config from a single root `.env` file (see `.env.example`).

## Commands

Run from the repo root unless noted.

```bash
# one-time setup
npm run setup            # copies .env.example -> .env, installs frontend + backend deps
npm run install:all

# local dev (each in its own terminal)
npm run dev:frontend     # cd frontend && npm start        (CRA dev server, port 3000, proxies /api to :8000)
npm run dev:backend      # cd backend && uvicorn main:app --reload
npm run dev:bot          # python bot.py

# frontend (from frontend/)
npm start
npm run build
npm run build:win        # Windows-only build with REACT_APP_VERSION/BUILD_TIME env vars set
npm test

# backend
cd backend && pip install -r requirements.txt
cd backend && ./start.sh              # production: gunicorn + gunicorn.conf.py (single worker, see below)
```

There is no backend/frontend automated test suite beyond the default CRA `npm test` scaffold — verify backend changes by running the server and exercising endpoints, and verify frontend changes in the browser.

## Architecture

### Backend (`backend/main.py`, single file, ~2400 lines)

- Every route is registered twice, once under `/api/...` and once bare (e.g. `@app.get("/api/orders")` and `@app.get("/orders")`) — keep both when adding or modifying routes; this dual-mounting exists so both the Mini App (via Nginx `/api` proxy) and the bot's direct internal calls work.
- Supabase is the only datastore — `init_database()` sets up the `Client`; there is no ORM. Tables: `students`, `subjects`, `orders` (see `DEPLOYMENT_GUIDE.md` for schema/SQL).
- Telegram delivery has two paths:
  - **Interactive**: `post_telegram(...)` — a single fast attempt (short timeout) used where a human is waiting on a bot reply.
  - **Background**: `queue_telegram_notification` → an in-process `queue.Queue` drained by `telegram_notification_worker()` (a background thread started in the FastAPI `lifespan`), with retry/backoff (`TELEGRAM_QUEUE_*` env vars). This queue lives in process memory — **do not increase Gunicorn `workers` above 1** (see `backend/gunicorn.conf.py` comment) or notifications will be split across independent queues and Telegram rate limits will be hit per-worker.
  - `enqueue_background(...)` is the usual call site: it uses FastAPI `BackgroundTasks` to fire-and-forget into the queue.
- `TELEGRAM_FORCE_IPV4` monkey-patches `socket.getaddrinfo` for `api.telegram.org` — needed because some hosts fail IPv6 to Telegram. `TELEGRAM_PROXY_URL` (SOCKS5) is optional and routes only Telegram Bot API traffic, not Supabase.
- Order status transitions send Telegram notifications to the student (`send_status_notification_to_user`) and, for the executor board, to a separate executor notification path (`notify_executors_board_entry`, `send_executor_notification`). When adding a new order status or field, check both notification paths plus the frontend `OrderStatus` enum in `frontend/src/types.ts`.
- File uploads/downloads for orders are stored on local disk under the backend's file directory and streamed back via `FileResponse`/zip (`download_all_files`); there's no object storage.
- `verify_internal_bot_request` gates bot-only endpoints — internal calls from `bot.py` are distinguished from public Mini App calls this way, not by network topology alone.

### Bot (`bot.py`)

- Long polling, not a webhook — safe to move domains without touching the bot (see `DEPLOYMENT_GUIDE.md` "Перенос на bbifather.site").
- Admin/executor chat IDs come from `TELEGRAM_ADMIN_CHAT_IDS` (comma/semicolon/space-separated, parsed by `parse_chat_ids`) plus dynamically-learned chat IDs from users matching `TELEGRAM_ADMIN_USERNAMES`. `MENU_REFRESH_ADMIN_ID` is hardcoded separately — only that one chat ID can trigger the keyboard-refresh broadcast command, even if other technical accounts are in `TELEGRAM_ADMIN_CHAT_IDS`.
- Talks to the backend only via `API_BASE_URL` (`BOT_API_BASE_URL`/`INTERNAL_API_BASE_URL`, defaults to the local loopback address) — this is intentional so the bot doesn't depend on the public domain/Nginx being up.
- Run exactly one bot instance at a time (see PM2 note in `DEPLOYMENT_GUIDE.md`) — Telegram long polling from two instances of the same token causes `Conflict` errors and dropped updates.

### Frontend (`frontend/src`)

- Routes (`App.tsx`): `/` orders list (`OrdersPage`), `/create` new order (`CreateOrderPage`), `/admin` (`AdminPage`), `/board` executor board (`OrdersBoard`). `CreateOrderPageNew.tsx` exists alongside `CreateOrderPage.tsx` — check which one is actually routed/used before editing order-creation logic.
- `api.ts` centralizes all backend calls through an axios instance; `API_BASE_URL` defaults to `window.location.origin` in production (Nginx proxies `/api` on the same origin) rather than a hardcoded domain — don't hardcode API hosts elsewhere.
- `getAllOrders` paginates through `getOrders` internally since the backend caps page size — prefer it over calling `getOrders` in a loop yourself.
- `hooks/useTelegramWebApp.ts` wraps the Telegram Web App JS SDK (injected by the Telegram client) for things like reading the launching user's identity — the app depends on running inside Telegram for full functionality, though it degrades to a plain browser session for direct visits.
- `types.ts` `Order`/`OrderStatus`/`PaymentMethod` are the source of truth for the data shape shared with the backend; there's no shared schema package, so keep this in sync with `backend/main.py` manually when changing the order model.
- `data/subjects.ts` holds the static subject/course catalog used by the order form.

## Environment configuration

All three processes load the **same root `.env`** (backend does `load_dotenv(dotenv_path=<repo_root>/.env)`; bot.py and CRA read it via their own mechanisms). Key variables (see `.env.example` for the full list with defaults):

- `SUPABASE_URL` / `SUPABASE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_IDS` — secrets, never commit real values.
- `FRONTEND_URLS` / `PUBLIC_BASE_URL` / `WEB_APP_URL` must all point at the same production domain when changing domains.
- `TELEGRAM_PROXY_URL` — keep only in `.env`, never in code or docs, per the comment in `.env.example`.

## Deployment

Production runs on a single VPS via PM2 (`bbifather-backend`, `bbifather-bot` processes) behind Nginx (`deploy/nginx-bbifather.site.conf`), with the backend served through Gunicorn (`backend/gunicorn.conf.py`, 1 worker — see queue note above). Full step-by-step (Supabase schema, Nginx, SSL, PM2 ecosystem files, domain migration) is in [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) — consult it before changing deploy-related files rather than guessing at server layout.
