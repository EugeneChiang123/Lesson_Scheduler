# API Reference

Single source of truth for the Lesson Scheduler REST API. All endpoints are under the `/api` prefix. On Vercel the API is same-origin; in local dev the client proxies `/api` to the server (e.g. port 3001).

---

## Conventions

- **Request bodies:** JSON with `Content-Type: application/json`.
- **Success responses:** JSON; status 200 (OK), 201 (Created) as noted per endpoint.
- **Error responses:** JSON with `{ "error": "message" }`. Some endpoints add optional fields (e.g. `requestedStart`, `conflictingStart`) for conflict errors.
- **Dates/times:** Dates as `YYYY-MM-DD`; times in API responses may use `YYYY-MM-DD HH:mm:ss` or ISO-like strings (e.g. `2026-02-20T09:00:00`).

---

## Health

### GET /api/health

Returns which persistence backend is in use. No auth.

**Response:** `200 OK`

```json
{ "store": "postgres" }
```
or
```json
{ "store": "file" }
```

---

## Event types

Base path: `/api/event-types`.

### GET /api/event-types

List all event types (instructor UI).

**Response:** `200 OK`

Array of event type objects:

| Field | Type | Description |
|-------|------|-------------|
| id | number | Primary key |
| slug | string | URL path segment (e.g. `30min-intro`) |
| name | string | Display name |
| description | string | Shown on booking page |
| durationMinutes | number | Session length (default 30) |
| allowRecurring | boolean | Whether recurring bookings are allowed |
| recurringCount | number | Number of sessions per recurring booking (1–52) |
| availability | array | Weekly windows: `{ day, start, end }`; `day` 0–6 (Sun–Sat), `start`/`end` like `"09:00"`, `"17:00"` |
| location | string | Optional location (e.g. room, Zoom link) |

**Errors:** `500` — server error with `{ "error": "message" }`.

---

### GET /api/event-types/id/:id

Get one event type by numeric id (instructor edit). Must be defined before the `/:slug` route so `id` is not interpreted as a slug.

**Parameters:** `id` — event type id.

**Response:** `200 OK` — single event type object (same shape as in the list).

**Errors:**

- `404` — `{ "error": "Event type not found" }`
- `500` — server error

---

### GET /api/event-types/:slug

Get one event type by slug (public booking page).

**Parameters:** `slug` — URL-safe identifier (e.g. `30min-intro`).

**Response:** `200 OK` — single event type object (same shape as above).

**Errors:**

- `404` — `{ "error": "Event type not found" }`
- `500` — server error

---

### POST /api/event-types

Create an event type (instructor).

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| slug | string | yes | Unique URL path segment |
| name | string | yes | Display name |
| description | string | no | Default `""` |
| durationMinutes | number | no | Default 30 |
| allowRecurring | boolean | no | Default false |
| recurringCount | number | no | Default 1 (clamped 1–52) |
| availability | array | no | Default `[]`; items `{ day, start, end }` |
| location | string | no | Default `""` |

**Response:** `201 Created` — created event type object.

**Errors:**

- `400` — `{ "error": "slug and name required" }`
- `409` — `{ "error": "Slug already exists" }`
- `500` — server error

---

### PATCH /api/event-types/:id

Update an event type (instructor). Partial update; omit fields to leave unchanged.

**Parameters:** `id` — event type id.

**Request body:** Same fields as POST (all optional for PATCH).

**Response:** `200 OK` — updated event type object.

**Errors:**

- `404` — `{ "error": "Event type not found" }`
- `409` — `{ "error": "Slug already exists" }` (if slug is changed to one already in use)
- `500` — server error

---

## Slots

### GET /api/event-types/:slug/slots

Get available start times for a given date. Slots are derived from the event type’s weekly availability, minus already-booked times and past times for today.

**Parameters:**

- `slug` — event type slug (path).
- `date` — query; required. Must be `YYYY-MM-DD`.

**Response:** `200 OK`

Array of strings: ISO-like start times for the date (e.g. `"2026-02-20T09:00:00"`). Sorted.

**Errors:**

