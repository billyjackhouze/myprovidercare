-- =============================================================================
-- Migration 008 — Add missing columns to form_fields and form_sections
-- The original table creation omitted columns the ORM model expects
-- =============================================================================

-- ── form_fields missing columns ───────────────────────────────────────────────
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS label          VARCHAR(500);
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS placeholder    VARCHAR(500);
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS is_required    BOOLEAN DEFAULT FALSE;
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS options        JSONB DEFAULT '[]';
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS order_index    INTEGER DEFAULT 0;

-- Backfill label from field_key if null (shouldn't be any, but safety net)
UPDATE form_fields SET label = field_key WHERE label IS NULL;

-- ── Check if form_sections is also missing title ───────────────────────────────
ALTER TABLE form_sections ADD COLUMN IF NOT EXISTS title        VARCHAR(255);
ALTER TABLE form_sections ADD COLUMN IF NOT EXISTS order_index  INTEGER DEFAULT 0;
ALTER TABLE form_sections ADD COLUMN IF NOT EXISTS is_repeating BOOLEAN DEFAULT FALSE;

SELECT 'Migration 008 complete — form_fields and form_sections columns added.' AS result;
