-- 004_intake_visits.sql
-- Biopsychosocial Assessment / Intake Visit log

CREATE TABLE IF NOT EXISTS client_intake_visits (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

    visit_date          DATE         NOT NULL DEFAULT CURRENT_DATE,
    case_manager        VARCHAR(200),
    visit_start         TIME,
    visit_end           TIME,
    status              VARCHAR(20)  NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','complete','signed')),

    assessor_name        VARCHAR(200),
    assessor_credentials VARCHAR(100),

    -- Full 23-page Biopsychosocial Assessment stored as JSONB
    form_data            JSONB NOT NULL DEFAULT '{}',

    signed_by   VARCHAR(200),
    signed_at   TIMESTAMP WITH TIME ZONE,

    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_visits_client ON client_intake_visits(client_id);
CREATE INDEX IF NOT EXISTS idx_intake_visits_org    ON client_intake_visits(org_id);
CREATE INDEX IF NOT EXISTS idx_intake_visits_date   ON client_intake_visits(visit_date DESC);
