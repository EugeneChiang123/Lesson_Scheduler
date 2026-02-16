/**
 * Full workflow test: create event type → fetch by slug (booking link) → get slots → create booking → list bookings.
 * Ensures DB (Postgres) persistence and booking links work. Run from repo root with .env containing POSTGRES_URL.
 * Usage: node scripts/workflow-test.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const http = require('http');

const BASE = 'http://127.0.0.1:3765';
const SLUG = 'workflow-test-' + Date.now();
const NAME = 'Workflow Test 30min';

// Future Tuesday 09:00 (availability is Tue 09:00-17:00)
function nextTuesday() {
  const d = new Date();
  d.setDate(d.getDate() + ((2 + 7 - d.getDay()) % 7));
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { dateStr: `${y}-${m}-${day}`, date: d };
}
const { dateStr } = nextTuesday();
const slotTime = `${dateStr} 09:00:00`;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port || 3765,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body && (method === 'POST' || method === 'PATCH')) {
      const data = JSON.stringify(body);
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    } else if (!body || method === 'GET') {
      delete opts.headers['Content-Length'];
    }
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        let json = null;
        try {
          json = raw ? JSON.parse(raw) : null;
        } catch (_) {}
        resolve({ status: res.statusCode, body: json, raw });
      });
    });
    req.on('error', reject);
    if (body && (method === 'POST' || method === 'PATCH')) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  const app = require('../server/app');
  const server = app.listen(3765, '127.0.0.1');

  await new Promise((r) => server.once('listening', r));

  let passed = 0;
  let failed = 0;

  try {
    // 1. Create event type (saving to DB)
    const createRes = await request('POST', '/api/event-types', {
      slug: SLUG,
      name: NAME,
      description: 'Workflow test event',
      durationMinutes: 30,
      availability: [{ day: 2, start: '09:00', end: '17:00' }],
    });
    if (createRes.status !== 201 || !createRes.body?.slug) {
      console.error('FAIL: Create event type', createRes.status, createRes.body);
      if (createRes.status === 500 && createRes.body?.error?.includes('password')) {
        console.error('Hint: Check POSTGRES_URL in .env (e.g. reset Neon password and update .env).');
      }
      failed++;
    } else {
      console.log('OK: Create event type → saved to DB');
      passed++;
    }

    // 2. List event types (DB read)
    const listRes = await request('GET', '/api/event-types');
    const list = Array.isArray(listRes.body) ? listRes.body : [];
    const foundInList = list.some((e) => e.slug === SLUG);
    if (listRes.status !== 200 || !foundInList) {
      console.error('FAIL: List event types', listRes.status, foundInList);
      failed++;
    } else {
      console.log('OK: List event types → new event visible');
      passed++;
    }

    // 3. Get by slug (booking link simulation – this was 404 before Postgres)
    const slugRes = await request('GET', `/api/event-types/${SLUG}`);
    if (slugRes.status !== 200 || slugRes.body?.slug !== SLUG) {
      console.error('FAIL: Get by slug (booking link)', slugRes.status, slugRes.body);
      failed++;
    } else {
      console.log('OK: Get by slug → booking link works (no 404)');
      passed++;
    }

    // 4. Get slots for date
    const slotsRes = await request('GET', `/api/event-types/${SLUG}/slots?date=${dateStr}`);
    const slots = Array.isArray(slotsRes.body) ? slotsRes.body : [];
    const slotNorm = slotTime.replace(' ', 'T').substring(0, 19);
    const hasSlot = slots.some((s) => (s || '').replace(' ', 'T').startsWith(slotNorm));
    if (slotsRes.status !== 200 || !hasSlot) {
      console.error('FAIL: Get slots', slotsRes.status, slots.length, 'expected slot', slotNorm);
      failed++;
    } else {
      console.log('OK: Get slots → available slot found');
      passed++;
    }

    // 5. Create booking (API requires non-empty phone)
    const bookRes = await request('POST', '/api/bookings', {
      eventTypeSlug: SLUG,
      startTime: slotTime,
      firstName: 'Workflow',
      lastName: 'Tester',
      email: 'workflow@test.local',
      phone: '+15550000000',
    });
    if (bookRes.status !== 201 || !bookRes.body?.success) {
      console.error('FAIL: Create booking', bookRes.status, bookRes.body);
      failed++;
    } else {
      console.log('OK: Create booking → saved to DB');
      passed++;
    }

    // 6. List bookings (instructor calendar)
    const bookingsRes = await request('GET', '/api/bookings');
    const bookings = Array.isArray(bookingsRes.body) ? bookingsRes.body : [];
    const ourBooking = bookings.find((b) => b.email === 'workflow@test.local' && b.event_type_name === NAME);
    if (bookingsRes.status !== 200 || !ourBooking) {
      console.error('FAIL: List bookings', bookingsRes.status, !!ourBooking);
      failed++;
    } else {
      console.log('OK: List bookings → new booking visible');
      passed++;
    }
  } finally {
    server.close();
  }

  console.log('\n---');
  if (failed) {
    console.log(`Result: ${passed} passed, ${failed} failed`);
    process.exit(1);
  }
  console.log(`Result: ${passed} passed. Saving, new events, and booking links all work.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
