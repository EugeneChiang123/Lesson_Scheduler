# Bug Report: 404 on Vercel for API and Root URL

**Summary:** On Vercel, `GET /api/event-types/30min-intro` and the site root returned 404. The same app worked locally. The cause was **Vercel routing**: requests never reached our Express app or the SPA's `index.html`. This document records what we tried, what worked, and how to debug similar issues yourself.

---

## 1. Problem statement

- **Where:** Production/preview on Vercel (`https://...vercel.app/...`).
- **What:**  
  - Booking link: `GET /api/event-types/30min-intro` → **404** ("Request failed (404)" in UI, "page could not be found" in Postman).  
  - Site root: `https://...vercel.app/` → **404** ("page not found").
- **Expected:** 200 with event type JSON (or 404 from our API with `{"error":"Event type not found"}`), and the SPA loading at `/`.
- **Observed:** Generic 404 before our code ran (Vercel-level 404).
- **Local:** Same requests to `http://localhost:5xxx` worked (API and SPA).

---

## 2. Context: how this app is built and deployed

- **Stack:** Vite (React) frontend, Express API, optional Postgres or file store.
- **Local:** `npm run dev` runs Express (e.g. port 3001) and Vite dev server (e.g. 5173). The client calls `/api/...`; the dev server proxies or you hit the API origin. All requests go through one Express process.
- **Vercel:**  
  - **Build:** `npm run build` → builds the client into `client/dist`.  
  - **Output:** `outputDirectory: "client/dist"` → Vercel serves static files from that folder.  
  - **API:** We use a **serverless function** in `api/[[...path]].js` that runs the same Express app.  
  - **Routing:** Vercel decides per request: serve a static file, invoke a function, or apply a rewrite. If nothing matches, it returns **404** and can add headers like `X-Vercel-Error: NOT_FOUND`.

Important: On Vercel, **the path in the URL must match how the function is registered**. The file `api/[[...path]].js` is exposed as the **literal** route `/api/[[...path]]` (brackets included). So a request to `/api/event-types/30min-intro` does **not** match that path and never invokes our handler unless we explicitly route it there (e.g. with a rewrite).

---

## 3. Hypotheses we considered

We considered several reasons for the 404 and tested them in order.

| # | Hypothesis | Meaning | How we tested | Result |
|---|------------|--------|----------------|--------|
| **H1** | Request never reaches Express | Vercel returns 404 before our serverless function runs | Check response headers (e.g. `X-Vercel-Error`), add debug in API response | **CONFIRMED** (see Evidence below) |
| **H2** | Route doesn’t match inside Express | Function runs but `req.url` or path is wrong so our routes don’t match | Log path/slug in handler, return debug in 404 body | Not the main cause; routing was the issue |
| **H3** | Handler runs but event type not in store | Our code returns 404 because `getBySlug('30min-intro')` is null (e.g. file store ephemeral, or no Postgres) | Return `debug: { store, slug, path }` in 404 JSON | Only relevant after routing was fixed; list event types showed data existed |

The **critical evidence** was the **response headers** in the browser/Postman: **`X-Vercel-Error: NOT_FOUND`**. That header is set by **Vercel**, not by our app. So the 404 was happening at the platform layer: no function was found for that path. Our Express handler never ran, so the “serverless data not shared” message in the UI was a red herring for the **first** bug (routing).

---

## 4. Evidence that decided the cause

- **Screenshot / Network tab:**  
  - Request: `GET https://...vercel.app/api/event-types/30min-intro`  
  - Status: **404 Not Found**  
  - Response header: **`X-Vercel-Error: NOT_FOUND`**  
  → This means Vercel itself returned 404; our handler was not invoked.

- **If our handler had run**, we would have seen either:  
  - 200 with JSON, or  
  - 404 with body `{"error":"Event type not found"}` (and optionally a `debug` object).  
  We did **not** see that JSON body; we saw a generic “page could not be found” (and the header above), which confirmed H1.

- **After fixes:** List event types returned 200 with JSON; get-by-slug and root URL worked once rewrites and path handling were in place.

---

## 5. What we tried and what went wrong

### 5.1 Instrumentation (debug mode)

