# Lesson Scheduler

Calendly-style booking and instructor setup: shareable event links, calendar, slots, and optional recurring sessions. No instructor auth in v1.

## Quick start

1. From the repo root: `npm install`, then `cd client && npm install`.
2. Create data files: `npm run db:migrate`.
3. Start API and client: `npm run dev` (API on port 3001, React dev server on port 3000 with proxy to API).
4. Open http://localhost:3000 — use **Instructor setup** to create an event type (name, slug, weekly availability), then open the booking link or use the landing example link.

## What it does

- **Student:** Landing page → booking link → pick a day → see available slots → fill form (name, email, phone) → submit → confirmation (and optional add-to-calendar link).
- **Instructor:** Setup UI at `/setup` to create and edit event types; each gets a shareable URL like `/book/30min-intro`. View all bookings in a calendar (day/week/month).
- **Persistence:** File store (JSON) by default; optional Postgres for production so data persists on Vercel and booking links work when opened in a new window.

## Running with Postgres (optional)

**Step-by-step setup (Postgres on Vercel):** [docs/POSTGRES_SETUP.md](docs/POSTGRES_SETUP.md) — add Postgres via Vercel Marketplace (e.g. Neon), set `POSTGRES_URL`, run the migration, redeploy.

Quick version: set `POSTGRES_URL` or `DATABASE_URL` in your environment (e.g. copy `.env.example` to `.env` and fill in the URL). Run the migration once: `npm run db:migrate-pg`. Optionally seed from existing JSON: `npm run db:seed-pg`. For architecture and rollout notes, see [ARCHITECTURE.md](ARCHITECTURE.md) § Persistence and [planning.md](planning.md) Part 2.

## Documentation

- **Architecture and design:** [ARCHITECTURE.md](ARCHITECTURE.md) — stack, data model, API summary, flows, persistence, project layout.
- **Project structure:** [docs/FILES.md](docs/FILES.md) — what each file does and where it fits.
- **API reference:** [docs/API.md](docs/API.md) — every endpoint, request/response shapes, and errors.
- **Interactions:** [docs/INTERACTIONS.md](docs/INTERACTIONS.md) — route-to-page map, page-to-API map, and flow diagrams.
- **Postgres on Vercel:** [docs/POSTGRES_SETUP.md](docs/POSTGRES_SETUP.md) — step-by-step setup with Neon or other Postgres.
- **Plans and history:** [planning.md](planning.md) — product vision, implementation order, Postgres rollout, risk and rollback.
