-- Migration 015: PDF Export flag on forms
-- Allows per-form opt-in of the Print / Save as PDF feature.

ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS has_pdf_export BOOLEAN NOT NULL DEFAULT false;
