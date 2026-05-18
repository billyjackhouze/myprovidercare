-- =============================================================================
-- Migration 007 — Reconcile form_sections, form_fields, form_workflows,
--                 form_submissions with current ORM models
-- =============================================================================

-- ── form_sections ─────────────────────────────────────────────────────────────
ALTER TABLE form_sections ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE form_sections ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE form_sections ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE form_sections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill org_id from parent form
UPDATE form_sections fs
SET org_id = f.org_id
FROM forms f
WHERE fs.form_id = f.id AND fs.org_id IS NULL;

-- ── form_fields ───────────────────────────────────────────────────────────────
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS default_value TEXT;
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS validation JSONB DEFAULT '{}';
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS conditional JSONB;
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS system_field VARCHAR(100);
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS print_x NUMERIC(6,2);
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS print_y NUMERIC(6,2);
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS print_width NUMERIC(6,2);
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS print_height NUMERIC(6,2);
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,2);
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill org_id from parent form
UPDATE form_fields ff
SET org_id = f.org_id
FROM forms f
WHERE ff.form_id = f.id AND ff.org_id IS NULL;

-- ── form_workflows ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_workflows (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    form_id                     UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    name                        VARCHAR(255) NOT NULL,
    trigger_event               VARCHAR(100) NOT NULL,
    is_active                   BOOLEAN DEFAULT TRUE,
    requires_signature          BOOLEAN DEFAULT FALSE,
    requires_supervisor_review  BOOLEAN DEFAULT FALSE,
    auto_generate_pdf           BOOLEAN DEFAULT FALSE,
    routing_config              JSONB DEFAULT '{}',
    notification_config         JSONB DEFAULT '{}',
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ── form_submissions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_submissions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    form_id                     UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    visit_id                    UUID REFERENCES visits(id) ON DELETE SET NULL,
    client_id                   UUID REFERENCES clients(id) ON DELETE SET NULL,
    submitted_by                UUID REFERENCES users(id) ON DELETE SET NULL,
    data                        JSONB NOT NULL DEFAULT '{}',
    signatures                  JSONB DEFAULT '[]',
    submission_inside_geofence  BOOLEAN,
    submitted_at                TIMESTAMPTZ,
    status                      VARCHAR(50) DEFAULT 'draft',
    supervisor_reviewed         BOOLEAN DEFAULT FALSE,
    print_pdf_s3_key            VARCHAR(500),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

SELECT 'Migration 007 complete — form tables reconciled.' AS result;
