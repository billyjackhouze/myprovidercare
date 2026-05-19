-- Migration 013: Form Workflow Automation
-- Enables per-form trigger → condition → action rules

-- ── Form Automation Rules ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_automation_rules (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    form_id      UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    name         VARCHAR(200) NOT NULL,
    description  TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,

    -- Trigger: when does this rule fire?
    -- Values: 'on_submit' | 'field_change'
    trigger_type VARCHAR(50) NOT NULL DEFAULT 'on_submit',
    -- For field_change trigger: which field key triggers it
    trigger_field_key VARCHAR(100),

    -- Conditions (JSON array): evaluated before actions run
    -- Each condition: { field_key, operator, value }
    -- Operators: eq, neq, gt, lt, contains, is_filled, is_empty
    conditions   JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Actions (ordered JSON array): executed in sequence
    -- Each action: { type, config }
    -- Types: notify_user, send_email, create_task, set_field_value, webhook
    actions      JSONB NOT NULL DEFAULT '[]'::jsonb,

    order_index  INTEGER NOT NULL DEFAULT 0,
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_automation_rules_org ON form_automation_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_form_automation_rules_form ON form_automation_rules(form_id);

-- ── Automation Run Log ────────────────────────────────────────────────────────
-- Records each time a rule executes (for audit/debugging)
CREATE TABLE IF NOT EXISTS form_automation_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rule_id      UUID REFERENCES form_automation_rules(id) ON DELETE SET NULL,
    form_id      UUID REFERENCES forms(id) ON DELETE SET NULL,
    client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'success',  -- success | failed | skipped
    actions_run  JSONB NOT NULL DEFAULT '[]'::jsonb,      -- which actions fired + results
    error_msg    TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_automation_logs_org  ON form_automation_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_form_automation_logs_rule ON form_automation_logs(rule_id);
