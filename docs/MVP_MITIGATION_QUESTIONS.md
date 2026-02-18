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

**Answer:** Store each new "client" as a role in the database along with their name, phone number and email information. Clients do not need to sign up or log in. They should be able to book without any sign in authentication.


**1.2** What columns do you want on `users` for the POC? Please specify. For example: id, email, password_hash, full_name, role (professional | client?), time_zone, created_at, updated_at. Anything else (e.g. phone, avatar_url)?

**Answer:** Let us keep professional and client separately. For professionals, we want the id, email, password_hash, full name, role and created_at, updated_at. We want all account related information including sign in for professionals.


**1.3** Can one user have both roles (Professional and Client), or must each account be exactly one role?

**Answer:** User can book as a client. We do not authenticate Clients. We do not know if the user that books (aka client) is a professional or not. we can simlpy disregard. However, when saving to db, we can save the client together removing duplicates in the client database which is independent from the professional database


**1.4** For professionals: how do you want to identify them in URLs? (e.g. a unique slug like `eugene` that they choose at signup, or use id, or email-based?) Should this slug be stored on `users` (e.g. `profile_slug` or `username`)?

**Answer:** this will a unique slug that the user can choose. initially it will be the user id, but after creating the account, you can change it a different professional display name


**1.5** Should slug/username be globally unique across all users, or only among professionals?

**Answer:** Slug/usernames should be unique only to professionals. We will not keep any slugs for clients/students


---

## Step 2: Authentication (sign up / login)

**Goal:** Professionals (and optionally Clients) can sign up and log in. No complex permissions yet.

**Planned actions:**
- Implement sign-up and login endpoints (or use a third-party auth provider, depending on your answers).
- Protect instructor/setup routes so only a logged-in professional can access their own data.
- Decide how session/token is stored and sent (cookie, header, etc.).

### Questions — Step 2

**2.1** Do you want to build auth yourself (email + password, stored in `users`) or use a provider (e.g. Auth0, Clerk, Supabase Auth, NextAuth)? If provider, which one?

**Answer:** lets integrate Clerk for user authentication


**2.2** If email + password: where should the session live? (e.g. JWT in cookie, JWT in Authorization header, server-side session in DB with session id in cookie?) Please specify.

**Answer:** lets do the email and password in clerk's db. the session will also be managed by clerk


**2.3** Password rules: minimum length, complexity (uppercase, numbers, symbols)? Any "forgot password" flow for POC or skip?

**Answer:** we will implement the most simple pw and length complexity. 6 letter minimum. uppercase, lowercase and special symbol. We will implement a "forgot password" flow with a simple email verification link


**2.4** Email verification: should new sign-ups require verifying their email before they can log in or use the app, or skip for POC?

**Answer:** new sign ups will have email verification before logging in


**2.5** After login, where should the user be redirected? (e.g. always `/setup` for professionals?)

**Answer:** always /setup for professional where they can add their Professional Display Name


**2.6** Should the public booking page (`/book/...` or `/:professionalSlug`) remain fully unauthenticated (no login required to view or submit)?

**Answer:** in order to book there will be no authentication required. Authentication will only be required for professionals who are making the event


---

## Step 3: Professional-scoped event types and bookings

**Goal:** Every event type belongs to one professional (user). Only that professional can create/edit/delete their event types and see their bookings.

**Planned actions:**
- Add `user_id` (or `professional_id`) to `event_types`; backfill or assign existing rows.
- Ensure GET/POST/PATCH for event types and GET for bookings are filtered by the logged-in professional.
- Update setup UI to show only that professional's event types.

### Questions — Step 3

**3.1** Can one professional have multiple event types (e.g. "30min intro" and "60min deep dive"), or exactly one "offer" per professional for the POC? If one, do you still want to keep the `event_types` table (one row per professional) or collapse into the `users` table?

**Answer:** yes. One professional can have many event types


**3.2** You already have existing `event_types` (and possibly bookings) in the DB. How should we handle them when adding `user_id`? Options: (a) assign all to a single "default" professional user you create; (b) leave `user_id` NULL and treat NULL as "legacy" (no one can edit them until claimed); (c) delete all and start fresh; (d) other (please describe).