- **What we did:**  
  - In `server/routes/eventTypes.js`: on 404, return `debug: { store, slug, path }` and send logs to an ingest endpoint.  
  - In `api/[[...path]].js`: log incoming request path.  
  - In the client (Book.jsx): show `errorDebug` from the API response.

- **Why it made sense:** So we could see whether the request reached our handler and what path/store the server saw.

- **What went wrong:** On Vercel, the request never reached our handler, so we never got our JSON or debug. The **browser/Postman response** (headers + body) was what actually proved the request didn’t reach Express—so the most decisive “instrumentation” was **inspecting the HTTP response**, not only server-side logs.

- **Lesson:** For “is this our code or the platform?” questions, **response headers and body** (e.g. `X-Vercel-Error`, HTML vs our JSON) are often enough before adding more logging.

### 5.2 Fix 1: Root `app.js` (Express on Vercel)

- **What we did:**  
  - Added root `app.js`: `module.exports = require('./server/app');`  
  - In `server/app.js`, when `process.env.VERCEL` is set, serve static from `client/dist` and a catch-all to `index.html` for non-API routes.

- **Why it made sense:** Vercel’s docs say that a root `app.js` (or `server.js` / `index.js`) can be used as the **single** serverless function that receives **all** requests. We hoped every request (including `/api/event-types/30min-intro`) would then hit Express.

- **What went wrong:** Our project also has `buildCommand` and `outputDirectory` (Vite build). In that setup, Vercel appears to treat the deployment as a static/front-end project first. The root `app.js` was **not** used as the universal handler, so `/api/*` still had no matching function and we still got 404.

- **Lesson:** When the project has a clear “front-end build” (e.g. Vite + `outputDirectory`), don’t assume the “Express on Vercel” single-entry behavior will apply. Prefer **explicit rewrites** to the API function so routing is under our control.

### 5.3 Fix 2: Explicit rewrite for `/api/*` + path restoration

- **What we did:**  
  1. **vercel.json**  
     - Added rewrite: `"source": "/api/:path*"` → `"destination": "/api/[[...path]]"`.  
     - So every `/api/...` request is sent to the serverless function registered at `/api/[[...path]]`.  
  2. **api/[[...path]].js**  
     - When Vercel rewrites, it can pass the original path as a **query parameter** (e.g. `path=event-types/30min-intro`).  
     - We read `req.query.path` and, if present, set `req.url = '/api/' + pathSegment + (other query string)` so Express sees the **original** path and our routes (e.g. `GET /api/event-types/:slug`) match.

- **Why it made sense:**  
  - We know the only function we have for API is at the literal path `/api/[[...path]]`. So we must **send** all `/api/*` traffic there via rewrite.  
  - Vercel’s rewrite can change the path the function receives; restoring `req.url` from the query param makes Express behave as if the client had requested `/api/event-types/30min-intro` directly.

- **Result:** API started working (e.g. list event types, get event type by slug returned 200 or our own 404 JSON).

- **Lesson:** On Vercel, **file path = route**. To have one function handle many paths, use **rewrites** and, if needed, **restore the original path** inside the function (e.g. from query or headers) so your framework (Express) can route correctly.

### 5.4 Fix 3: Root URL 404 (SPA not loading)

- **What we did:**  
  - In **vercel.json**, added an explicit rewrite: `"source": "/"` → `"destination": "/index.html"`.

- **Why it made sense:** The existing SPA rewrite used a regex that might not match the root path `/` in Vercel’s implementation. An explicit rule for `/` guarantees the root URL is served with `index.html`.

- **Result:** Root URL started serving the SPA.

- **Lesson:** For SPAs, include an **explicit** rewrite for `"/"` to `"/index.html"` in addition to a catch-all for other client routes, so the root never falls through to a generic 404.

---

## 6. Final configuration (reference)

