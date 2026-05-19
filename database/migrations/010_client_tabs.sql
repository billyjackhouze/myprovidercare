-- =============================================================================
-- Migration 010 — Per-client tab configuration
-- Each client gets their own tab list, seeded from org workflow_tabs defaults.
-- Staff can add, remove, and reorder tabs independently per client.
-- =============================================================================

CREATE TABLE IF NOT EXISTS client_tabs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tab_key        VARCHAR(100) NOT NULL,
    label          VARCHAR(100) NOT NULL,
    tab_type       VARCHAR(20) NOT NULL DEFAULT 'builtin'
                       CHECK (tab_type IN ('builtin', 'custom')),
    form_schema_id UUID,           -- points to forms.id for custom tabs
    sort_order     INTEGER NOT NULL DEFAULT 0,
    is_visible     BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, tab_key)
);

CREATE INDEX IF NOT EXISTS idx_client_tabs_client ON client_tabs(client_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_client_tabs_org    ON client_tabs(org_id);

SELECT 'Migration 010 complete — client_tabs table created.' AS result;
