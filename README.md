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

Set `POSTGRES_URL` or `DATABASE_URL` in your environment (e.g. `.env` locally or Vercel project env). Run the migration once: `npm run db:migrate-pg`. Optionally seed from existing JSON: `npm run db:seed-pg`. For setup details and rollout notes, see [ARCHITECTURE.md](ARCHITECTURE.md) § Persistence and [planning.md](planning.md) Part 2.

## Docs

- **Architecture and design:** [ARCHITECTURE.md](ARCHITECTURE.md) — stack, data model, API, flows, persistence, project layout.
- **Plans and history:** [planning.md](planning.md) — product vision, implementation order, Postgres rollout, risk and rollback.