**Answer:** each event type is unique to each professional. Any additional Professional will start with an empty slate then they have to add their own event types individually


**3.3** For listing bookings: should the professional see only bookings for their event types, or do you need any other filter (e.g. by date range, by event type)?

**Answer:** each professional should only see the event bookings for their own event types. 


---

## Step 4: Professional profile (time zone, availability, duration, price)

**Goal:** Professional can set time zone, available hours, session duration(s), and price. Stored in DB; no calendar sync.

**Planned actions:**
- Store professional's time zone (on `users` or on each event type if multiple).
- Ensure availability stays in DB (already on event type); confirm where duration and price live (event type vs user).
- Use professional time zone in slot generation (Step 5).

### Questions — Step 4

**4.1** Where should time zone be stored? (On `users` only, or on each `event_types` row if a professional can have different TZ per offer?)

**Answer:** time zone should be stored for each event booking. depending on the location specified in the event type by the professional, the TZ should be locked for that event type.


**4.2** Where should "available hours" (e.g. Mon–Fri 9–5) live for the POC? (Keep on `event_types` as now, or move to `users` with one schedule per professional?)

**Answer:** available hours should only be for each event type. a client/user/student shoudl be able to place many bookings as long as time permits.


**4.3** Where should session duration live? (Only on `event_types` as now, or also a "default" on `users` that pre-fills when creating an event type?)

**Answer:** session duration will also live on event type


**4.4** Where should price per session live? (On `event_types` only, or on `users` for a single-offer POC?) What format? (e.g. integer cents, decimal dollars, currency code — and which currency for POC?)

**Answer:** price per session will also live on event type


**4.5** Should price be shown on the public booking page before the client books? If yes, where exactly (e.g. in the summary card, next to the slot)?

**Answer:** Yes price should be shown on the public booking page before client books


**4.6** Can a professional have different prices for different event types (e.g. 30m vs 60m), or one price for all?

**Answer:** yes each event type should have their own prices


---

## Step 5: Public booking URL shape (e.g. lessonapp.com/eugene)

**Goal:** Each professional has one public URL (e.g. `/:professionalSlug`). Client sees that professional's offer(s), picks date/time, one-time or recurring, name/email, Book.

**Planned actions:**
- Add route(s) for the public booking page: e.g. `/:professionalSlug` and/or keep `/book/:eventTypeSlug`.
- Resolve `professionalSlug` to the professional (user) and then to the event type(s) they offer (one or many).
- If multiple event types: show a picker or a default; if one, go straight to calendar/slots.

### Questions — Step 5

**5.1** Exact URL pattern you want for the POC: `lessonapp.com/eugene` only, or also `lessonapp.com/book/30min-intro`? If both: should `/book/:eventTypeSlug` remain and work as today (event type slug), or be deprecated/redirect?

**Answer:** clients will only have access to the events. lessonapp.com/book/30min-intro they will have access to. the professional page aka lessonapp.com/eugene will only be available to professionals after logging in


**5.2** When a professional has multiple event types, what should `lessonapp.com/eugene` show? (a) A list of event types to choose from, then calendar/slots for the chosen one; (b) one "default" event type and go straight to calendar; (c) something else (describe).

**Answer:** this will show a list of event types just like the current UI. then in another tab called bookings we can see the calendar with all events


**5.3** How is the "default" event type chosen when a professional has multiple? (First created, explicit "default" flag on event type, or no default and always show list?)

**Answer:** There is no "default" event type when a professional has multiple. they either have access to a specific event type or no event type is created yet. always show a list of event types to the professional


**5.4** Should the client explicitly choose "One-time booking" vs "Recurring weekly booking" in the form when the professional allows both? If yes: should the recurring count (e.g. 4 or 8) be fixed by the professional only, or can the client choose from a set (e.g. 4, 6, 8)?

**Answer:** yes. the client will explicitly choose one time booking or recurring weekly booking in the form. the recurring count will be fixed by the professional only


