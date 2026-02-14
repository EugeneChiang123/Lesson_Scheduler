/**
 * Data store: file-backed (local / ephemeral on Vercel) or Postgres-backed (persistent).
 * When POSTGRES_URL or DATABASE_URL is set, use Postgres so data persists across serverless invocations.
 * Otherwise use JSON files (server/db/ locally, /tmp on Vercel — ephemeral there).
 * All store methods return Promises; routes should use async/await.
 */
const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const store = url ? require('./store-pg') : require('./store-file');
module.exports = store;
