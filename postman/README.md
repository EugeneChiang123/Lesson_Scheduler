# Postman: verify API

1. **Import** the collection in Postman: File → Import → `Lesson-Scheduler-API.postman_collection.json`.
2. **Set base URL** in the collection variables:
   - **Vercel:** `https://your-deployment.vercel.app` (no trailing slash).
   - **Local:** `http://localhost:5000` (or whatever port your server uses).
3. **Run** requests in order:
   - **Health** – should return `{ "store": "file" }` or `{ "store": "postgres" }` (confirms API is reachable).
   - **Get event type by slug (30min-intro)** – 200 = event type found; 404 = not found (on Vercel with file store this is expected until you set `POSTGRES_URL` and run migration).

If Health returns 404, the request never reached Express (routing issue). If Health returns 200 but “Get event type” returns 404, the API is working but the event type isn’t in the store (use Postgres on Vercel and run `npm run db:migrate-pg`).