---

## Step 6: Timezone-aware slot generation

**Goal:** "Available hours" (e.g. Mon 9–5) are interpreted in the professional's time zone. Slots are generated and stored in UTC (TIMESTAMPTZ). Client sees times in a clear way (their TZ or professional's TZ, as you prefer).

**Planned actions:**
- In slot generation, use the professional's time zone to convert "9:00" on a given date to UTC start/end for that day.
- Store booking start/end as TIMESTAMPTZ (already done).
- Optionally show the professional's time zone on the booking page so the client understands "9:00" is in that TZ.

### Questions — Step 6

**6.1** For the POC, which time zone should the booking page show to the client: (a) client's local time zone only (current behavior), (b) professional's time zone only, (c) both (e.g. "Times shown in Eastern Time (your time: Pacific)")?

**Answer:** we can lock the time zone for POC in PST LA time zone


**6.2** Should slot times displayed to the client be in the professional's time zone, the client's time zone, or configurable (e.g. a toggle)?

**Answer:** professional's time zone


**6.3** Time zone format: store as IANA string (e.g. `America/New_York`) only, or do you need to support UTC offset as well (e.g. `UTC-5`) for the POC?

**Answer:** let us also support UTC offset in addition to IANA string


---

## Step 7: Email confirmation on booking

**Goal:** When a client books, send one email to the client and one to the professional. No reminder system yet.

**Planned actions:**
- After `POST /api/bookings` successfully creates booking(s), trigger sending two emails (client + professional).
- Choose provider and implement sending (e.g. Resend, SendGrid, Nodemailer/SMTP); store no sensitive credentials in repo.

### Questions — Step 7

**7.1** Which email sending provider do you want to use for the POC? (e.g. Resend, SendGrid, Mailgun, Nodemailer with your SMTP, other?) If you have no preference, say "no preference" and we can pick one that fits Vercel.

**Answer:** no preference


**7.2** From-address: should confirmation emails come from a single system address (e.g. `bookings@yourdomain.com`) or from the professional's email? If system: do you already have a domain and verified sender?

**Answer:** yes this should come from a single system address. from the professional's email. Also we want to specify email template with ability to customize the template with keys that we can fill in with different values


**7.3** Email content: plain text only, or HTML? Should the email include: booking date/time, duration, professional name, client name, event type name, "add to calendar" link, or something else? List exactly what each email (to client vs to professional) must contain.

**Answer:** lets make the email HTML including booking date/time, duration, professional name, client name, event type name, "add to calendar link" and location. Also allow the message to be customizable with an HTML template


**7.4** If sending fails (e.g. provider error), should the booking still be created and we log the failure, or should we fail the request and not create the booking? (Recommendation: create booking and log; retry or manual follow-up later.)

**Answer:** if we fail to send the email, display that email sending has failed and to resend the email correctly. We can have a button that says resend reminder email, but the event will be booked anyways.


