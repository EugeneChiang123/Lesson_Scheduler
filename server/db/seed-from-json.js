/**
 * One-time seed: copy event_types and bookings from server/db/*.json into Postgres.
 * Requires POSTGRES_URL or DATABASE_URL. Run after db:migrate-pg.
 * Usage: npm run db:seed-pg
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const dataDir = path.join(__dirname);
const eventTypesPath = path.join(dataDir, 'event_types.json');
const bookingsPath = path.join(dataDir, 'bookings.json');

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function run() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Set POSTGRES_URL or DATABASE_URL to run the seed.');
    process.exit(1);
  }

  const eventTypes = loadJson(eventTypesPath);
  const bookings = loadJson(bookingsPath);

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    for (const et of eventTypes) {
      await client.query(
        `INSERT INTO event_types (id, slug, name, description, duration_minutes, allow_recurring, recurring_count, availability)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [
          et.id,
          et.slug,
          et.name,
          et.description || '',
          et.durationMinutes ?? 30,
          Boolean(et.allowRecurring),
          et.recurringCount ?? 1,
          JSON.stringify(et.availability || []),
        ]
      );
    }

    for (const b of bookings) {
      await client.query(
        `INSERT INTO bookings (event_type_id, start_time, end_time, first_name, last_name, email, phone, recurring_group_id)
         VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, $7, $8)`,
        [
          b.event_type_id,
          (b.start_time || '').replace('T', ' ').substring(0, 19),
          (b.end_time || '').replace('T', ' ').substring(0, 19),
          b.first_name,
          b.last_name,
          b.email,
          b.phone || null,
          b.recurring_group_id || null,
        ]
      );
    }

    console.log(`Seeded ${eventTypes.length} event types and ${bookings.length} bookings.`);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
