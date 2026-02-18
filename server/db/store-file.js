/**
 * File-backed data store (JSON in server/db/ or /tmp on Vercel).
 * Same API as store-pg; all methods return Promises for a uniform interface.
 * Used when POSTGRES_URL is not set.
 */
const fs = require('fs');
const path = require('path');

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

const MAX_RECURRING_COUNT = 52;

/** In-memory mutex per event_type_id so check-then-insert is atomic per type (prevents double booking). */
const bookingMutexByEventType = new Map();
async function withBookingMutex(eventTypeId, fn) {
  const prev = bookingMutexByEventType.get(eventTypeId) || Promise.resolve();
  let resolveNext;
  const next = new Promise((r) => { resolveNext = r; });
  bookingMutexByEventType.set(eventTypeId, next);
  try {
    await prev;
    return await fn();
  } finally {
    resolveNext();
    if (bookingMutexByEventType.get(eventTypeId) === next) bookingMutexByEventType.delete(eventTypeId);
  }
}

/** Global mutex for PATCH update: overlap check and write must be atomic with all other booking writes. */
const GLOBAL_BOOKING_MUTEX_KEY = Symbol('global');
async function withGlobalBookingMutex(fn) {
  return withBookingMutex(GLOBAL_BOOKING_MUTEX_KEY, fn);
}

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

/** Derive duration in minutes from start/end when not stored */
function deriveDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 30;
  const start = new Date(startTime.replace(' ', 'T'));
  const end = new Date(endTime.replace(' ', 'T'));
  return Math.round((end - start) / 60000) || 30;
}

