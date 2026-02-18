# Project structure and file roles

One-place reference for what each important file does and how it fits in. For data model and persistence details, see [ARCHITECTURE.md](../ARCHITECTURE.md). For endpoint details, see [API.md](API.md).

---

## Root and config

| File | Purpose |
|------|--------|
| **package.json** | App name, scripts (`server`, `client`, `dev`, `build`, `db:migrate`, `db:migrate-pg`, `db:seed-pg`, `workflow-test`), and dependencies (express, pg, cors, dotenv). |
| **vercel.json** | Build and rewrites: buildCommand/outputDirectory for client, `/api/:path*` → `/api/[[...path]]`, SPA fallback for non-API routes. |
| **.env.example** | Template for optional `POSTGRES_URL` (or `DATABASE_URL`); when set, app uses Postgres instead of file store. See [POSTGRES_SETUP.md](POSTGRES_SETUP.md). |
| **api/[[...path]].js** | Vercel serverless catch-all for `/api/*`. Restores `req.url` from query param if present, then forwards the request to the Express app so routes match. |
| **app.js** (root) | Optional Vercel entry that exports `server/app`; used when Vercel runs the Express app directly. |

---

## Server

| File | Purpose |
|------|--------|
| **server/index.js** | Starts the Express server when not on Vercel (listens on PORT or 3001). Loads dotenv and requires `server/app`. |
| **server/app.js** | Express app: CORS, JSON body parser, `GET /api/health`, mounts professionals (public by-slug + reserved-slugs, then auth-protected me/PATCH), event-types, bookings; in production/Vercel serves static client, 301 redirect for old profile slugs (single-segment path → current slug), then SPA fallback. |
| **server/middleware/auth.js** | Clerk token verification; requireProfessional, requireProfessionalUnlessPublicEventTypes, requireProfessionalUnlessPost; attach req.professional and req.professionalId. |
| **server/routes/professionals.js** | Public: GET /api/professionals/reserved-slugs, GET /api/professionals/by-slug/:slug (redirect or profileSlug). Auth: GET /me, PATCH /me (full_name, profile_slug, time_zone); reserved path validation; slug_redirects on slug change. |
| **server/routes/eventTypes.js** | Event types CRUD: list (scoped by professional), get by id, get by slug (public), create (POST), update (PATCH). Uses `server/db/store`. |
| **server/routes/slots.js** | `GET /:slug/slots?date=YYYY-MM-DD`: timezone-aware slot generation (Luxon); date interpreted in event type `timeZone`, slots returned as UTC ISO with Z; uses `bookings.getBookingsForEventTypeInRange`. Exports `getSlotsForDate` for bookings route. |
| **server/routes/bookings.js** | List all bookings (instructor); GET /:id, PATCH /:id, DELETE /:id for single booking; POST to create one or more bookings (student), upserts client then createBatchIfNoConflict with client_id; recurring and conflict checks. Uses store and slots’ `getSlotsForDate`. |
| **server/db/store.js** | Store switcher: if `POSTGRES_URL` or `DATABASE_URL` is set, requires `store-pg`, else requires `store-file`. Single API for routes. |
| **server/db/store-file.js** | File-backed store: JSON files in `server/db/` (or `/tmp` on Vercel). Implements same API as store-pg; uses per–event-type mutex for atomic booking conflict check. `clients.upsert` rejects (Auth requires Postgres). |
| **server/db/store-pg.js** | Postgres-backed store (same API as store-file). Uses `pg` Pool; maps DB rows to app shapes (camelCase event types, formatted timestamps). `slug_redirects.getRedirect(old_slug)`; `clients.upsert(guest)` by (email, first_name, last_name), returns client id. |
| **server/db/schema.sql** | Postgres DDL: `event_types` and `bookings` tables and indexes. Run via `npm run db:migrate-pg`. |
| **server/db/schema-mvp.sql** | MVP DDL: `professionals`, `clients`, `slug_redirects`, `event_types` (with professional_id, time_zone, price_dollars), `bookings` (with client_id). Wipe and recreate. Run via `npm run db:migrate-mvp`. |
| **server/db/migrate.js** | File-store migration: ensures `event_types.json` and `bookings.json` exist (for local/file-backed use). |
| **server/db/migrate-pg.js** | Postgres migration: runs schema.sql. Requires `POSTGRES_URL` or `DATABASE_URL`. |
| **server/db/migrate-mvp-pg.js** | MVP Postgres migration: runs schema-mvp.sql (drops and recreates tables). Requires `POSTGRES_URL` or `DATABASE_URL`. |
| **server/db/seed-from-json.js** | Seeds Postgres from existing JSON files in server/db (e.g. after migrating from file store). |

---

## Client

