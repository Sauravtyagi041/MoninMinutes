# MinuteMate AI — Automated Meeting Minutes Generator

*Turn conversations into clarity.* Paste or upload a meeting transcript and get a summary, key points, confirmed decisions, action items (owner, deadline, priority, evidence), risks and open questions — editable, trackable across meetings, and exportable to PDF/Markdown.

## Features
- Email/password auth with HttpOnly session cookie, CSRF protection, origin checks, rate limiting, Helmet
- Meetings CRUD with search, filter, sort, pagination; transcript paste or upload (TXT, MD, SRT, VTT; 5 MB default)
- Transcript parser (speakers, timestamps, SRT/VTT cues) with stable segment IDs
- AI analysis: strict JSON-schema output validated by Zod, chunking for long transcripts, cross-chunk merge and duplicate detection, citation checks, injection-resistant prompts
- Durable Postgres-backed job queue with honest, backend-confirmed progress stages, retries, stale-job recovery
- Editable minutes, full action-item CRUD, cross-meeting Action Items page (overdue only when a real due date has passed and the task isn't completed)
- Dashboard stats from stored data, Recharts completion chart, light/dark themes
- PDF and Markdown export of the *edited* minutes

## Tech stack
React 19 + Vite + Tailwind 4 + React Router + Axios + Recharts + Sonner · Node 22 + Express 5 + Prisma 6 + PostgreSQL 16 + Zod · pdfkit · Vitest.

## Architecture
```
client (Vite, /api proxied in dev) ──► Express API ──► PostgreSQL
                                          │
                                 job worker (in-process)
                                 claims jobs with FOR UPDATE SKIP LOCKED
                                          │
                                 AI service (provider-agnostic, no Express/Prisma imports)
```
`server/src`: `routes → controllers (thin) → services` (`transcript/`, `ai/`, `jobs/`, `export/`), plus `middleware/`, `validators/`.
`POST /generate` creates a `ProcessingJob` and returns 202. The worker (started by `server.js`) processes it; the UI polls `GET /processing-status`. A partial unique index guarantees one active job per meeting, so duplicate clicks are idempotent.

## Local setup
Requirements: Node ≥ 22, Docker.
```bash
cp .env.example .env              # set JWT_SECRET, AI_* (see below)
npm run install:all
npm run db:up                     # Postgres on localhost:5433
npm run db:migrate
npm run db:seed                   # optional demo data (demo@minutemate.ai / demo-password-123)
npm run dev:server                # http://localhost:4000
npm run dev:client                # http://localhost:5173
```
Server scripts load `../.env` via `--env-file-if-exists`.

## Environment variables
See [.env.example](.env.example). Key ones: `DATABASE_URL`, `JWT_SECRET` (≥32 chars), `CLIENT_ORIGINS`, `COOKIE_SAMESITE`/`COOKIE_SECURE`, `TRUST_PROXY`, `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_CHUNK_TOKENS`, `MAX_TRANSCRIPT_CHARS`, `MAX_CHUNKS_PER_MEETING`, `MAX_ACTIVE_JOBS_PER_USER`, `MAX_FILE_BYTES`.

## Configuring AI
```env
AI_PROVIDER=anthropic          # or openai, or openai-compatible
AI_API_KEY=sk-...
AI_MODEL=<model id from your provider>
```
- `openai`: Chat Completions with strict `json_schema` output. `anthropic`: Messages API with a forced tool call. `openai-compatible`: same as openai against `AI_BASE_URL` (the server must support `json_schema` response format).
- Keys live only on the server. Without them, *Generate* returns a clear configuration error (HTTP 503) and the Settings page shows "Not configured". There is no silent fake output.
- `server/scripts/stub-ai.js` is a **dev-only** stub returning canned output for clicking through the UI; it is not analysis.

## How AI processing works
1. Transcript is parsed into numbered segments (`speaker`, `start_ms`, `end_ms`, `text`; unknown = `null`).
2. Segments are chunked by estimated tokens (`AI_CHUNK_TOKENS`), never splitting a turn, with a few overlap segments as context-only.
3. Each chunk is sent with a fixed system prompt; the transcript is fenced with a random boundary and declared untrusted data.
4. Output is validated (Zod). Malformed output is re-requested up to 2×; transient HTTP errors retry with backoff.
5. Sanitization: citations must reference real segment IDs (items with none are dropped); assignees must appear in the transcript/participants (else `null`).
6. Merge + dedupe across chunks; multi-chunk meetings get a final overview call from part summaries.
7. Due dates are resolved **in code** from the spoken phrase relative to the *meeting date* (never today's date); ambiguous phrases ("next Friday", "end of sprint") stay `null`, with the original text kept.
8. Saved in one transaction. Regeneration replaces untouched AI action items and keeps manual/edited ones; failed regeneration keeps previous minutes.

## API
All responses: `{ data, meta? }` or `{ error: { code, message, details? } }`. Writes need the `X-CSRF-Token` header (returned by login/register/`/auth/me`).

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register`, `/login`, `/logout` · GET `/api/auth/me` | |
| GET/POST | `/api/meetings` | `?q&status&sort&order&page&pageSize` |
| GET/PATCH/DELETE | `/api/meetings/:id` | detail includes minutes, action items, latest job |
| POST/GET | `/api/meetings/:id/transcript` | JSON `{text}` or multipart `file` |
| POST | `/api/meetings/:id/generate` | 202 + job; returns the existing job if one is active |
| GET | `/api/meetings/:id/processing-status` | `{meetingStatus, stages, job:{status, stage, completedStages, errorMessage}}` |
| GET/PATCH | `/api/meetings/:id/minutes` | PATCH: `overview`, `key_points`, `decisions`, `risks`, `open_questions` |
| GET | `/api/action-items` | `?q&status&priority&assignee&overdue&meetingId&sort&order`; `meta.stats` |
| POST | `/api/meetings/:id/action-items` | |
| PATCH/DELETE | `/api/action-items/:id` | |
| GET | `/api/dashboard/stats` | |
| GET | `/api/meetings/:id/export?format=pdf\|md` | |
| GET | `/api/health` | `aiConfigured`, `maxFileBytes` |

Foreign or missing resources both return 404.

## Sample transcript
```
[00:00:05] Rahul: The authentication API is ready for testing.
[00:00:20] Lead: Priya, please finish the API documentation by Friday.
[00:00:40] Lead: Okay, we all agreed to use PostgreSQL.
[00:01:00] Rahul: Someone should update the onboarding docs.
```
→ task "Finish the API documentation", owner Priya, due = the first Friday after the meeting date; the onboarding task has no owner and no deadline. More in `server/prisma/seed.js`.

## Tests
```bash
npm test            # server (80, needs the compose Postgres) + client (11)
npm run lint
```
Server tests use a separate `minutemate_test` database (create once: `docker exec minutemate-db psql -U minutemate -c 'CREATE DATABASE minutemate_test'` then `DATABASE_URL=...minutemate_test npx prisma migrate deploy` in `server/`). AI calls go to a local fake OpenAI-compatible HTTP server, so no paid calls and the real provider code is exercised. Port 45871 must be free.

## Deployment
- **Database:** managed Postgres (Neon, Supabase, Render, Railway). Set `DATABASE_URL`; run `npm --prefix server run migrate:deploy`.
- **API:** any always-on Node host (Render/Railway/Fly) via `server/Dockerfile` or `npm ci && npx prisma generate && npm start`. The worker runs **inside the API process**, so the host must not sleep. On free tiers that spin down, jobs resume when the service wakes (stale jobs are re-queued) but processing is delayed. Set `TRUST_PROXY=true`, `JWT_SECRET`, `CLIENT_ORIGINS=https://your-client`, `AI_*`.
- **Client (Vercel):** root `client/`, build `npm run build`, output `dist`. Edit `client/vercel.json` to rewrite `/api/*` to the API origin — this keeps cookies first-party (`COOKIE_SAMESITE=lax`). Alternatively set `VITE_API_URL` and use `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true` (third-party cookies may be blocked by some browsers; the rewrite is recommended).
- **Troubleshooting:** 403 `BAD_ORIGIN` → fix `CLIENT_ORIGINS`; login works but `/me` 401 → cookie settings/proxy; "AI not configured" → `AI_API_KEY`/`AI_MODEL`; jobs stuck queued → worker not running (`WORKER_ENABLED`).

## Known limitations
- No browser-level (Playwright) E2E test; the end-to-end flow is covered by the API integration test (register → meeting → transcript → generate → edit → export) and was clicked through manually against the stub AI.
- **Not yet verified against a live OpenAI/Anthropic endpoint** (no key was available). Provider request/response handling is covered by tests with mocked HTTP; verify with your key and a real model before relying on it.
- PDF export uses built-in Latin fonts; non-Latin characters are replaced with `?` (Markdown export is lossless).
- Token counts are estimated (chars/4). Source references are line-level, not word-level. No email verification or password reset. Sessions can't be revoked server-side before expiry.
- In-process worker; for heavy load run a dedicated worker process (the claim query is multi-worker safe).

## Future improvements
AI chat over a meeting, audio transcription, meeting comparison, CSV task export, email sharing (with explicit approval), Playwright E2E, password reset.
