/**
 * Postgres-backed data store. Same API as store (file-backed).
 * Used when POSTGRES_URL (or DATABASE_URL) is set.
 * All methods return Promises.
 */
const { sql } = require('@vercel/postgres');

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
  };
}

/** Map DB row to app booking (snake_case, formatted times) */
function toBooking(row) {
  if (!row) return null;
  return {
    id: row.id,
    event_type_id: row.event_type_id,
    start_time: formatTs(row.start_time),
    end_time: formatTs(row.end_time),
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone || null,
    recurring_group_id: row.recurring_group_id || null,
  };
}

const store = {
  clampRecurringCount,
  eventTypes: {
    async all() {
      const { rows } = await sql`SELECT * FROM event_types ORDER BY id`;
      return rows.map(toEventType);
    },
    async getById(id) {
      const { rows } = await sql`SELECT * FROM event_types WHERE id = ${Number(id)}`;
      return toEventType(rows[0] || null);
    },
    async getBySlug(slug) {
      const { rows } = await sql`SELECT * FROM event_types WHERE slug = ${slug}`;
      return toEventType(rows[0] || null);
    },
    async create(data) {
      const duration = data.durationMinutes ?? 30;
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('durationMinutes must be a positive number');
      const recurringCount = clampRecurringCount(data.recurringCount ?? 1);
      const availability = Array.isArray(data.availability) ? data.availability : [];
      const { rows: existing } = await sql`SELECT id FROM event_types WHERE slug = ${data.slug}`;
      if (existing.length > 0) throw new Error('Slug already exists');
      const { rows } = await sql`
        INSERT INTO event_types (slug, name, description, duration_minutes, allow_recurring, recurring_count, availability)
        VALUES (${data.slug}, ${data.name || ''}, ${data.description || ''}, ${duration}, ${Boolean(data.allowRecurring)}, ${recurringCount}, ${JSON.stringify(availability)}::jsonb)
        RETURNING *
      `;
      return toEventType(rows[0]);
    },
    async update(id, data) {
      const existing = await store.eventTypes.getById(id);
      if (!existing) return null;
      if (data.slug !== undefined) {
        const { rows: conflict } = await sql`SELECT id FROM event_types WHERE slug = ${data.slug} AND id != ${Number(id)}`;
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
      const { rows } = await sql`
        UPDATE event_types
        SET slug = ${slug}, name = ${name}, description = ${description}, duration_minutes = ${durationMinutes},
            allow_recurring = ${allowRecurring}, recurring_count = ${recurringCount}, availability = ${JSON.stringify(availability)}::jsonb
        WHERE id = ${Number(id)}
        RETURNING *
      `;
      return toEventType(rows[0]);
    },
  },
  bookings: {
    async list() {
      const { rows } = await sql`SELECT * FROM bookings ORDER BY start_time`;
      return rows.map(toBooking);
    },
    async getByEventTypeAndDate(eventTypeId, dateStr) {
      const prefix = dateStr.replace('T', ' ').substring(0, 10);
      const { rows } = await sql`
        SELECT * FROM bookings
        WHERE event_type_id = ${Number(eventTypeId)}
          AND (start_time::text LIKE ${prefix + '%'})
        ORDER BY start_time
      `;
      return rows.map(toBooking);
    },
    async getBookingsOnDate(dateStr) {
      const prefix = dateStr.replace('T', ' ').substring(0, 10);
      const { rows } = await sql`
        SELECT * FROM bookings
        WHERE start_time::text LIKE ${prefix + '%'}
        ORDER BY start_time
      `;
      return rows.map(toBooking);
    },
    async findOverlapping(startTime, endTime) {
      const start = startTime.replace(' ', 'T').substring(0, 19);
      const end = endTime.replace(' ', 'T').substring(0, 19);
      const { rows } = await sql`
        SELECT * FROM bookings
        WHERE start_time < ${end}::timestamptz AND end_time > ${start}::timestamptz
        LIMIT 1
      `;
      return rows[0] ? toBooking(rows[0]) : null;
    },
    async insert(record) {
      const { rows } = await sql`
        INSERT INTO bookings (event_type_id, start_time, end_time, first_name, last_name, email, phone, recurring_group_id)
        VALUES (
          ${record.event_type_id},
          ${record.start_time}::timestamptz,
          ${record.end_time}::timestamptz,
          ${record.first_name},
          ${record.last_name},
          ${record.email},
          ${record.phone || null},
          ${record.recurring_group_id || null}
        )
        RETURNING *
      `;
      return toBooking(rows[0]);
    },
  },
};

module.exports = store;
