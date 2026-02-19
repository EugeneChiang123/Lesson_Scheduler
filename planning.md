# Planning

Decisions, implementation order, rollout, and history. For system design (data model, API, persistence), see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Part 1 — Product vision (v1)

**Goal:** A minimal Calendly/Cal.com-style app: public booking flow plus a single-instructor setup flow. No instructor auth in v1.

- **Student:** Landing → booking link → calendar → pick day → slots → form (name, phone, email) → submit → confirmation.
- **Instructor:** Setup UI to create/edit event types (slug, description, duration, weekly availability, mandatory fields, optional recurring). Each type gets a shareable URL.
- **Stack:** Node/Express API, React SPA. Persistence: file store or Postgres (see Part 2).

### Implementation order (executed)

1. Project setup — server + client, migration for event_types/bookings.
2. Event types CRUD — API + instructor UI.
3. Slots API — `GET /api/event-types/:slug/slots?date=`.
4. Public booking page — calendar, slots, form, submit.
5. Create booking(s) API — validation, conflict check, insert one or N.
6. Landing page — link to `/book/:eventTypeSlug`.
7. Recurring in UI — "N weekly sessions" copy, POST creates N bookings.

### Feature additions (steps)

- **Step 2:** Instructor landing (`/setup`), create/edit event pages, recurring badge and option.
- **Step 3:** Bookings calendar (`/setup/bookings`) — day/week/month views, full name, recurring session "X of Y".
- **Step 4:** Recurring count server-side cap (e.g. 52) via `clampRecurringCount` in store and bookings route.
- **Step 5:** Calendly-style UI — two-column booking page, sticky summary, slot chips, add-to-calendar link; matching design for instructor calendar.

### Out of scope (v1)

Instructor login; multi-tenant; custom fields; calendar sync / email reminders / timezone UI; payments; cancellation flows.

### Open points

- **Recurrence rule:** Currently "same weekday/time, weekly, for N bookings." Could be made configurable (e.g. every 2 weeks, or student picks interval).

---

## Part 2 — Add real database for Vercel

**Goal:** Replace the file-based store with Postgres so event types and bookings persist on Vercel and the "Event type not found" bug when opening the booking link in a new window is fixed.

**Why:** On Vercel the app used `/tmp`, which is ephemeral and not shared between serverless invocations. A real database gives one persistent source of truth.

**Recommended:** Vercel Postgres (Neon) or Neon/Supabase; any Postgres URL works.

**Data flow diagram and Postgres schema:** [ARCHITECTURE.md](ARCHITECTURE.md) § Persistence and § Database schema.

### Implementation steps (executed)

1. **Create database** — Get connection URL; set `POSTGRES_URL` or `DATABASE_URL` (Vercel env or `.env` locally).
2. **Migration** — Add `server/db/schema.sql` and `server/db/migrate-pg.js`; run `npm run db:migrate-pg` once.
3. **Postgres store** — Implement `server/db/store-pg.js` with same API; snake_case columns, JSONB for availability, TIMESTAMPTZ for times.
4. **Store switcher** — In `server/db/store.js`, use Postgres when `POSTGRES_URL` set, else `server/db/store-file.js` (file store with Promise API). Routes use async/await.
5. **Optional seed** — `server/db/seed-from-json.js`; run `npm run db:seed-pg` to copy existing JSON into Postgres.
6. **Deploy and verify** — Deploy with `POSTGRES_URL` set; run migration; create event type and open booking link in new window — should load without "Event type not found".

### Files added or changed

| Action         | File |
| -------------- | ---- |
| Dependencies   | `package.json` — @vercel/postgres, pg; scripts `db:migrate-pg`, `db:seed-pg`. |
| Schema         | `server/db/schema.sql` — CREATE TABLE event_types, bookings, indexes. |
| Migration      | `server/db/migrate-pg.js` — Run schema using pg and POSTGRES_URL. |
| Postgres store | `server/db/store-pg.js` — Same API as file store. |
| File store     | `server/db/store-file.js` — Promise-returning file store. |
| Switcher       | `server/db/store.js` — Export store-pg or store-file by env. |
| Seed           | `server/db/seed-from-json.js` — Optional seed from JSON. |
| Routes         | `server/routes/*.js` — Async handlers, await store calls. |
| Docs           | README, ARCHITECTURE — Persistence and Postgres setup. |

### Risk and rollout

- **Risk:** Bugs in store-pg (e.g. date format, overlap logic) could break booking/slots. Mitigation: same semantics as file store; test create event → open link → book.
- **Rollback:** Unset `POSTGRES_URL` on Vercel to fall back to file store (data ephemeral again).

---

## Part 3 — Instructor calendar and booking management

**Goal:** Give the instructor a proper schedule view and tools to adjust individual lessons without breaking the existing booking flow.

- **Instructor calendar:** A dedicated `/setup/bookings` page (`BookingsCalendar`) that shows all lessons with **month/week/day** views, navigation (Today/Previous/Next), and a hover card with student contact info and event type name. Clicking any lesson opens a focused edit screen.
- **Single booking edit page:** `/setup/bookings/:bookingId` (`EventEditPage`) lets the instructor adjust **date, time, duration**, and **student fields**, add **notes**, and **delete** a booking. It uses `GET /api/bookings/:id`, `PATCH /api/bookings/:id`, and `DELETE /api/bookings/:id`.
- **Extended booking shape:** Bookings now carry `duration_minutes`, `notes`, and enriched fields (`event_type_name`, `full_name`, `recurring_session`) consistently across the API, calendar, and edit page.
- **Conflict-safe edits:** A global booking mutex plus `updateIfNoConflict`/`createBatchIfNoConflict` in the store ensure overlap checks and writes are atomic, so edits and new bookings cannot double‑book the same slot.

### Implementation steps (executed)

1. **API enrichment:** Centralized booking-to-API mapping in `server/routes/bookings.js` so list, detail, and edit responses all share the same shape (including recurring session info, notes, and duration).
2. **File/Postgres store updates:** Normalize bookings in `store-file` (and the Postgres store) to always include `duration_minutes` and `notes`, and add conflict-safe helpers: `updateIfNoConflict`, `createBatchIfNoConflict`.
3. **Bookings calendar UI:** Build `BookingsCalendar` with month grid, week time-grid, and day list views, including navigation and hover details; wire it to `GET /api/bookings`.
4. **Event edit UI:** Build `EventEditPage` bound to `/setup/bookings/:bookingId`, loading via `GET /api/bookings/:id`, saving via `PATCH`, and deleting via `DELETE`. Surface conflict errors (409) with friendly copy and auto-refresh the form to the server source of truth.
5. **Docs alignment:** Update `docs/API.md`, `docs/FILES.md`, and `docs/INTERACTIONS.md` so the new calendar and booking-edit flows, routes, and fields are the documented source of truth.

### Risk and rollout

- **Risk:** Incorrect overlap logic or duration recalculation could allow or falsely block conflicting lessons. Mitigation: centralize overlap checks in the store mutex helpers and test edits around existing bookings (shorter/longer duration, moving across days).
- **Risk:** UI edit page diverges from API rules (e.g. empty names/emails). Mitigation: keep validation mirrored (form + server 400s) and rely on re-fetch after 409 to reset stale state.
- **Rollback:** Hide or link away from `/setup/bookings` and `/setup/bookings/:bookingId` in the UI, and fall back to read-only `/setup` plus the original booking creation flow while leaving the underlying data model intact.
