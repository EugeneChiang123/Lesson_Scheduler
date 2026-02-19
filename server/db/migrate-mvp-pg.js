/**
 * Run MVP schema: professionals, clients, slug_redirects, event_types, bookings.
 * Wipes existing event_types and bookings (and new tables) and recreates.
 * Requires POSTGRES_URL or DATABASE_URL.
 * Usage: npm run db:migrate-mvp
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Set POSTGRES_URL or DATABASE_URL to run the migration.');
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, 'schema-mvp.sql');
  const fullSql = fs.readFileSync(schemaPath, 'utf8');
  const statements = fullSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    for (const statement of statements) {
      await client.query(statement + ';');
    }
    console.log('MVP Postgres migration complete: professionals, clients, slug_redirects, event_types, bookings.');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
