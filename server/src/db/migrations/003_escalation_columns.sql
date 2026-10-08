-- =====================================================================
-- CivicFix — DAG escalation columns on issue_nodes
-- (For databases where issue_nodes already existed before migration 001.)
-- =====================================================================

ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS contested_at      timestamp;
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS last_escalated_at timestamp;
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS escalation_count  integer NOT NULL DEFAULT 0;