/** Ensure booking has notes and duration_minutes for API consistency */
function normalizeBooking(b) {
  const duration_minutes = b.duration_minutes != null ? b.duration_minutes : deriveDurationMinutes(b.start_time, b.end_time);
  return { ...b, notes: b.notes ?? '', duration_minutes };
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
  clampRecurringCount,
  professionals: {
    getByClerkId() {
      return Promise.resolve(null);
    },
    getById() {
      return Promise.resolve(null);
    },
    getByProfileSlug() {
      return Promise.resolve(null);
    },
    create() {
      return Promise.reject(new Error('Auth requires Postgres'));
    },
    update() {
      return Promise.reject(new Error('Auth requires Postgres'));
    },
  },
  slug_redirects: {
    insert() {
      return Promise.reject(new Error('Auth requires Postgres'));
    },
  },
  eventTypes: {
    all() {
      return Promise.resolve(readEventTypes());
    },
    getBySlug(slug) {
      return Promise.resolve(readEventTypes().find((e) => e.slug === slug) || null);
    },
    getById(id) {
      return Promise.resolve(readEventTypes().find((e) => e.id === Number(id)) || null);
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
        location: data.location != null ? String(data.location) : '',
      };
      list.push(row);
      writeEventTypes(list);
      return Promise.resolve(row);
    },
    update(id, data) {
      const list = readEventTypes();
      const idx = list.findIndex((e) => e.id === Number(id));
      if (idx === -1) return Promise.resolve(null);
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
        location: data.location !== undefined ? (data.location != null ? String(data.location) : '') : (row.location || ''),
      };
      list[idx] = updated;
      writeEventTypes(list);
      return Promise.resolve(updated);
    },
  },
  bookings: {
    list() {
      const list = readBookings();
      return Promise.resolve(list.map(normalizeBooking));
    },
    getById(id) {
      const list = readBookings();
      const b = list.find((x) => x.id === Number(id)) || null;
      return Promise.resolve(b ? normalizeBooking(b) : null);
    },
    getByEventTypeAndDate(eventTypeId, dateStr) {
      const list = readBookings().filter(
        (b) => b.event_type_id === eventTypeId && (b.start_time.startsWith(dateStr) || b.start_time.replace(' ', 'T').startsWith(dateStr))
      );
      return Promise.resolve(list);
    },
    getBookingsOnDate(dateStr) {
      const list = readBookings().filter((b) => {
        const s = b.start_time.replace(' ', 'T');
        return s.startsWith(dateStr);
      });
      return Promise.resolve(list);
    },
    findOverlapping(startTime, endTime) {
      const list = readBookings();
      const start = startTime.replace(' ', 'T');
      const end = endTime.replace(' ', 'T');
      const found = list.find((b) => {
        const bStart = b.start_time.replace(' ', 'T');
        const bEnd = b.end_time.replace(' ', 'T');
        return start < bEnd && end > bStart;
      });
      return Promise.resolve(found || null);
    },
    insert(record) {
      const list = readBookings();
      const duration_minutes = record.duration_minutes != null ? record.duration_minutes : deriveDurationMinutes(record.start_time, record.end_time);
      const row = { id: bookingId++, ...record, notes: record.notes ?? '', duration_minutes };
      list.push(row);
      writeBookings(list);
      return Promise.resolve(normalizeBooking(row));
    },
    /**
     * Atomically check for overlaps then update (under global mutex). Prevents double-booking
     * when a concurrent POST or PATCH could insert/move into the same slot.
     * @returns {Promise<{ updated: object } | { notFound: true } | { conflict: true, conflictingStart: string }>}
     */
    async updateIfNoConflict(id, data) {
      return withGlobalBookingMutex(() => {
        const list = readBookings();
        const idx = list.findIndex((b) => b.id === Number(id));
        if (idx === -1) return Promise.resolve({ notFound: true });
        const row = list[idx];
        const start_time = data.start_time !== undefined ? data.start_time : row.start_time;
        const end_time = data.end_time !== undefined ? data.end_time : row.end_time;
        const start = start_time.replace(' ', 'T');
        const end = end_time.replace(' ', 'T');
        const overlapping = list.find((b) => {
          if (b.id === Number(id)) return false;
          const bStart = b.start_time.replace(' ', 'T');
          const bEnd = b.end_time.replace(' ', 'T');
          return start < bEnd && end > bStart;
        });
        if (overlapping) return Promise.resolve({ conflict: true, conflictingStart: overlapping.start_time });
        const duration_minutes = data.duration_minutes !== undefined ? data.duration_minutes : (row.duration_minutes != null ? row.duration_minutes : deriveDurationMinutes(row.start_time, row.end_time));
        const updated = {
          ...row,
          first_name: data.first_name !== undefined ? data.first_name : row.first_name,
          last_name: data.last_name !== undefined ? data.last_name : row.last_name,
          email: data.email !== undefined ? data.email : row.email,
          phone: data.phone !== undefined ? data.phone : row.phone,
          start_time,
          end_time,
          notes: data.notes !== undefined ? data.notes : (row.notes ?? ''),
          duration_minutes,
        };
        list[idx] = updated;
        writeBookings(list);
        return Promise.resolve({ updated: normalizeBooking(updated) });
      });
    },
    delete(id) {
      const list = readBookings();
      const idx = list.findIndex((b) => b.id === Number(id));
      if (idx === -1) return Promise.resolve(false);
      list.splice(idx, 1);
      writeBookings(list);
      return Promise.resolve(true);
    },

    /**
     * Atomically check for overlaps and insert all slots under global booking mutex.
     * Prevents two concurrent requests (POST or PATCH) from double-booking the same slot.
     * @param {number} eventTypeId
     * @param {{ start_time: string, end_time: string }[]} slots
     * @param {{ first_name: string, last_name: string, email: string, phone?: string, recurring_group_id?: string }} guest
     * @returns {Promise<{ created: object[] } | { conflict: true, conflictingStart: string }>}
     */
    async createBatchIfNoConflict(eventTypeId, slots, guest) {
      return withGlobalBookingMutex(() => {
        const list = readBookings();
        for (const slot of slots) {
          const start = slot.start_time.replace(' ', 'T');
          const end = slot.end_time.replace(' ', 'T');
          const found = list.find((b) => {
            const bStart = b.start_time.replace(' ', 'T');
            const bEnd = b.end_time.replace(' ', 'T');
            return start < bEnd && end > bStart;
          });
          if (found) return Promise.resolve({ conflict: true, conflictingStart: slot.start_time });
        }
        const created = [];
        for (const slot of slots) {
          const duration_minutes = slot.duration_minutes != null ? slot.duration_minutes : deriveDurationMinutes(slot.start_time, slot.end_time);
          const row = {
            id: bookingId++,
            event_type_id: eventTypeId,
            start_time: slot.start_time,
            end_time: slot.end_time,
            first_name: guest.first_name,
            last_name: guest.last_name,
            email: guest.email,
            phone: guest.phone || null,
            recurring_group_id: guest.recurring_group_id || null,
            notes: guest.notes ?? '',
            duration_minutes,
          };
          list.push(row);
          created.push(row);
        }
        writeBookings(list);
        return Promise.resolve({ created });
      });
    },
  },
};

module.exports = store;
