-- Migration 011 — Add list view config to forms
ALTER TABLE forms ADD COLUMN IF NOT EXISTS has_list_view BOOLEAN DEFAULT FALSE;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS list_columns  JSONB DEFAULT '[]';
-- list_columns stores [{field_key, label}, ...] — fields shown as columns in list view

SELECT 'Migration 011 complete.' AS result;
