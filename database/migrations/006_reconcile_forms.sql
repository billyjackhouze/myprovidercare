-- =============================================================================
-- Migration 006 — Reconcile forms table with ORM model
-- Adds columns that exist in the model but were missing from 003_workflow_engine
-- =============================================================================

ALTER TABLE forms ADD COLUMN IF NOT EXISTS source_file_s3_key    VARCHAR(500);
ALTER TABLE forms ADD COLUMN IF NOT EXISTS print_template_s3_key VARCHAR(500);
ALTER TABLE forms ADD COLUMN IF NOT EXISTS workflow_config        JSONB DEFAULT '{}';
ALTER TABLE forms ADD COLUMN IF NOT EXISTS is_system              BOOLEAN DEFAULT FALSE;

SELECT 'Migration 006 complete — forms table reconciled.' AS result;
