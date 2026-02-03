# CommunityChat

Monorepo scaffold for CommunityChat (frontend + backend).

Setup (local):

1. Install deps (recommended: pnpm or npm/yarn)

```bash
pnpm install
```

2. Copy `.env.example` to `.env` and update values.

3. Run dev (from root):

```bash
pnpm install
pnpm run dev
```

Database / Prisma setup (backend):

- Ensure `DATABASE_URL` in `.env` points to a PostgreSQL database.
- From the `backend/` folder run:

```bash
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:migrate
```

Note: If you encounter Prisma CLI version issues when running `npx prisma`, run the CLI version that matches the `prisma` devDependency, e.g. `npx prisma@5 ...` or use your package manager scripts as above.

Socket / messaging tests (manual):

- Start backend and frontend, log in two users.
- Open two browser windows, join the same workspace/channel.
- Send messages from one client and verify the other receives real-time updates.
- Test editing and deleting messages from the author account (edits/deletes should broadcast updates).
- Test mentions by typing `@username` (backend resolves mentions by `name`), verify mentioned user receives a `notification` event.

## Tuning Socket Rate Limits 🔧

You can tune socket rate limits via environment variables (set in your `.env` file):

```
SOCKET_RATE_LIMIT_SEND_MESSAGES=5
SOCKET_RATE_LIMIT_SEND_WINDOW_MS=10000
SOCKET_RATE_LIMIT_EDIT_MESSAGES=10
SOCKET_RATE_LIMIT_EDIT_WINDOW_MS=10000
```

Recommended starting values:

- Small community / low traffic: SEND=5, EDIT=10
- Medium community: SEND=10, EDIT=20
- High traffic: reduce per-socket limits and adopt a Redis-backed global rate limiter for distributed systems (recommended for production-scale deployments)

For very high-traffic deployments, consider switching to a Redis-backed rate limiter and applying per-user or global limits rather than only per-socket.

File upload testing (manual):

- Supported types: images (jpg/jpeg/png/gif/webp) and common documents (pdf, txt, docx). Max file size: 10MB.
- Upload workflow:
  1. In the chat input press the 📎 button and select files (or drag-and-drop if added later).
  2. Files are uploaded to `POST /api/upload` and returned as attachment metadata.
  3. The client sends message including `attachments` array (URL/filename/mimeType/size) via socket or REST.
  4. Verify image files render inline in messages and other files render as downloadable links.

- Troubleshooting:
  - If uploads fail, check backend logs for `multer` errors and ensure `uploads/` directory is writable.
  - If images don't display, verify the returned `url` (should be `http://localhost:<PORT>/uploads/<filename>` or set `API_BASE` accordingly).

Automated tests:

- Run backend unit tests (Jest):

```bash
npm test --prefix backend
```

Debugging tips:

- If sockets don't connect, verify `VITE_API_URL` and backend `PORT` and ensure `CORS` allows your frontend origin.
- Check server logs for socket connect/auth errors and look for `socket connected` / `presenceUpdate` logs.
- Use the browser console to inspect socket events (e.g., `socket.on('messageCreated', console.log)`).


This repository contains:
- `frontend/` — Vite + React + TypeScript + Tailwind
- `backend/` — Node + Express + TypeScript + Prisma + Socket.IO

## Running in Production

Build frontend and backend, generate Prisma client and run migrations, then start the backend server (it serves the frontend in production):

```bash
# install deps
pnpm install

# generate prisma client and run migrations
pnpm --filter backend run prisma:generate
pnpm --filter backend run prisma:migrate

# build
pnpm run build

# start (in production mode)
NODE_ENV=production PORT=8080 pnpm --filter backend start
```

Notes & gotchas:

- Persistent uploads: The app stores file uploads in `./uploads` by default. For production use, migrate uploads to S3 (or another object store) and update the upload service accordingly.
- Auth endpoints: The `/auth` routes have a stricter rate limit by default (10 requests per minute) to reduce brute-force/abuse — adjust env vars or middleware if you need different limits.
- Prisma migrations: Make sure `prisma generate` and `prisma migrate` succeed on your CI or host — version mismatch between global and local Prisma CLI can cause errors. Prefer using the local `pnpm --filter backend run prisma:generate`.
- Health endpoint: `GET /health` returns `{ status: 'ok' }` for monitoring.

Known limitations:

- Uploads are stored on disk (not yet migrated to S3)
- No threads/voice/roles yet — planned features
