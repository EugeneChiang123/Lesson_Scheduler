/**
 * Add notification_template to event_types and phone to professionals.
 * Safe to run on existing DB (adds columns if missing).
 * Requires POSTGRES_URL or DATABASE_URL.
 * Usage: node server/db/migrate-add-notification-template-pg.js
 */
require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Set POSTGRES_URL or DATABASE_URL to run the migration.');
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query(`
      ALTER TABLE event_types
      ADD COLUMN IF NOT EXISTS notification_template TEXT
    `);
    console.log('[migrate] event_types.notification_template added (if missing).');

    await client.query(`
      ALTER TABLE professionals
      ADD COLUMN IF NOT EXISTS phone VARCHAR(255)
    `);
    console.log('[migrate] professionals.phone added (if missing).');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
