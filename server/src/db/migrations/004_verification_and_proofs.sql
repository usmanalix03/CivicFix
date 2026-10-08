-- =====================================================================
-- CivicFix — verification workflow, multi-image proofs & email storage
-- =====================================================================

-- Multiple proof images per action (primary image remains image_url).
ALTER TABLE issue_reports ADD COLUMN IF NOT EXISTS proof_images text[] NOT NULL DEFAULT '{}';

-- Reversibly-encrypted email so the server can send notifications without
-- storing plaintext at rest (privacy-preserving).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_encrypted text;

-- Marks when the latest authority "Fixed" verification window opened, so
-- verification votes are scoped to the current cycle.
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS verification_started_at timestamp;
