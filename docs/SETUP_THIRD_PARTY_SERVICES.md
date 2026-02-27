# Step-by-step: Connect third-party services to Lesson Scheduler

This app uses three external services. You need **Clerk** and **Postgres** for the app to work in production; **Resend** is optional (booking confirmation emails).

---

## 1. Clerk (authentication) — **required**

Clerk handles sign-in and sign-up for professionals (instructors). Without it, the app shows a blank or “key not set” page.

### 1.1 Create a Clerk account and application

1. Go to **[https://dashboard.clerk.com](https://dashboard.clerk.com)** and sign up (or sign in).
2. Click **Add application**.
3. Name it (e.g. “Lesson Scheduler”) and choose **Email** (and optionally **Google** or other sign-in methods). Click **Create application**.
4. You’ll land on the dashboard. In the left sidebar, open **API Keys**.

### 1.2 Copy the keys

You’ll see:

- **Publishable key** — starts with `pk_test_` (or `pk_live_` for production). This is safe to use in the browser.
- **Secret key** — starts with `sk_test_` (or `sk_live_`). **Never** put this in client code or commit it; only use it on the server.

### 1.3 Configure in your environment

**Local development**

1. In the project root, copy the example env file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and set:
   ```env
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxx
   CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxx
   ```
   (Use the real values from the Clerk dashboard.)

**Vercel (production)**

1. In [Vercel](https://vercel.com) go to your project → **Settings** → **Environment Variables**.
2. Add:
   - **Name:** `VITE_CLERK_PUBLISHABLE_KEY`  
     **Value:** your Clerk publishable key  
     **Environment:** Production (and Preview if you use preview deployments).
   - **Name:** `CLERK_SECRET_KEY`  
     **Value:** your Clerk secret key  
     **Environment:** Production (and Preview).
3. **Redeploy** the project (Deployments → ⋮ → Redeploy). Vite bakes `VITE_*` into the build, so a new build is required after adding the publishable key.

After this, the app should load and you can sign in / sign up. If you add Postgres next, auth will persist properly.

---

## 2. Postgres (database) — **required for production**

The app can run locally with a file store, but in production (e.g. Vercel) you need a real database so that:

- Professionals and event types persist.
- Booking links work when opened in a new window (no “event type not found”).
- Auth (Clerk) is fully supported (professionals and clients are stored in the DB).

The easiest path is to add Postgres through the **Vercel Marketplace** (e.g. Neon); Vercel will inject the connection URL for you.

### 2.1 Add Postgres via Vercel

1. Go to **[https://vercel.com](https://vercel.com)** and open your **Lesson Scheduler** project.
2. Open **Storage** (or **Integrations** / **Marketplace**).
3. Click **Create Database** or **Add Integration**, then choose **Postgres**.
4. Pick a provider (e.g. **Neon**) and **Connect** or **Add to Project**, then link this Vercel project.
5. After the integration is added, Vercel will add an env var such as `POSTGRES_URL` or `DATABASE_URL`. You can confirm under **Settings → Environment Variables**. The app uses either name.

### 2.2 Get the URL for local use and migration

1. In Vercel: **Settings → Environment Variables**.
2. Find `POSTGRES_URL` or `DATABASE_URL`, then copy its value (use “Reveal” if needed).
3. In your **project root**, add it to `.env`:
   ```env
   POSTGRES_URL=postgresql://user:password@host.region.aws.neon.tech/neondb?sslmode=require
   ```
   (Paste your actual URL.) If the integration only created `DATABASE_URL`, you can use that instead; the app accepts both.

### 2.3 Run the database migration (once)

This creates the tables (professionals, clients, event types, bookings, etc.).

From the **project root** (with `POSTGRES_URL` or `DATABASE_URL` in `.env`):

```bash
npm run db:migrate-mvp
```

You should see a success message. This script **drops and recreates** tables, so the database starts fresh.

### 2.4 Redeploy on Vercel

So the serverless app uses the new database:

1. **Deployments** → **⋮** on the latest deployment → **Redeploy**.

After this, sign-in, event types, and bookings will persist, and booking links will work from new windows.

---

## 3. Resend (email) — **optional**

When configured, the app sends booking confirmation emails to the client and the professional after a booking is created.

### 3.1 Create a Resend account and API key

1. Go to **[https://resend.com](https://resend.com)** and sign up.
2. In the dashboard, open **API Keys** (or **Developers → API Keys**).
3. Click **Create API Key**, name it (e.g. “Lesson Scheduler”), and copy the key (starts with `re_`). You won’t see it again, so store it somewhere safe.

### 3.2 Use resend.dev for testing; verify a domain for production

- **Testing (recommended to start):** Use Resend’s test domain so you don’t need to verify anything. Set `EMAIL_FROM` to `Lesson Scheduler <onboarding@resend.dev>` (or leave it unset—that’s the app default). **Note:** With the test domain, Resend only allows sending **to the email address that owns your Resend account**. To test, use that same address as the client email when making a booking. For sending to any recipient, you need a verified domain (below).
- **Production (when ready):** In Resend, go to [resend.com/domains](https://resend.com/domains), add and verify your domain, then set `EMAIL_FROM` to an address on that domain (e.g. `Lesson Scheduler <bookings@yourdomain.com>`).

### 3.3 Configure in your environment

**Local (`.env`) — for testing with resend.dev:**

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=Lesson Scheduler <onboarding@resend.dev>
```

(You can omit `EMAIL_FROM`; the app defaults to `onboarding@resend.dev`.)

**For production:** After verifying your domain in Resend, set:

```env
EMAIL_FROM=Lesson Scheduler <bookings@yourdomain.com>
```

**Vercel:** Add the same variables in **Settings → Environment Variables** for Production (and Preview if you want emails there too).

**Optional:** Set `BASE_URL` to your app’s public URL (e.g. `https://lesson-scheduler-two.vercel.app`) so links in emails point to the right place.

If you don’t set `RESEND_API_KEY`, the app still works. **Dev testing:** Set `EMAIL_DEV_OVERRIDE` to your Resend account email to receive all booking emails at that address (subjects prefixed with `[Dev]`). Leave unset in production. It just won’t send confirmation emails.

---

## Quick checklist

| Step | Service   | What you did |
|------|-----------|--------------|
| 1    | **Clerk** | Created app at dashboard.clerk.com → copied publishable + secret key → set `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in .env and Vercel → redeployed. |
| 2    | **Postgres** | Added Postgres (e.g. Neon) via Vercel Storage/Marketplace → copied connection URL to .env → ran `npm run db:migrate-mvp` → redeployed. |
| 3    | **Resend** (optional) | Signed up at resend.com → created API key → set `RESEND_API_KEY` and `EMAIL_FROM` in .env and Vercel. |

---

## Troubleshooting

- **Blank page on Vercel:** Ensure `VITE_CLERK_PUBLISHABLE_KEY` is set in Vercel and you **redeployed** after adding it.
- **“Event type not found” when opening booking link in new tab:** Add Postgres, run `npm run db:migrate-mvp`, and redeploy so data is stored in the database.
- **Sign-in works locally but not on Vercel:** Check that both `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set in Vercel for the correct environment.
- **No emails after booking:** Confirm `RESEND_API_KEY` and `EMAIL_FROM` are set; check Resend dashboard for logs and domain verification.

For more detail on Postgres only, see [POSTGRES_SETUP.md](POSTGRES_SETUP.md).
