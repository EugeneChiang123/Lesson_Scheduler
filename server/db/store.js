const fs = require('fs');
const path = require('path');

// On Vercel, the deployment filesystem is read-only; use /tmp so writes succeed.
// Data in /tmp is ephemeral (per function instance) and not shared across regions.
const dataDir = process.env.VERCEL
  ? (() => {
      const dir = path.join('/tmp', 'lesson-scheduler-db');
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) {
        /* ignore */
      }
      return dir;
    })()
  : path.join(__dirname);
const eventTypesPath = path.join(dataDir, 'event_types.json');
const bookingsPath = path.join(dataDir, 'bookings.json');

/** Max recurring sessions per booking (e.g. ~1 year weekly). Avoids runaway writes and long sync work. */
const MAX_RECURRING_COUNT = 24;

function clampRecurringCount(n) {
  const val = Number.isFinite(n) ? Math.round(Number(n)) : 1;
  return Math.min(MAX_RECURRING_COUNT, Math.max(1, val));
}

function readEventTypes() {
  try {
    const raw = fs.readFileSync(eventTypesPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

function writeEventTypes(data) {
  fs.writeFileSync(eventTypesPath, JSON.stringify(data, null, 2), 'utf8');
}

function readBookings() {
  try {
    const raw = fs.readFileSync(bookingsPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

function writeBookings(data) {
  fs.writeFileSync(bookingsPath, JSON.stringify(data, null, 2), 'utf8');
}

let eventTypeId = 1;
let bookingId = 1;

function initIds() {
  const et = readEventTypes();
  const bk = readBookings();
  if (et.length) eventTypeId = Math.max(...et.map((e) => e.id)) + 1;
  if (bk.length) bookingId = Math.max(...bk.map((b) => b.id)) + 1;
}
initIds();

const store = {
  eventTypes: {
    all() {
      return readEventTypes();
    },
    getBySlug(slug) {
      return readEventTypes().find((e) => e.slug === slug) || null;
    },
    getById(id) {
      return readEventTypes().find((e) => e.id === Number(id)) || null;
    },
    create(data) {
      const list = readEventTypes();
      if (list.some((e) => e.slug === data.slug)) throw new Error('Slug already exists');
      const duration = data.durationMinutes ?? 30;
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('durationMinutes must be a positive number');
      const row = {
        id: eventTypeId++,
        slug: data.slug,
        name: data.name,
        description: data.description || '',
        durationMinutes: duration,
        allowRecurring: Boolean(data.allowRecurring),
        recurringCount: clampRecurringCount(data.recurringCount ?? 1),
        availability: Array.isArray(data.availability) ? data.availability : [],
      };
      list.push(row);
      writeEventTypes(list);
      return row;
    },
    update(id, data) {
      const list = readEventTypes();
      const idx = list.findIndex((e) => e.id === Number(id));
      if (idx === -1) return null;
      if (data.slug !== undefined && list.some((e) => e.id !== Number(id) && e.slug === data.slug)) throw new Error('Slug already exists');
      const row = list[idx];
      const nextDuration = data.durationMinutes !== undefined ? data.durationMinutes : row.durationMinutes;
      if (!Number.isFinite(nextDuration) || nextDuration <= 0) throw new Error('durationMinutes must be a positive number');
      const updated = {
        ...row,
        slug: data.slug !== undefined ? data.slug : row.slug,
        name: data.name !== undefined ? data.name : row.name,
        description: data.description !== undefined ? data.description : row.description,
        durationMinutes: nextDuration,
        allowRecurring: data.allowRecurring !== undefined ? Boolean(data.allowRecurring) : row.allowRecurring,
        recurringCount: data.recurringCount !== undefined ? clampRecurringCount(data.recurringCount) : clampRecurringCount(row.recurringCount),
        availability: data.availability !== undefined ? data.availability : row.availability,
      };
      list[idx] = updated;
      writeEventTypes(list);
      return updated;
    },
  },
  bookings: {
    list() {
      return readBookings();
    },
    getByEventTypeAndDate(eventTypeId, dateStr) {
      return readBookings().filter((b) => b.event_type_id === eventTypeId && (b.start_time.startsWith(dateStr) || b.start_time.replace(' ', 'T').startsWith(dateStr)));
    },
    /** All bookings on this date (any event type). Used to block slots across event types so the instructor is not double-booked. */
    getBookingsOnDate(dateStr) {
      return readBookings().filter((b) => {
        const s = b.start_time.replace(' ', 'T');
        return s.startsWith(dateStr);
      });
    },
    /** Returns any booking that overlaps [startTime, endTime], regardless of event type, so one instructor cannot be double-booked across different event links. */
    findOverlapping(startTime, endTime) {
      const list = readBookings();
      const start = startTime.replace(' ', 'T');
      const end = endTime.replace(' ', 'T');
      return list.find((b) => {
        const bStart = b.start_time.replace(' ', 'T');
        const bEnd = b.end_time.replace(' ', 'T');
        return start < bEnd && end > bStart;
      });
    },
    insert(record) {
      const list = readBookings();
      const row = { id: bookingId++, ...record };
      list.push(row);
      writeBookings(list);
      return row;
    },
  },
};

module.exports = store;
module.exports.clampRecurringCount = clampRecurringCount;
