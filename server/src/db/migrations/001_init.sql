-- =====================================================================
-- CivicFix — Baseline schema (idempotent)
-- PostgreSQL 17 + PostGIS. Safe to run repeatedly.
-- =====================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE node_status AS ENUM ('ACTIVE', 'CONTESTED', 'NEEDS_VERIFICATION', 'RESOLVED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_action AS ENUM ('INITIAL_REPORT', 'CONFIRM_FIXED', 'FLAG_SPAM', 'STILL_EXISTS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE region_type AS ENUM ('CITY', 'WARD', 'LOCALITY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE otp_purpose AS ENUM ('CITIZEN_SIGNUP', 'ADMIN_SIGNUP', 'ADMIN_SIGNUP_SUPER', 'PASSWORD_RESET', 'ADMIN_EDIT', 'USER_DELETE', 'ADMIN_DELETE', 'ADMIN_DELETE_SUPER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- regions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             varchar(100) NOT NULL,
  parent_region_id uuid REFERENCES regions(id) ON DELETE CASCADE,
  type             region_type NOT NULL,
  boundary         geometry(MultiPolygon, 4326) NOT NULL,
  created_at       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_regions_boundary ON regions USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_regions_parent ON regions (parent_region_id);

-- Audit fix H-2: enforce name uniqueness so `ON CONFLICT (name)` upserts are safe.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'regions_name_unique'
  ) THEN
    ALTER TABLE regions ADD CONSTRAINT regions_name_unique UNIQUE (name);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash    varchar(64) NOT NULL,
  password_hash varchar(255),
  role          user_role NOT NULL DEFAULT 'USER',
  status        account_status NOT NULL DEFAULT 'ACTIVE',
  region_id     uuid REFERENCES regions(id) ON DELETE SET NULL,
  name          varchar(100),
  address       text,
  phone_number  varchar(20),
  created_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_hash_key ON users (email_hash);

-- ---------------------------------------------------------------------
-- issue_nodes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_nodes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  h3_index            varchar(15) NOT NULL,
  coordinates         geometry(Point, 4326) NOT NULL,
  title               varchar(100) NOT NULL,
  description         text,
  category            varchar(50) NOT NULL,
  density_score       integer NOT NULL DEFAULT 1,
  likes_count         integer NOT NULL DEFAULT 0,
  flag_count          integer NOT NULL DEFAULT 0,
  status              node_status NOT NULL DEFAULT 'ACTIVE',
  region_id           uuid REFERENCES regions(id) ON DELETE SET NULL,
  resolution_deadline timestamp,
  contested_at        timestamp,
  last_escalated_at   timestamp,
  escalation_count    integer NOT NULL DEFAULT 0,
  created_at          timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issue_nodes_h3      ON issue_nodes (h3_index);
CREATE INDEX IF NOT EXISTS idx_issue_nodes_coords  ON issue_nodes USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS idx_issue_nodes_region  ON issue_nodes (region_id);
CREATE INDEX IF NOT EXISTS idx_issue_nodes_region_h3     ON issue_nodes (region_id, h3_index, category, status);
CREATE INDEX IF NOT EXISTS idx_issue_nodes_region_status ON issue_nodes (region_id, status, density_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_nodes_status  ON issue_nodes (status);

-- ---------------------------------------------------------------------
-- issue_reports  (immutable action log; the source of truth for consensus)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_node_id uuid NOT NULL REFERENCES issue_nodes(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type   user_action NOT NULL,
  image_url     text,
  created_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issue_reports_node ON issue_reports (issue_node_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_user ON issue_reports (user_id);

-- Email-bound, one action of each type per (user, node): prevents Sybil-style double voting.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_action_per_node'
  ) THEN
    ALTER TABLE issue_reports
      ADD CONSTRAINT unique_user_action_per_node UNIQUE (user_id, issue_node_id, action_type);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- issue_comments
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_node_id uuid NOT NULL REFERENCES issue_nodes(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       text NOT NULL,
  created_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issue_comments_node ON issue_comments (issue_node_id);

-- ---------------------------------------------------------------------
-- issue_likes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_likes (
  issue_node_id uuid NOT NULL REFERENCES issue_nodes(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (issue_node_id, user_id)
);

-- ---------------------------------------------------------------------
-- otp_codes  (persisted OTP store — survives restarts, horizontally safe)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash varchar(64) NOT NULL,
  purpose    otp_purpose NOT NULL,
  code_hash  varchar(64) NOT NULL,
  attempts   integer NOT NULL DEFAULT 0,
  consumed   boolean NOT NULL DEFAULT false,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_lookup  ON otp_codes (email_hash, purpose);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expiry  ON otp_codes (expires_at);