**7.5** Do you need a "Reply-To" set (e.g. client's email when professional gets the email) so they can reply directly?

**Answer:** there should be an email with no reply. this email is only for notification or cancellation or rescheduling. Provide a link in this email to the user's specific booking with abilities to cancel or edit the booking event.


---

## Step 8: Payment (optional for POC)

**Goal:** Either skip payment or add minimal Stripe Checkout: one-time, fixed price per session, no subscriptions.

### Questions — Step 8

**8.1** For this POC, do you want payment at all? (Yes / No.)

**Answer:** no. payment will be handled separately. maybe we can do payment verification venmo in the future. that will be for future iterations.


**8.2** If yes: should payment happen before the booking is confirmed (e.g. pay then create booking), or after (e.g. create booking then send Stripe link to pay before the session)? Any preference on when to charge (e.g. at booking time vs later)?

**Answer:** no


**8.3** If yes: one-time charge for the whole set of sessions (e.g. 4 sessions × $50 = $200) or charge per session later? For POC, "one-time fixed price per session" was the requirement — confirm: charge once for all sessions in the booking (including recurring) at booking time?

**Answer:** no


---

## Step 9: RecurringSeries table (optional)

**Goal:** Decide whether to add a dedicated `recurring_series` table or keep using only `recurring_group_id` on bookings.

### Questions — Step 9

**9.1** Do you want a separate `recurring_series` table for the POC? (e.g. id, recurring_group_id, event_type_id, start_time, count, created_at.) Or is keeping only `recurring_group_id` on each booking sufficient for now?

**Answer:** keeping only the recurring group id sufficient. if we see a useful reason to add a recurring series table we will do that in the future


---

## Step 10: Client-facing one-time vs recurring choice

**Goal:** If the professional allows both one-time and recurring, should the client explicitly choose in the form?

### Questions — Step 10

**10.1** When the professional has allowed recurring (e.g. up to 8 sessions), should the client always get a choice in the UI: "Book once" vs "Book 4 weekly sessions" (and optionally pick 4, 6, or 8)? Or is it acceptable that the professional sets "this offer is always 4 recurring sessions" with no client choice?

**Answer:** no. Whether an event type is recurring or one-time, is decided by the professional who creates the event type. Each offer will always be one specific type and one specific number of recurrence


---

## Review: Contradictions and follow-up questions

*(Added after review. Resolve these before implementation.)*

### Contradiction to resolve

**5.4 vs 10.1 — Who decides one-time vs recurring?**

- **5.4** says: the client will explicitly choose “One-time booking” vs “Recurring weekly booking” in the form; recurring count is fixed by the professional.
- **10.1** says: whether an event type is recurring or one-time is decided by the professional when they create the event type; each offer is always one specific type and one specific number of recurrence (no client choice).

These conflict. Please choose one:

- **Option A:** Professional configures each event type as either “one-time only” or “recurring only (e.g. 4 sessions)”. The client sees only that; no choice in the form.
- **Option B:** Professional can allow both for an event type; in the booking form the client chooses “Book once” vs “Book N weekly sessions” (N fixed by professional).

**Your choice (A or B):** A


---

### Follow-up questions

**F1. Professionals table and Clerk**  
You chose Clerk for auth (2.1, 2.2). So we will not store `password_hash` in our DB — Clerk holds auth. Should the professionals table store: `id`, `clerk_user_id` (or similar), `full_name`, `profile_slug`, `time_zone` (if we add it at user level later), `created_at`, `updated_at`? Any other columns? Confirm or list the exact columns.

**Answer:** the columns listed sound good


**F2. Clients table**  
You want to store each client in the DB and dedupe (1.1, 1.3). Confirm: do we add a separate `clients` table (e.g. `id`, `email`, `first_name`, `last_name`, `phone`, `created_at`) and upsert when a booking is made (e.g. dedupe by `email`)? Or is “client” only the guest fields on each booking row, with dedupe done elsewhere (e.g. a separate table of “unique clients” for reporting)?

**Answer:** yes. if there is multiple emails with the same name, just add them all. do not dedup. we will go through and add a specific dedup workflow later to handle this case.


**F3. Existing data when adding `user_id` to event_types (3.2)**  
You said new professionals start with an empty slate. For existing `event_types` and `bookings` already in the DB today, what should we do when we add `user_id` to `event_types`? (a) Assign all to one “default” professional you create; (b) Set `user_id` to NULL (legacy; no one can edit until claimed); (c) Delete all and start fresh; (d) Other (describe).

**Answer:** there should not be any existing event_types for new professionals. Each professional will have their own unique list of event_types. when we deploy this set of changes, we will wipe the dd and start anew.


**F4. Time zone for POC: 4.1 vs 6.1**  
4.1 says time zone is per event type (locked by location). 6.1 says lock the whole POC to PST (LA). For POC, should we: (a) Use one fixed TZ (PST) for all event types and all slots, or (b) Store TZ per event type but only support PST for now (e.g. dropdown with only “America/Los_Angeles”)?

**Answer:** Lock TZ to the professional's TZ. if the professional is in America/LA timezone all events created will use PST


**F5. Price format (4.4)**  
Price per session lives on event type. What format should we use in the DB and API? (e.g. integer cents in USD, decimal dollars, currency code like USD — and which currency for POC?)

**Answer:** decimal dollars. Use Dollar amount with 2 decimal points for cents


**F6. Email from-address (7.2)**  
You wrote “from a single system address” and “from the professional's email” in the same sentence. Which do you want? (a) One system address for all (e.g. `bookings@yourdomain.com`), or (b) From-address = professional’s email (so each professional’s confirmation comes “from” them)?

**Answer:** From professional's email.


**F7. Booking link for cancel/edit (7.5)**  
You want a link in the email to the user’s booking with ability to cancel or edit. For POC: (a) Should the client be able to cancel or edit their booking without logging in (e.g. magic link with token)? (b) Is “cancel booking” and “edit booking” (e.g. change time) in scope for POC, or a later iteration?

**Answer:** clients should be able to cancel or edit their booking without logging in. magic link with token. Lets add this in a future iteration. for now the edit and cancel should just lead to a static html page that does nothing


**F8. Public URL pattern (5.1)**  
Confirm: clients only ever use `lessonapp.com/book/:eventTypeSlug` (e.g. `/book/30min-intro`) to book. There is no public `lessonapp.com/:professionalSlug` for clients. The URL `lessonapp.com/eugene` (or `/:professionalSlug`) is only for the professional’s dashboard after they log in. Correct?

**Answer:** yes


**F9. Professional slug change (1.4)**  
If a professional changes their slug (e.g. from `user_123` to `eugene`), should old links to `lessonapp.com/user_123` redirect to `lessonapp.com/eugene`, or show 404? And do we need to reserve certain path segments (e.g. `book`, `setup`, `api`) so a professional cannot take the slug `book`?

**Answer:** yes reserve certain path segments. also try to avoid page failures. let us update old links.


---

## Second pass: Remaining follow-ups
*(Fill these so the spec is complete.)*

**1. Contradiction (5.4 vs 10.1) still open**  
The “Your choice (A or B):” line above is still empty. Please pick:
- **A** = Professional sets each event type as one-time only OR recurring only; client has no choice in the form.
- **B** = Professional can allow both; client chooses “Book once” vs “Book N sessions” in the form.

**Your choice (A or B):** A


**2. Email “from” professional’s address (F6)**  
Sending with From = professional’s email usually requires that address to be verified with the provider (e.g. Resend, SendGrid). For POC, which do you want? (a) **System From** (e.g. `bookings@yourdomain.com`) with **Reply-To: professional’s email** so replies go to the professional; or (b) **From = professional’s email** (we implement verification or only enable it when the provider supports it)?

**Answer:** lets do A


**3. “Update old links” when slug changes (F9)**  
To support old URLs when a professional changes their slug (e.g. `/user_123` → `/eugene`): should we store previous slugs and redirect (e.g. a `slug_redirects` table or `previous_slugs` on professionals), or another approach? If we store previous slugs, should redirect be permanent (301) or temporary (302)?

**Answer:** if the slug has changed we want to now only use the new slugs. can we just permanently redirect until we can change the slugs completely? I'd rather not only redirect in case this turns into 20 redirects from constantly changing slugs


**4. Clients table: one row per booking? (F2)**  
You said do not dedupe and “add them all.” Confirm: do we insert **one row into `clients` per booking** (so the same email can appear many times), or one row per unique guest and we “add all” in a different way?

**Answer:** one row per unique guest. But we do want to keep a history of all bookings by this client/guest


**5. Unique guest key (clients table)**  
For “one row per unique guest,” what defines uniqueness? (a) **Email only** (same email = same guest), or (b) **Email + first name + last name** (same email and name = same guest), or (c) something else?

**Answer:** unique would mean same email, same first name, same last name


---

## Next step

Once every question above has an answer (including the contradiction A/B, F1–F9, second-pass items 1–4, and item 5), use this doc as the spec to create a concrete implementation plan (tickets/PRs) with no remaining assumptions.
