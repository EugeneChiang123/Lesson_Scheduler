/**
 * Postgres-backed data store. Same API as store (file-backed).
 * Used when POSTGRES_URL or DATABASE_URL is set.
 * Uses pg with the same URL so Neon (DATABASE_URL only) works without duplicating env.
 * All methods return Promises.
 */
const { Pool } = require('pg');

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

const MAX_RECURRING_COUNT = 52;

function clampRecurringCount(n) {
  const val = Number.isFinite(n) ? Math.round(Number(n)) : 1;
  return Math.min(MAX_RECURRING_COUNT, Math.max(1, val));
}

/** Format Date or string for app: "YYYY-MM-DD HH:mm:ss" */
function formatTs(val) {
  if (val == null) return null;
  if (typeof val === 'string') return val.substring(0, 19).replace('T', ' ');
  const d = val instanceof Date ? val : new Date(val);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** Map DB row to app event type (camelCase) */
function toEventType(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    durationMinutes: row.duration_minutes,
    allowRecurring: Boolean(row.allow_recurring),
    recurringCount: row.recurring_count,
    availability: Array.isArray(row.availability) ? row.availability : (row.availability || []),
    location: row.location || '',
  };
}

/** Derive duration in minutes from start/end when not stored */
function deriveDurationMinutes(startTime, endTime) {
  if (startTime == null || endTime == null) return 30;
  const start = startTime instanceof Date ? startTime : new Date(startTime);
  const end = endTime instanceof Date ? endTime : new Date(endTime);
  return Math.round((end - start) / 60000) || 30;
}

/** Map DB row to app booking (snake_case, formatted times) */
function toBooking(row) {
  if (!row) return null;
  const start_time = formatTs(row.start_time);
  const end_time = formatTs(row.end_time);
  const duration_minutes = row.duration_minutes != null ? row.duration_minutes : deriveDurationMinutes(row.start_time, row.end_time);
  return {
    id: row.id,
    event_type_id: row.event_type_id,
    start_time,
    end_time,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone || null,
    recurring_group_id: row.recurring_group_id || null,
    notes: row.notes || '',
    duration_minutes,
  };
}