**vercel.json** (relevant parts):

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "client/dist",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/[[...path]]" },
    { "source": "/", "destination": "/index.html" },
    { "source": "/((?!api/|assets/).*)", "destination": "/index.html" }
  ]
}
```

- First: send all `/api/*` to the catch-all API function.  
- Second: serve `index.html` for the root path.  
- Third: serve `index.html` for any other path that is not `/api/...` or `/assets/...` (SPA client-side routes).

**api/[[...path]].js** (path restoration):

- If `req.query.path` is set (from the rewrite), set `req.url = '/api/' + pathSegment + (rest of query string)` so Express sees the correct path.

---

## 7. What to do differently next time

1. **Check who returns 404 first**  
   - Inspect response **headers** (e.g. `X-Vercel-Error: NOT_FOUND`) and **body** (HTML “page not found” vs our JSON).  
   - If the 404 is from the platform (Vercel), focus on **routing and rewrites**, not application logic or data.

2. **Understand the deployment model**  
   - Know how your host maps URLs to static files vs serverless functions (e.g. Vercel: file path under `api/` = route).  
   - One function for many paths usually requires a **rewrite** plus, if needed, **path restoration** in the handler.

3. **Use Postman (or curl) early**  
   - Test `GET /api/health` and `GET /api/event-types/30min-intro` against the **deployed** URL.  
   - Distinguishes “API unreachable” (404 from platform) from “API works but returns 404” (our JSON with `error`).

4. **Don’t rely on a single “magic” fix**  
   - Root `app.js` sounded right from the docs but didn’t apply the same way with our build setup.  
   - Explicit rewrites gave predictable behavior. Prefer explicit routing when mixing static build + API.

5. **SPA + root**  
   - Always have an explicit rewrite for `"/"` → `"/index.html"` when the app is an SPA on a host that does path-based lookup.

---

## 8. How to debug similar issues yourself

### Step 1: Reproduce and capture the response

- Open DevTools → **Network** (or use Postman).
- Trigger the failing request (e.g. open the booking URL or send `GET .../api/event-types/30min-intro`).
- Note:
  - **Status code** (e.g. 404).
  - **Response headers** (e.g. `X-Vercel-Error`, `Content-Type`).
  - **Response body** (HTML vs JSON like `{"error":"..."}`).

### Step 2: Decide where the 404 comes from

- **Platform (e.g. Vercel):**  
  - Headers like `X-Vercel-Error: NOT_FOUND`.  
  - Body is often HTML or a generic “page not found.”  
  → Fix **routing/rewrites** and how the function is invoked.

- **Your app (Express):**  
  - Body is your JSON (e.g. `{"error":"Event type not found"}`).  
  → Fix **route handlers**, **path** (`req.url`), or **data** (store/DB).

### Step 3: If it’s platform routing (Vercel)

- List your **serverless functions** (e.g. files under `api/`). Each file’s path becomes a route (e.g. `api/[[...path]].js` → `/api/[[...path]]`).
- If the client calls paths like `/api/event-types/30min-intro`, they won’t match that literal route. So:
  - Add a **rewrite** in `vercel.json`: e.g. `"/api/:path*"` → `"/api/[[...path]]"`.
  - In the function, if the platform passes the original path as a query param, **restore** `req.url` (or equivalent) so your framework routes correctly.

### Step 4: If it’s SPA root or client routes returning 404

- Add an **explicit** rewrite for the root: `"/"` → `"/index.html"`.
- Keep a catch-all for other client routes (excluding `/api/` and static assets) → `"/index.html"`.

### Step 5: Verify after each change

- **Redeploy** (rewrites and config only take effect after deploy).
- Test again: root URL, `/api/health`, `/api/event-types`, `/api/event-types/30min-intro`, and one client route (e.g. `/book/30min-intro`).

### Useful references

- [Vercel Rewrites](https://vercel.com/docs/rewrites)  
- [Express on Vercel](https://vercel.com/docs/frameworks/backend/express)  
- [Vercel Project Configuration (vercel.json)](https://vercel.com/docs/project-configuration/vercel-json)  
- Postman collection in this repo: `postman/Lesson-Scheduler-API.postman_collection.json` (set `baseUrl` to your deployment or local server).

---

## 9. One-line summary

**Bug:** Vercel returned 404 for `/api/*` and `/` because requests never reached our Express app or `index.html`—routing and rewrites were missing or incomplete. **Fix:** (1) Rewrite `/api/:path*` to the catch-all API function and restore `req.url` from the path query param; (2) Explicitly rewrite `/` and other non-API paths to `/index.html` for the SPA.