- `400` — `{ "error": "Valid date (YYYY-MM-DD) required" }`
- `404` — `{ "error": "Event type not found" }`
- `500` — server error

---

## Bookings

Base path: `/api/bookings`.

### GET /api/bookings

List all bookings (instructor calendar). Each booking is enriched with event type name and optional recurring session info.

**Response:** `200 OK`

Array of booking objects, sorted by start time:

| Field | Type | Description |
|-------|------|-------------|
| id | number | Booking id |
| event_type_id | number | Event type id |
| event_type_name | string \| null | Event type name |
| start_time | string | Start (e.g. `YYYY-MM-DD HH:mm:ss`) |
| end_time | string | End |
| first_name | string | |
| last_name | string | |
| full_name | string | `"firstName lastName"` trimmed |
| email | string | |
| phone | string \| null | |
| recurring_group_id | string \| null | Set when part of a recurring booking |
| recurring_session | object \| null | `{ index, total }` when recurring (e.g. session 2 of 4) |
| notes | string | Optional notes / additional details |

**Errors:** `500` — server error.

---

### GET /api/bookings/:id

Get one booking by id (event edit page).

**Parameters:** `id` — booking id.

**Response:** `200 OK` — single booking object (same shape as in the list, with `event_type_name`, `full_name`, `recurring_session`, `notes`).

**Errors:**

- `404` — `{ "error": "Booking not found" }`
- `500` — server error

---

### PATCH /api/bookings/:id

Update one booking (instructor). Partial update; omit fields to leave unchanged.

**Parameters:** `id` — booking id.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| startTime | string | no | New start (ISO or `YYYY-MM-DD HH:mm:ss`); end is derived from event type duration |
| endTime | string | no | Override end time |
| firstName | string | no | Must be non-empty if provided |
| lastName | string | no | Must be non-empty if provided |
| email | string | no | Must be non-empty if provided |
| phone | string | no | |
| notes | string | no | Additional details |

**Response:** `200 OK` — updated booking object (enriched like GET /api/bookings/:id).

**Errors:**

- `400` — `{ "error": "firstName required" }` (or lastName/email) when empty string sent
- `404` — `{ "error": "Booking not found" }`
- `409` — `{ "error": "Slot no longer available", "conflictingStart": "..." }` when changing time to an occupied slot
- `500` — server error

---

### DELETE /api/bookings/:id

Delete one booking.

**Parameters:** `id` — booking id.

**Response:** `204 No Content` on success.

**Errors:**

- `404` — `{ "error": "Booking not found" }`
- `500` — server error

---

### POST /api/bookings

Create one or more bookings (student). If the event type has recurring enabled and `recurringCount` > 1, creates that many bookings at the same weekday/time for consecutive weeks.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| eventTypeSlug | string | yes | Event type slug |
| startTime | string | yes | Chosen slot start (ISO or `YYYY-MM-DD HH:mm:ss`) |
| firstName | string | yes | |
| lastName | string | yes | |
| email | string | yes | |
| phone | string | yes | (may be empty string) |

**Response:** `201 Created`

```json
{
  "success": true,
  "count": 1,
  "recurringGroupId": null
}
```

For recurring: `count` is the number of bookings created; `recurringGroupId` is a non-null string tying them together.

**Errors:**

- `400` — validation or business rule, e.g.:
  - `{ "error": "eventTypeSlug, startTime, firstName, lastName, email, phone required" }`
  - `{ "error": "Cannot create booking in the past", "requestedStart": "..." }`
  - `{ "error": "Requested time is not an available slot for this event type", "requestedStart": "..." }`
- `404` — `{ "error": "Event type not found" }`
- `409` — `{ "error": "Slot no longer available", "conflictingStart": "..." }` when the slot was taken between load and submit
- `500` — server error

---

## Maintenance

When adding or changing an endpoint:

1. Update this document (path, method, request/response, errors).
2. Update the corresponding route file in `server/routes/`.
3. Optionally add or update the request in [postman/Lesson-Scheduler-API.postman_collection.json](../postman/Lesson-Scheduler-API.postman_collection.json).