const store = {
  clampRecurringCount,
  eventTypes: {
    async all() {
      const { rows } = await pool.query('SELECT * FROM event_types ORDER BY id');
      return rows.map(toEventType);
    },
    async getById(id) {
      const { rows } = await pool.query('SELECT * FROM event_types WHERE id = $1', [Number(id)]);
      return toEventType(rows[0] || null);
    },
    async getBySlug(slug) {
      const { rows } = await pool.query('SELECT * FROM event_types WHERE slug = $1', [slug]);
      return toEventType(rows[0] || null);
    },
    async create(data) {
      const duration = data.durationMinutes ?? 30;
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('durationMinutes must be a positive number');
      const recurringCount = clampRecurringCount(data.recurringCount ?? 1);
      const availability = Array.isArray(data.availability) ? data.availability : [];
      const { rows: existing } = await pool.query('SELECT id FROM event_types WHERE slug = $1', [data.slug]);
      if (existing.length > 0) throw new Error('Slug already exists');
      const location = (data.location != null && String(data.location)) || '';
      const { rows } = await pool.query(
        `INSERT INTO event_types (slug, name, description, duration_minutes, allow_recurring, recurring_count, availability, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
         RETURNING *`,
        [data.slug, data.name || '', data.description || '', duration, Boolean(data.allowRecurring), recurringCount, JSON.stringify(availability), location]
      );
      return toEventType(rows[0]);
    },
    async update(id, data) {
      const existing = await store.eventTypes.getById(id);
      if (!existing) return null;
      if (data.slug !== undefined) {
        const { rows: conflict } = await pool.query('SELECT id FROM event_types WHERE slug = $1 AND id != $2', [data.slug, Number(id)]);
        if (conflict.length > 0) throw new Error('Slug already exists');
      }
      const nextDuration = data.durationMinutes !== undefined ? data.durationMinutes : existing.durationMinutes;
      if (!Number.isFinite(nextDuration) || nextDuration <= 0) throw new Error('durationMinutes must be a positive number');
      const slug = data.slug !== undefined ? data.slug : existing.slug;
      const name = data.name !== undefined ? data.name : existing.name;
      const description = data.description !== undefined ? data.description : existing.description;
      const durationMinutes = nextDuration;
      const allowRecurring = data.allowRecurring !== undefined ? Boolean(data.allowRecurring) : existing.allowRecurring;
      const recurringCount = data.recurringCount !== undefined ? clampRecurringCount(data.recurringCount) : clampRecurringCount(existing.recurringCount);
      const availability = data.availability !== undefined ? data.availability : existing.availability;
      const location = data.location !== undefined ? (data.location != null && String(data.location)) || '' : (existing.location || '');
      const { rows } = await pool.query(
        `UPDATE event_types
         SET slug = $1, name = $2, description = $3, duration_minutes = $4, allow_recurring = $5, recurring_count = $6, availability = $7::jsonb, location = $8
         WHERE id = $9
         RETURNING *`,
        [slug, name, description, durationMinutes, allowRecurring, recurringCount, JSON.stringify(availability), location, Number(id)]
      );
      return toEventType(rows[0]);
    },
  },
  bookings: {
    async list() {
      const { rows } = await pool.query('SELECT * FROM bookings ORDER BY start_time');
      return rows.map(toBooking);
    },
    async getById(id) {
      const { rows } = await pool.query('SELECT * FROM bookings WHERE id = $1', [Number(id)]);
      return toBooking(rows[0] || null);
    },
    async getByEventTypeAndDate(eventTypeId, dateStr) {
      const prefix = dateStr.replace('T', ' ').substring(0, 10);
      const { rows } = await pool.query(
        `SELECT * FROM bookings
         WHERE event_type_id = $1 AND (start_time::text LIKE $2)
         ORDER BY start_time`,
        [Number(eventTypeId), prefix + '%']
      );
      return rows.map(toBooking);
    },
    async getBookingsOnDate(dateStr) {
      const prefix = dateStr.replace('T', ' ').substring(0, 10);
      const { rows } = await pool.query(
        `SELECT * FROM bookings WHERE start_time::text LIKE $1 ORDER BY start_time`,
        [prefix + '%']
      );
      return rows.map(toBooking);
    },
    async findOverlapping(startTime, endTime) {
      const start = startTime.replace(' ', 'T').substring(0, 19);
      const end = endTime.replace(' ', 'T').substring(0, 19);
      const { rows } = await pool.query(
        'SELECT * FROM bookings WHERE start_time < $1::timestamptz AND end_time > $2::timestamptz LIMIT 1',
        [end, start]
      );
      return rows[0] ? toBooking(rows[0]) : null;
    },
    async findOverlappingExcluding(bookingId, startTime, endTime) {
      const start = startTime.replace(' ', 'T').substring(0, 19);
      const end = endTime.replace(' ', 'T').substring(0, 19);
      const { rows } = await pool.query(
        'SELECT * FROM bookings WHERE id != $1 AND start_time < $2::timestamptz AND end_time > $3::timestamptz LIMIT 1',
        [Number(bookingId), end, start]
      );
      return rows[0] ? toBooking(rows[0]) : null;
    },
    async insert(record) {
      const duration_minutes = record.duration_minutes != null ? record.duration_minutes : deriveDurationMinutes(record.start_time, record.end_time);
      const { rows } = await pool.query(
        `INSERT INTO bookings (event_type_id, start_time, end_time, first_name, last_name, email, phone, recurring_group_id, notes, duration_minutes)
         VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          record.event_type_id,
          record.start_time,
          record.end_time,
          record.first_name,
          record.last_name,
          record.email,
          record.phone || null,
          record.recurring_group_id || null,
          record.notes || '',
          duration_minutes,
        ]
      );
      return toBooking(rows[0]);
    },
    async update(id, data) {
      const existing = await store.bookings.getById(id);
      if (!existing) return null;
      const first_name = data.first_name !== undefined ? data.first_name : existing.first_name;
      const last_name = data.last_name !== undefined ? data.last_name : existing.last_name;
      const email = data.email !== undefined ? data.email : existing.email;
      const phone = data.phone !== undefined ? data.phone : existing.phone;
      const start_time = data.start_time !== undefined ? data.start_time : existing.start_time;
      const end_time = data.end_time !== undefined ? data.end_time : existing.end_time;
      const notes = data.notes !== undefined ? data.notes : existing.notes;
      const duration_minutes = data.duration_minutes !== undefined ? data.duration_minutes : existing.duration_minutes;
      await pool.query(
        `UPDATE bookings
         SET first_name = $1, last_name = $2, email = $3, phone = $4, start_time = $5::timestamptz, end_time = $6::timestamptz, notes = $7, duration_minutes = $8
         WHERE id = $9`,
        [first_name, last_name, email, phone || null, start_time, end_time, notes || '', duration_minutes, Number(id)]
      );
      return store.bookings.getById(id);
    },
    async delete(id) {
      const { rowCount } = await pool.query('DELETE FROM bookings WHERE id = $1', [Number(id)]);
      return rowCount > 0;
    },

    /**
     * Atomically check for overlaps and insert all slots under a transaction with row lock.
     * Prevents two concurrent requests from double-booking the same slot.
     * @param {number} eventTypeId
     * @param {{ start_time: string, end_time: string }[]} slots
     * @param {{ first_name: string, last_name: string, email: string, phone?: string, recurring_group_id?: string }} guest
     * @returns {{ created: object[] } | { conflict: true, conflictingStart: string }}
     */
    async createBatchIfNoConflict(eventTypeId, slots, guest) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: locked } = await client.query('SELECT id FROM event_types WHERE id = $1 FOR UPDATE', [eventTypeId]);
        if (locked.length === 0) {
          await client.query('ROLLBACK');
          return { conflict: true, conflictingStart: null };
        }
        for (const slot of slots) {
          const start = slot.start_time.replace(' ', 'T').substring(0, 19);
          const end = slot.end_time.replace(' ', 'T').substring(0, 19);
          const { rows: overlapping } = await client.query(
            'SELECT id FROM bookings WHERE start_time < $1::timestamptz AND end_time > $2::timestamptz LIMIT 1',
            [end, start]
          );
          if (overlapping.length > 0) {
            await client.query('ROLLBACK');
            return { conflict: true, conflictingStart: slot.start_time };
          }
        }
        const created = [];
        for (const slot of slots) {
          const duration_minutes = slot.duration_minutes != null ? slot.duration_minutes : deriveDurationMinutes(slot.start_time, slot.end_time);
          const { rows } = await client.query(
            `INSERT INTO bookings (event_type_id, start_time, end_time, first_name, last_name, email, phone, recurring_group_id, notes, duration_minutes)
             VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
              eventTypeId,
              slot.start_time,
              slot.end_time,
              guest.first_name,
              guest.last_name,
              guest.email,
              guest.phone || null,
              guest.recurring_group_id || null,
              guest.notes || '',
              duration_minutes,
            ]
          );
          created.push(toBooking(rows[0]));
        }
        await client.query('COMMIT');
        return { created };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  },
};

module.exports = store;
