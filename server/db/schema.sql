-- Lesson Scheduler: Postgres schema for event_types and bookings.
-- Run via: npm run db:migrate-pg (requires POSTGRES_URL).

CREATE TABLE IF NOT EXISTS event_types (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  allow_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_count INTEGER NOT NULL DEFAULT 1,
  availability JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_event_types_slug ON event_types(slug);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  event_type_id INTEGER NOT NULL REFERENCES event_types(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(255),
  recurring_group_id VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_bookings_event_type_id ON bookings(event_type_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
