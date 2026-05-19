-- Migration 012 — Smart Fields
-- Org-level rules that surface form data on the General Info tab
CREATE TABLE IF NOT EXISTS org_smart_fields (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    label          VARCHAR(100) NOT NULL,
    source_form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
    source_field_key VARCHAR(100) NOT NULL,
    aggregation    VARCHAR(20)  NOT NULL DEFAULT 'latest',
    -- latest | sum | count | max | min
    display_format VARCHAR(20)  NOT NULL DEFAULT 'auto',
    -- auto | date | number | text | currency
    order_index    INTEGER      NOT NULL DEFAULT 0,
    is_active      BOOLEAN      DEFAULT TRUE,
    nl_description TEXT,        -- original plain-language rule
    created_at     TIMESTAMPTZ  DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_smart_fields_org ON org_smart_fields(org_id, order_index);

SELECT 'Migration 012 complete — org_smart_fields table created.' AS result;
