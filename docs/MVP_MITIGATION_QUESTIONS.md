# MVP Mitigation Steps — Questions and Answers

Answer directly below each question. Once every question is answered, this doc becomes the spec for implementation (no assumptions).

---

## Step 1: Users table and data model

**Goal:** Add a `users` table and decide how Professionals and Clients are represented.

**Planned actions:**
- Add Postgres table `users` with columns to be decided from your answers.
- Run migration; optionally backfill or leave existing event types without an owner until Step 2.

### Questions — Step 1

**1.1** Should "Client" be a stored role in the database (i.e. do you need a `users` row for every person who books), or is "Client" only the unnamed visitor who fills the booking form (no account)? In other words: do clients need to sign up / log in, or only professionals?

**Answer:**


**1.2** What columns do you want on `users` for the POC? Please specify. For example: id, email, password_hash, full_name, role (professional | client?), time_zone, created_at, updated_at. Anything else (e.g. phone, avatar_url)?

**Answer:**


**1.3** Can one user have both roles (Professional and Client), or must each account be exactly one role?

**Answer:**


**1.4** For professionals: how do you want to identify them in URLs? (e.g. a unique slug like `eugene` that they choose at signup, or use id, or email-based?) Should this slug be stored on `users` (e.g. `profile_slug` or `username`)?

**Answer:**


**1.5** Should slug/username be globally unique across all users, or only among professionals?

**Answer:**


---

## Step 2: Authentication (sign up / login)

**Goal:** Professionals (and optionally Clients) can sign up and log in. No complex permissions yet.

**Planned actions:**
- Implement sign-up and login endpoints (or use a third-party auth provider, depending on your answers).
- Protect instructor/setup routes so only a logged-in professional can access their own data.
- Decide how session/token is stored and sent (cookie, header, etc.).

### Questions — Step 2

**2.1** Do you want to build auth yourself (email + password, stored in `users`) or use a provider (e.g. Auth0, Clerk, Supabase Auth, NextAuth)? If provider, which one?

**Answer:**


**2.2** If email + password: where should the session live? (e.g. JWT in cookie, JWT in Authorization header, server-side session in DB with session id in cookie?) Please specify.

**Answer:**


**2.3** Password rules: minimum length, complexity (uppercase, numbers, symbols)? Any "forgot password" flow for POC or skip?

**Answer:**


**2.4** Email verification: should new sign-ups require verifying their email before they can log in or use the app, or skip for POC?

**Answer:**


**2.5** After login, where should the user be redirected? (e.g. always `/setup` for professionals?)

**Answer:**


**2.6** Should the public booking page (`/book/...` or `/:professionalSlug`) remain fully unauthenticated (no login required to view or submit)?

**Answer:**


---

## Step 3: Professional-scoped event types and bookings

**Goal:** Every event type belongs to one professional (user). Only that professional can create/edit/delete their event types and see their bookings.

**Planned actions:**
- Add `user_id` (or `professional_id`) to `event_types`; backfill or assign existing rows.
- Ensure GET/POST/PATCH for event types and GET for bookings are filtered by the logged-in professional.
- Update setup UI to show only that professional's event types.

### Questions — Step 3

**3.1** Can one professional have multiple event types (e.g. "30min intro" and "60min deep dive"), or exactly one "offer" per professional for the POC? If one, do you still want to keep the `event_types` table (one row per professional) or collapse into the `users` table?

**Answer:**


**3.2** You already have existing `event_types` (and possibly bookings) in the DB. How should we handle them when adding `user_id`? Options: (a) assign all to a single "default" professional user you create; (b) leave `user_id` NULL and treat NULL as "legacy" (no one can edit them until claimed); (c) delete all and start fresh; (d) other (please describe).

**Answer:**


**3.3** For listing bookings: should the professional see only bookings for their event types, or do you need any other filter (e.g. by date range, by event type)?

**Answer:**


---

## Step 4: Professional profile (time zone, availability, duration, price)

**Goal:** Professional can set time zone, available hours, session duration(s), and price. Stored in DB; no calendar sync.

**Planned actions:**
- Store professional's time zone (on `users` or on each event type if multiple).
- Ensure availability stays in DB (already on event type); confirm where duration and price live (event type vs user).
- Use professional time zone in slot generation (Step 5).

### Questions — Step 4

**4.1** Where should time zone be stored? (On `users` only, or on each `event_types` row if a professional can have different TZ per offer?)

**Answer:**


**4.2** Where should "available hours" (e.g. Mon–Fri 9–5) live for the POC? (Keep on `event_types` as now, or move to `users` with one schedule per professional?)

**Answer:**


**4.3** Where should session duration live? (Only on `event_types` as now, or also a "default" on `users` that pre-fills when creating an event type?)

**Answer:**


**4.4** Where should price per session live? (On `event_types` only, or on `users` for a single-offer POC?) What format? (e.g. integer cents, decimal dollars, currency code — and which currency for POC?)

**Answer:**


**4.5** Should price be shown on the public booking page before the client books? If yes, where exactly (e.g. in the summary card, next to the slot)?

**Answer:**


**4.6** Can a professional have different prices for different event types (e.g. 30m vs 60m), or one price for all?

**Answer:**


---

## Step 5: Public booking URL shape (e.g. lessonapp.com/eugene)

**Goal:** Each professional has one public URL (e.g. `/:professionalSlug`). Client sees that professional's offer(s), picks date/time, one-time or recurring, name/email, Book.

