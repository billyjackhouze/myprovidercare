-- =============================================================================
-- Migration 003 — Workflow Engine: custom tabs, form responses
-- Run: psql -U myprovidercare -d myprovidercare -f 003_workflow_engine.sql
-- =============================================================================

-- =============================================================================
--  WORKFLOW TABS  (per-org ordered list of client record sidebar tabs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workflow_tabs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tab_key         VARCHAR(100) NOT NULL,   -- 'general', 'intake', or UUID for custom
    label           VARCHAR(100) NOT NULL,
    tab_type        VARCHAR(20) NOT NULL DEFAULT 'builtin'
                        CHECK (tab_type IN ('builtin', 'custom')),
    form_schema_id  UUID,                   -- FK to form_schemas if custom
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_visible      BOOLEAN DEFAULT TRUE,
    is_locked       BOOLEAN DEFAULT FALSE,  -- prevent hiding (e.g. General Info)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, tab_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_tabs_org ON workflow_tabs(org_id, is_visible, sort_order);

-- =============================================================================
--  FORM SCHEMAS  (AI-extracted or manually built form definitions)
-- =============================================================================
-- Note: this table may already exist from Forms Engine migration.
-- We add workflow-related columns if missing.
ALTER TABLE form_schemas ADD COLUMN IF NOT EXISTS workflow_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE form_schemas ADD COLUMN IF NOT EXISTS workflow_tab_label VARCHAR(100);
ALTER TABLE form_schemas ADD COLUMN IF NOT EXISTS allow_multiple_responses BOOLEAN DEFAULT FALSE;

-- =============================================================================
--  CLIENT FORM RESPONSES  (per-client filled-in form data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS client_form_responses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    form_schema_id  UUID NOT NULL,
    response_data   JSONB NOT NULL DEFAULT '{}',  -- field_key -> value
    version         INTEGER NOT NULL DEFAULT 1,
    status          VARCHAR(50) DEFAULT 'draft'
                        CHECK (status IN ('draft', 'complete', 'signed')),
    completed_at    TIMESTAMPTZ,
    signed_by       UUID REFERENCES users(id),
    signed_at       TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_responses_client ON client_form_responses(client_id, form_schema_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_org ON client_form_responses(org_id, form_schema_id);

-- =============================================================================
--  Seed default built-in tabs for all existing orgs
-- =============================================================================
INSERT INTO workflow_tabs (org_id, tab_key, label, tab_type, sort_order, is_visible, is_locked)
SELECT
    o.id,
    v.tab_key,
    v.label,
    'builtin',
    v.sort_order,
    TRUE,
    v.is_locked
FROM organizations o
CROSS JOIN (VALUES
    ('general',      'General Info',       1,  TRUE),
    ('intake',       'Intake',             2,  FALSE),
    ('referral',     'Referral',           3,  FALSE),
    ('hospital',     'Hospital Discharge', 4,  FALSE),
    ('auths',        'Auths',              5,  FALSE),
    ('superbill',    'Super Bill',         6,  FALSE),
    ('therapy',      'Therapy Note',       7,  FALSE),
    ('ansa',         'ANSA',               8,  FALSE),
    ('treatment',    'Treatment Plan',     9,  FALSE),
    ('bio',          'BIO',                10, FALSE),
    ('nursing',      'Nursing',            11, FALSE),
    ('risk',         'Risk Screening',     12, FALSE),
    ('notes',        'Progress Notes',     13, FALSE),
    ('appts',        'Appointments',       14, FALSE),
    ('attachments',  'Attachments',        15, FALSE),
    ('discharge',    'Discharge',          16, FALSE),
    ('contacts',     'Contact Notes',      17, FALSE)
) AS v(tab_key, label, sort_order, is_locked)
ON CONFLICT (org_id, tab_key) DO NOTHING;

SELECT 'Migration 003 complete' AS result;
