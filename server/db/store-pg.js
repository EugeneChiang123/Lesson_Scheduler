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

/** Advisory lock key for serializing all booking writes (POST and PATCH) to prevent double-booking. */
const BOOKING_WRITE_LOCK_ID = 0x4c455353; // 'LESS' in hex

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
    professionalId: row.professional_id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    durationMinutes: row.duration_minutes,
    allowRecurring: Boolean(row.allow_recurring),
    recurringCount: row.recurring_count,
    availability: Array.isArray(row.availability) ? row.availability : (row.availability || []),
    location: row.location || '',
    timeZone: row.time_zone || 'America/Los_Angeles',
    priceDollars: row.price_dollars != null ? Number(row.price_dollars) : 0,
  };
}

/** Map DB row to app professional (camelCase) */
function toProfessional(row) {
  if (!row) return null;
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    email: row.email,
    fullName: row.full_name || '',
    profileSlug: row.profile_slug,
    timeZone: row.time_zone || 'America/Los_Angeles',
    createdAt: formatTs(row.created_at),
    updatedAt: formatTs(row.updated_at),
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
    client_id: row.client_id || null,
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

/** Sanitize clerk_user_id for use as default profile_slug (valid path segment) */
function sanitizeProfileSlug(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100) || 'user';
}

const store = {
  clampRecurringCount,
  professionals: {
    async getByClerkId(clerk_user_id) {
      const { rows } = await pool.query('SELECT * FROM professionals WHERE clerk_user_id = $1', [clerk_user_id]);
      return toProfessional(rows[0] || null);
    },
    async getById(id) {
      const { rows } = await pool.query('SELECT * FROM professionals WHERE id = $1', [Number(id)]);
      return toProfessional(rows[0] || null);
    },
    async getByProfileSlug(profile_slug) {
      const { rows } = await pool.query('SELECT * FROM professionals WHERE profile_slug = $1', [profile_slug]);
      return toProfessional(rows[0] || null);
    },
    async create(data) {
      const profile_slug = data.profile_slug || ('user_' + sanitizeProfileSlug(data.clerk_user_id));
      const { rows } = await pool.query(
        `INSERT INTO professionals (clerk_user_id, email, full_name, profile_slug, time_zone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          data.clerk_user_id,
          data.email || '',
          data.full_name != null ? data.full_name : '',
          profile_slug,
          data.time_zone || 'America/Los_Angeles',
        ]
      );
      return toProfessional(rows[0]);
    },
    async update(id, data) {
      const updates = [];
      const values = [];
      let n = 1;
      if (data.full_name !== undefined) {
        updates.push(`full_name = $${n++}`);
        values.push(data.full_name != null ? data.full_name : '');
      }
      if (data.profile_slug !== undefined) {
        updates.push(`profile_slug = $${n++}`);
        values.push(data.profile_slug);
      }
      if (data.time_zone !== undefined) {
        updates.push(`time_zone = $${n++}`);
        values.push(data.time_zone);
      }
      if (updates.length === 0) return store.professionals.getById(id);
      updates.push(`updated_at = now()`);
      values.push(Number(id));
      const { rows } = await pool.query(
        `UPDATE professionals SET ${updates.join(', ')} WHERE id = $${n} RETURNING *`,
        values
      );
      return toProfessional(rows[0] || null);
    },
  },
  slug_redirects: {
    async insert(data) {
      await pool.query(
        'INSERT INTO slug_redirects (old_slug, professional_id) VALUES ($1, $2)',
        [data.old_slug, Number(data.professional_id)]
      );
    },
  },
  eventTypes: {
    async all(professional_id) {
      if (professional_id != null) {
        const { rows } = await pool.query('SELECT * FROM event_types WHERE professional_id = $1 ORDER BY id', [Number(professional_id)]);
        return rows.map(toEventType);
      }
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
      if (data.professional_id == null) throw new Error('professional_id required');
      const duration = data.durationMinutes ?? 30;
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('durationMinutes must be a positive number');
      const recurringCount = clampRecurringCount(data.recurringCount ?? 1);
      const availability = Array.isArray(data.availability) ? data.availability : [];
      const { rows: existing } = await pool.query('SELECT id FROM event_types WHERE slug = $1', [data.slug]);
      if (existing.length > 0) throw new Error('Slug already exists');
      const location = (data.location != null && String(data.location)) || '';
      const time_zone = data.time_zone || data.timeZone || 'America/Los_Angeles';
      const price_dollars = data.price_dollars != null ? Number(data.price_dollars) : (data.priceDollars != null ? Number(data.priceDollars) : 0);
      const { rows } = await pool.query(
        `INSERT INTO event_types (professional_id, slug, name, description, duration_minutes, allow_recurring, recurring_count, availability, location, time_zone, price_dollars)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
         RETURNING *`,
        [Number(data.professional_id), data.slug, data.name || '', data.description || '', duration, Boolean(data.allowRecurring), recurringCount, JSON.stringify(availability), location, time_zone, price_dollars]
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
      const time_zone = data.time_zone !== undefined ? data.time_zone : (data.timeZone !== undefined ? data.timeZone : existing.timeZone);
      const price_dollars = data.price_dollars !== undefined ? Number(data.price_dollars) : (data.priceDollars !== undefined ? Number(data.priceDollars) : existing.priceDollars);
      const { rows } = await pool.query(
        `UPDATE event_types
         SET slug = $1, name = $2, description = $3, duration_minutes = $4, allow_recurring = $5, recurring_count = $6, availability = $7::jsonb, location = $8, time_zone = $9, price_dollars = $10
         WHERE id = $11
         RETURNING *`,
        [slug, name, description, durationMinutes, allowRecurring, recurringCount, JSON.stringify(availability), location, time_zone, price_dollars, Number(id)]
      );
      return toEventType(rows[0]);
    },
  },
  bookings: {
    async list(professional_id) {
      if (professional_id != null) {
        const { rows } = await pool.query(
          `SELECT b.* FROM bookings b
           JOIN event_types et ON et.id = b.event_type_id
           WHERE et.professional_id = $1
           ORDER BY b.start_time`,
          [Number(professional_id)]
        );
        return rows.map(toBooking);
      }
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
    async insert(record) {
      const duration_minutes = record.duration_minutes != null ? record.duration_minutes : deriveDurationMinutes(record.start_time, record.end_time);
      const { rows } = await pool.query(
        `INSERT INTO bookings (event_type_id, client_id, start_time, end_time, first_name, last_name, email, phone, recurring_group_id, notes, duration_minutes)
         VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          record.event_type_id,
          record.client_id != null ? Number(record.client_id) : null,
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
    /**
     * Atomically check for overlaps then update (in a transaction with advisory lock).
     * Prevents double-booking when a concurrent POST or PATCH could insert/move into the same slot.
     * @returns {Promise<{ updated: object } | { notFound: true } | { conflict: true, conflictingStart: string }>}
     */
    async updateIfNoConflict(id, data) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [BOOKING_WRITE_LOCK_ID]);
        const { rows: existingRows } = await client.query('SELECT * FROM bookings WHERE id = $1', [Number(id)]);
        if (existingRows.length === 0) {
          await client.query('ROLLBACK');
          return { notFound: true };
        }
        const existing = toBooking(existingRows[0]);
        const start_time = data.start_time !== undefined ? data.start_time : existing.start_time;
        const end_time = data.end_time !== undefined ? data.end_time : existing.end_time;
        const start = start_time.replace(' ', 'T').substring(0, 19);
        const end = end_time.replace(' ', 'T').substring(0, 19);
        const { rows: overlapping } = await client.query(
          'SELECT * FROM bookings WHERE id != $1 AND start_time < $2::timestamptz AND end_time > $3::timestamptz LIMIT 1',
          [Number(id), end, start]
        );
        if (overlapping.length > 0) {
          await client.query('ROLLBACK');
          return { conflict: true, conflictingStart: formatTs(overlapping[0].start_time) };
        }
        const first_name = data.first_name !== undefined ? data.first_name : existing.first_name;
        const last_name = data.last_name !== undefined ? data.last_name : existing.last_name;
        const email = data.email !== undefined ? data.email : existing.email;
        const phone = data.phone !== undefined ? data.phone : existing.phone;
        const notes = data.notes !== undefined ? data.notes : existing.notes;
        const duration_minutes = data.duration_minutes !== undefined ? data.duration_minutes : existing.duration_minutes;
        await client.query(
          `UPDATE bookings
           SET first_name = $1, last_name = $2, email = $3, phone = $4, start_time = $5::timestamptz, end_time = $6::timestamptz, notes = $7, duration_minutes = $8
           WHERE id = $9`,
          [first_name, last_name, email, phone || null, start_time, end_time, notes || '', duration_minutes, Number(id)]
        );
        await client.query('COMMIT');
        const updated = await store.bookings.getById(id);
        return { updated };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    async delete(id) {
      const { rowCount } = await pool.query('DELETE FROM bookings WHERE id = $1', [Number(id)]);
      return rowCount > 0;
    },

    /**
     * Atomically check for overlaps and insert all slots under a transaction with advisory lock.
     * Prevents two concurrent requests (POST or PATCH) from double-booking the same slot.
     * @param {number} eventTypeId
     * @param {{ start_time: string, end_time: string }[]} slots
     * @param {{ first_name: string, last_name: string, email: string, phone?: string, recurring_group_id?: string }} guest
     * @returns {{ created: object[] } | { conflict: true, conflictingStart: string }}
     */
    async createBatchIfNoConflict(eventTypeId, slots, guest) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [BOOKING_WRITE_LOCK_ID]);
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
        const client_id = guest.client_id != null ? Number(guest.client_id) : null;
        const created = [];
        for (const slot of slots) {
          const duration_minutes = slot.duration_minutes != null ? slot.duration_minutes : deriveDurationMinutes(slot.start_time, slot.end_time);
          const { rows } = await client.query(
            `INSERT INTO bookings (event_type_id, client_id, start_time, end_time, first_name, last_name, email, phone, recurring_group_id, notes, duration_minutes)
             VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
              eventTypeId,
              client_id,
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
