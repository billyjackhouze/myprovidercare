-- =============================================================================
-- Migration 009 — Merge field_label → label in form_fields
-- The original table used field_label (NOT NULL); the ORM uses label.
-- Migration 008 added a new label column alongside it, causing NOT NULL errors.
-- This migration copies data across, drops the old column, and fixes the constraint.
-- =============================================================================

-- Copy existing field_label values into the new label column
UPDATE form_fields
SET label = field_label
WHERE label IS NULL AND field_label IS NOT NULL;

-- Drop the old column (it's now redundant)
ALTER TABLE form_fields DROP COLUMN IF EXISTS field_label;

-- Make sure label is NOT NULL going forward (backfill anything still null)
UPDATE form_fields SET label = field_key WHERE label IS NULL OR label = '';
ALTER TABLE form_fields ALTER COLUMN label SET NOT NULL;

-- Same check for form_sections — original may have used section_title
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='form_sections' AND column_name='section_title'
    ) THEN
        UPDATE form_sections SET title = section_title WHERE title IS NULL;
        ALTER TABLE form_sections DROP COLUMN IF EXISTS section_title;
    END IF;
END $$;

SELECT 'Migration 009 complete — field_label merged into label.' AS result;