**Planned actions:**
- Add route(s) for the public booking page: e.g. `/:professionalSlug` and/or keep `/book/:eventTypeSlug`.
- Resolve `professionalSlug` to the professional (user) and then to the event type(s) they offer (one or many).
- If multiple event types: show a picker or a default; if one, go straight to calendar/slots.

### Questions — Step 5

**5.1** Exact URL pattern you want for the POC: `lessonapp.com/eugene` only, or also `lessonapp.com/book/30min-intro`? If both: should `/book/:eventTypeSlug` remain and work as today (event type slug), or be deprecated/redirect?

**Answer:**


**5.2** When a professional has multiple event types, what should `lessonapp.com/eugene` show? (a) A list of event types to choose from, then calendar/slots for the chosen one; (b) one "default" event type and go straight to calendar; (c) something else (describe).

**Answer:**


**5.3** How is the "default" event type chosen when a professional has multiple? (First created, explicit "default" flag on event type, or no default and always show list?)

**Answer:**


**5.4** Should the client explicitly choose "One-time booking" vs "Recurring weekly booking" in the form when the professional allows both? If yes: should the recurring count (e.g. 4 or 8) be fixed by the professional only, or can the client choose from a set (e.g. 4, 6, 8)?

**Answer:**


---

## Step 6: Timezone-aware slot generation

**Goal:** "Available hours" (e.g. Mon 9–5) are interpreted in the professional's time zone. Slots are generated and stored in UTC (TIMESTAMPTZ). Client sees times in a clear way (their TZ or professional's TZ, as you prefer).

**Planned actions:**
- In slot generation, use the professional's time zone to convert "9:00" on a given date to UTC start/end for that day.
- Store booking start/end as TIMESTAMPTZ (already done).
- Optionally show the professional's time zone on the booking page so the client understands "9:00" is in that TZ.

### Questions — Step 6

**6.1** For the POC, which time zone should the booking page show to the client: (a) client's local time zone only (current behavior), (b) professional's time zone only, (c) both (e.g. "Times shown in Eastern Time (your time: Pacific)")?

**Answer:**


**6.2** Should slot times displayed to the client be in the professional's time zone, the client's time zone, or configurable (e.g. a toggle)?

**Answer:**


**6.3** Time zone format: store as IANA string (e.g. `America/New_York`) only, or do you need to support UTC offset as well (e.g. `UTC-5`) for the POC?

**Answer:**


---

## Step 7: Email confirmation on booking

**Goal:** When a client books, send one email to the client and one to the professional. No reminder system yet.

**Planned actions:**
- After `POST /api/bookings` successfully creates booking(s), trigger sending two emails (client + professional).
- Choose provider and implement sending (e.g. Resend, SendGrid, Nodemailer/SMTP); store no sensitive credentials in repo.

### Questions — Step 7

**7.1** Which email sending provider do you want to use for the POC? (e.g. Resend, SendGrid, Mailgun, Nodemailer with your SMTP, other?) If you have no preference, say "no preference" and we can pick one that fits Vercel.

**Answer:**


**7.2** From-address: should confirmation emails come from a single system address (e.g. `bookings@yourdomain.com`) or from the professional's email? If system: do you already have a domain and verified sender?

**Answer:**


**7.3** Email content: plain text only, or HTML? Should the email include: booking date/time, duration, professional name, client name, event type name, "add to calendar" link, or something else? List exactly what each email (to client vs to professional) must contain.

**Answer:**


**7.4** If sending fails (e.g. provider error), should the booking still be created and we log the failure, or should we fail the request and not create the booking? (Recommendation: create booking and log; retry or manual follow-up later.)

**Answer:**


**7.5** Do you need a "Reply-To" set (e.g. client's email when professional gets the email) so they can reply directly?

**Answer:**


---

## Step 8: Payment (optional for POC)

**Goal:** Either skip payment or add minimal Stripe Checkout: one-time, fixed price per session, no subscriptions.

### Questions — Step 8

**8.1** For this POC, do you want payment at all? (Yes / No.)

**Answer:**


**8.2** If yes: should payment happen before the booking is confirmed (e.g. pay then create booking), or after (e.g. create booking then send Stripe link to pay before the session)? Any preference on when to charge (e.g. at booking time vs later)?

**Answer:**


**8.3** If yes: one-time charge for the whole set of sessions (e.g. 4 sessions × $50 = $200) or charge per session later? For POC, "one-time fixed price per session" was the requirement — confirm: charge once for all sessions in the booking (including recurring) at booking time?

**Answer:**


---

## Step 9: RecurringSeries table (optional)

**Goal:** Decide whether to add a dedicated `recurring_series` table or keep using only `recurring_group_id` on bookings.

### Questions — Step 9

**9.1** Do you want a separate `recurring_series` table for the POC? (e.g. id, recurring_group_id, event_type_id, start_time, count, created_at.) Or is keeping only `recurring_group_id` on each booking sufficient for now?

**Answer:**


---

## Step 10: Client-facing one-time vs recurring choice

**Goal:** If the professional allows both one-time and recurring, should the client explicitly choose in the form?

### Questions — Step 10

**10.1** When the professional has allowed recurring (e.g. up to 8 sessions), should the client always get a choice in the UI: "Book once" vs "Book 4 weekly sessions" (and optionally pick 4, 6, or 8)? Or is it acceptable that the professional sets "this offer is always 4 recurring sessions" with no client choice?

**Answer:**


---

## Next step

Once every question above has an answer, use this doc as the spec to create a concrete implementation plan (tickets/PRs) with no remaining assumptions.
