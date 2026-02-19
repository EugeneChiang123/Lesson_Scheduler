-- MVP schema: professionals, clients, slug_redirects, event_types, bookings.
-- Run via: npm run db:migrate-mvp (drops existing tables and recreates; wipe and start fresh).

-- Drop in reverse dependency order
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS event_types;
DROP TABLE IF EXISTS slug_redirects;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS professionals;

-- Professionals (Clerk auth; no password in our DB)
CREATE TABLE professionals (
  id SERIAL PRIMARY KEY,
  clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL DEFAULT '',
  profile_slug VARCHAR(255) UNIQUE NOT NULL,
  time_zone VARCHAR(63) NOT NULL DEFAULT 'America/Los_Angeles',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_professionals_clerk_user_id ON professionals(clerk_user_id);
CREATE INDEX idx_professionals_profile_slug ON professionals(profile_slug);

-- Clients (guests who book; unique by email + first_name + last_name)
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  phone VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email, first_name, last_name)
);

CREATE INDEX idx_clients_email ON clients(email);

-- Slug redirects when professional changes profile_slug (301 old -> current)
CREATE TABLE slug_redirects (
  id SERIAL PRIMARY KEY,
  old_slug VARCHAR(255) UNIQUE NOT NULL,
  professional_id INTEGER NOT NULL REFERENCES professionals(id) ON DELETE CASCADE
);

CREATE INDEX idx_slug_redirects_old_slug ON slug_redirects(old_slug);

-- Event types (owned by professional; slug globally unique for /book/:eventTypeSlug)
CREATE TABLE event_types (
  id SERIAL PRIMARY KEY,
  professional_id INTEGER NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  allow_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_count INTEGER NOT NULL DEFAULT 1,
  availability JSONB NOT NULL DEFAULT '[]',
  location VARCHAR(512),
  time_zone VARCHAR(63) NOT NULL DEFAULT 'America/Los_Angeles',
  price_dollars DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_types_professional_id ON event_types(professional_id);
CREATE INDEX idx_event_types_slug ON event_types(slug);

-- Bookings (linked to event_type and optional client)
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  event_type_id INTEGER NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(255),
  recurring_group_id VARCHAR(255),
  notes TEXT,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_event_type_id ON bookings(event_type_id);
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
CREATE INDEX idx_bookings_client_id ON bookings(client_id);
