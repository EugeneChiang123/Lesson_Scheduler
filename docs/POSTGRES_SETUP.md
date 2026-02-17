# Postgres on Vercel (Lesson Scheduler)

Use Postgres so event types and bookings persist across serverless requests (fixes 404 when opening a new event’s booking link in a new window).

**Recommended:** Add Postgres via the **Vercel Marketplace** (e.g. Neon). Vercel injects the connection URL into your project; you run the migration once, then redeploy.

> **Note:** The old “Vercel Postgres” product was retired and moved to [Neon](https://vercel.com/marketplace/neon). For new projects, use a [Postgres integration from the Marketplace](https://vercel.com/marketplace?category=storage&search=postgres). Neon is the default option and works well with this app.

---

## 1. Add Postgres to your Vercel project

1. Open [vercel.com](https://vercel.com) and go to your **Lesson Scheduler** project (or create one by importing the repo).
2. In the project, open **Storage** (or **Integrations** / **Marketplace**).
3. Click **Create Database** or **Add Integration** and choose **Postgres**.
4. Pick a provider (e.g. **Neon**), then **Connect** or **Add to Project** and link this Vercel project.
5. After the integration is added, Vercel will add environment variables to the project (e.g. `POSTGRES_URL` or `DATABASE_URL`). You can see them under **Settings → Environment Variables**. The app uses either variable for the connection, so if Neon only sets `DATABASE_URL`, you do not need to add `POSTGRES_URL`.

---

## 2. Get the connection URL for local use and migration

You need the same URL locally so you can run the migration and (optionally) run the app against the same DB.

1. In your Vercel project go to **Settings → Environment Variables**.
2. Find `POSTGRES_URL` or `DATABASE_URL` (or the variable name shown after adding the integration). Copy its **value** (or use “Reveal” then copy).
3. In your **project root** on your machine, create a `.env` file (or edit it) and add:

   ```
   POSTGRES_URL=postgresql://...paste the URL here...
   ```

   The app reads **either** `POSTGRES_URL` or `DATABASE_URL` (same connection string). If the integration only created `DATABASE_URL` (common with Neon), that alone is enough—no need to add `POSTGRES_URL`:

   ```
   DATABASE_URL=postgresql://...
   ```

   You can copy `.env.example` to `.env` and replace the placeholder with the real URL.

---

## 3. Run the migration once

This creates the `event_types` and `bookings` tables in your Postgres database.

From the **project root** (with `.env` containing the URL):

```bash
npm run db:migrate-pg
```

You should see: **Postgres migration complete: event_types and bookings tables ready.**

If you prefer to run SQL by hand (e.g. in Neon’s SQL editor), paste and run the contents of `server/db/schema.sql`.

---

## 4. Redeploy on Vercel

So that the serverless functions use the new Postgres env vars:

1. Go to **Deployments**.
2. Open the **…** menu on the latest deployment and choose **Redeploy** (no need to clear cache unless you want to).

After the redeploy, the app will use Postgres. New event types will persist, and opening a booking link in a new window will work without 404.

---

## 5. (Optional) Seed from existing file data

If you already have data in the file store (`server/db/event_types.json` and `server/db/bookings.json`) and want it in Postgres:

```bash
npm run db:seed-pg
```

Run this from the project root with `POSTGRES_URL` (or `DATABASE_URL`) in your `.env`.

---

## 6. Verify

- **On Vercel:** Create an event type in the setup UI, then open its booking link in a new window. The booking page should load (no 404).
- **Locally:** With `.env` set and `npm run dev`, create an event type and open the booking link in a new tab; it should load.

The app automatically uses Postgres when `POSTGRES_URL` or `DATABASE_URL` is set. It connects using the `pg` driver and either variable, so a single URL (e.g. Neon’s `DATABASE_URL`) is sufficient.
