# Interactions

Which routes render which pages, which pages call which APIs, and how data flows. See [ARCHITECTURE.md](../ARCHITECTURE.md) for data model and persistence, and [API.md](API.md) for full endpoint details.

---

## Route to page map

| URL | Layout | Page / component |
|-----|--------|-------------------|
| `/` | — | Redirect to `/setup` |
| `/book/:eventTypeSlug` | — | **Book** (`client/src/pages/Book.jsx`) |
| `/setup` | InstructorLayout | **SetupHome** (index) |
| `/setup/new` | InstructorLayout | **SetupEventForm** (create) |
| `/setup/:id/edit` | InstructorLayout | **SetupEventForm** (edit) |
| `/setup/bookings` | InstructorLayout | **BookingsCalendar** |
| `*` | — | Redirect to `/` |

---

## Page to API map

| Page / component | Endpoint(s) used |
|------------------|------------------|
| **SetupHome** | `GET /api/event-types` |
| **SetupEventForm** | `GET /api/event-types/id/:id` (edit only), `POST /api/event-types` (create), `PATCH /api/event-types/:id` (update) |
| **Book** | `GET /api/event-types/:slug`, `GET /api/event-types/:slug/slots?date=YYYY-MM-DD`, `POST /api/bookings` |
| **BookingsCalendar** | `GET /api/bookings` |

---

## Student booking flow

User opens a booking link (e.g. `/book/30min-intro`), picks a day, sees slots, fills the form, and submits.

```mermaid
sequenceDiagram
  participant User
  participant BookPage as Book.jsx
  participant API as Express API
  participant Store as Store

  User->>BookPage: Open /book/:slug
  BookPage->>API: GET /api/event-types/:slug
  API->>Store: getBySlug
  Store-->>API: event type
  API-->>BookPage: event type (name, duration, availability)
  BookPage-->>User: Show calendar + description

  User->>BookPage: Pick date
  BookPage->>API: GET /api/event-types/:slug/slots?date=
  API->>Store: getBySlug, getBookingsOnDate
  API-->>BookPage: available start times
  BookPage-->>User: Show time slots

  User->>BookPage: Pick slot, fill form, submit
  BookPage->>API: POST /api/bookings (eventTypeSlug, startTime, firstName, ...)
  API->>Store: createBatchIfNoConflict
  Store-->>API: created / conflict
  API-->>BookPage: 201 or 409
  BookPage-->>User: Success or slot taken; optional add-to-calendar link
```

---

## Instructor setup flow

Instructor goes to `/setup`, lists event types, creates or edits one, then copies the booking URL to share.

```mermaid
sequenceDiagram
  participant User
  participant SetupHome as SetupHome.jsx
  participant SetupForm as SetupEventForm.jsx
  participant API as Express API
  participant Store as Store

  User->>SetupHome: Open /setup
  SetupHome->>API: GET /api/event-types
  API->>Store: eventTypes.all()
  Store-->>API: list
  API-->>SetupHome: event types
  SetupHome-->>User: List with search, copy link, edit/create

  alt Create new
    User->>SetupForm: Click Create, go to /setup/new
    User->>SetupForm: Fill form, Save
    SetupForm->>API: POST /api/event-types
    API->>Store: eventTypes.create(...)
    Store-->>API: created
    API-->>SetupForm: 201 + event type
    SetupForm-->>User: Navigate to /setup
  else Edit existing
    User->>SetupForm: Click Edit, go to /setup/:id/edit
    SetupForm->>API: GET /api/event-types/id/:id
    API->>Store: eventTypes.getById
    Store-->>API: event type
    API-->>SetupForm: event type
    SetupForm-->>User: Form prefilled
    User->>SetupForm: Change fields, Save
    SetupForm->>API: PATCH /api/event-types/:id
    API->>Store: eventTypes.update(...)
    Store-->>API: updated
    API-->>SetupForm: 200 + event type
    SetupForm-->>User: Navigate to /setup
  end
```

---

## Client–server overview

React app (client) talks only to the Express API. The API uses a single store interface; the implementation is either file-backed or Postgres depending on env.

```mermaid
flowchart LR
  subgraph client [React SPA]
    App[App.jsx]
    SetupHome[SetupHome]
    SetupForm[SetupEventForm]
    Book[Book]
    BookingsCal[BookingsCalendar]
    App --> SetupHome
    App --> SetupForm
    App --> Book
    App --> BookingsCal
  end

  subgraph api [Express API]
    Health[GET /api/health]
    EventTypes[eventTypes routes]
    Slots[slots route]
    Bookings[bookings routes]
  end

  subgraph store [Persistence]
    StoreJS[store.js]
    StoreFile[store-file]
    StorePG[store-pg]
    StoreJS --> StoreFile
    StoreJS --> StorePG
  end

  SetupHome -->|GET event-types| EventTypes
  SetupForm -->|GET id, POST, PATCH| EventTypes
  Book -->|GET slug, GET slots, POST bookings| EventTypes
  Book --> Slots
  Book --> Bookings
  BookingsCal -->|GET bookings| Bookings

  EventTypes --> StoreJS
  Slots --> StoreJS
  Bookings --> StoreJS
```