| File | Purpose |
|------|--------|
| **client/src/main.jsx** | React root: ClerkProvider, BrowserRouter, App; uses VITE_CLERK_PUBLISHABLE_KEY. |
| **client/src/App.jsx** | Route definitions: `/` → `/setup`, `/sign-in`, `/sign-up`, `/book/:eventTypeSlug` → Book, `/setup` (ProtectedRoute + InstructorLayout), `/:professionalSlug` (ProtectedRoute + ProfessionalSlugGuard + InstructorLayout with same nested routes), `*` → `/`. |
| **client/src/api.js** | useApi() hook: apiFetch with Clerk Bearer token for protected endpoints. |
| **client/src/components/ProtectedRoute.jsx** | Redirects to /sign-in when not signed in; wraps /setup and /:professionalSlug. |
| **client/src/components/ProfessionalSlugGuard.jsx** | Resolves /:professionalSlug: reserved → redirect /setup; GET /me and GET /by-slug for redirect or dashboard; renders Outlet (InstructorLayout + children) when slug is current user’s profile slug. |
| **client/src/constants/reservedSlugs.js** | Reserved path segments (matches server); used by ProfessionalSlugGuard. |
| **client/src/utils/basePath.js** | getBasePath(pathname): returns /setup or /:professionalSlug so nav links work at both /setup and /:slug. |
| **client/src/pages/SignInPage.jsx** | Clerk SignIn component; fallbackRedirectUrl /setup. |
| **client/src/pages/SignUpPage.jsx** | Clerk SignUp component; fallbackRedirectUrl /setup. |
| **client/src/components/InstructorLayout.jsx** | Layout for `/setup` and `/:professionalSlug`: sidebar (brand, Create, Scheduling, Bookings) and main area with `Outlet`; links use basePath from URL (getBasePath). |
| **client/src/pages/SetupHome.jsx** | Instructor “Scheduling” page: lists event types (GET /api/event-types), search, copy booking link, links to create/edit and to Bookings. |
| **client/src/pages/SetupEventForm.jsx** | Create or edit event type: loads one by id when editing (GET /api/event-types/id/:id), submits POST or PATCH to event-types (includes location), then navigates back to /setup. |
| **client/src/pages/Book.jsx** | Public booking page: loads event type by slug, month calendar, fetches slots for selected date, form (name, email, phone), POST /api/bookings, success with optional add-to-calendar link. |
| **client/src/pages/BookingsCalendar.jsx** | Instructor calendar: lists all bookings (GET /api/bookings), month/week/day views, hover popover with student info, click event → EventEditPage. |
| **client/src/pages/EventEditPage.jsx** | Edit one booking: GET /api/bookings/:id, form (date, time, duration, name, email, phone, notes), PATCH to save (overlap check; 409 if would clash), DELETE to remove; redirects to basePath/bookings. |
| **client/src/utils/formatDuration.js** | Formats duration in minutes for display (e.g. “30 min”). |
| **client/src/utils/formatAvailability.js** | Formats event type availability array for display (e.g. “Mon 9:00 AM – 5:00 PM”). |
| **client/src/styles/theme.js** | Shared theme tokens (colors, spacing, border radius) used by layout and pages. |

---

## Scripts

| File | Purpose |
|------|--------|
| **scripts/workflow-test.js** | End-to-end workflow test: health check, create event type, get by slug, get slots for a date, create booking, list bookings. Expects API on port 3765 and Postgres (POSTGRES_URL in .env). Run with `npm run workflow-test`. |

---

## Other docs (no code)

| File | Purpose |
|------|--------|
| **README.md** | Quick start, what the app does, Postgres pointer, links to architecture and docs. |
| **ARCHITECTURE.md** | High-level architecture, stack, data model, API summary, flows, persistence, project layout. See also [INTERACTIONS.md](INTERACTIONS.md) for route/page/API maps and diagrams. |
| **docs/POSTGRES_SETUP.md** | Step-by-step Postgres on Vercel (e.g. Neon), env vars, migration, redeploy. |
| **docs/API.md** | Full API reference: every endpoint, request/response shapes, errors. |
| **docs/INTERACTIONS.md** | Route → page map, page → API map, and flow diagrams (student booking, instructor setup, client–server). |
| **docs/MVP_MITIGATION_QUESTIONS.md** | MVP gap mitigation: step-by-step questions with answer placeholders; answer in-doc then use as implementation spec. |
| **docs/MVP_IMPLEMENTATION_PLAN.md** | MVP implementation: architecture, data model, API changes, and phased implementation steps. |
| **planning.md** | Product vision, implementation order, Postgres rollout, risk and rollback (reference). |

---

## Adding or changing files

- **New file:** Add a one- to three-line entry to this document in the appropriate section.
- **New or changed endpoint:** Update [docs/API.md](API.md) and the relevant route; optionally the Postman collection.
- **New page or changed API usage:** Update [docs/INTERACTIONS.md](INTERACTIONS.md) (route/page/API map and diagrams).
