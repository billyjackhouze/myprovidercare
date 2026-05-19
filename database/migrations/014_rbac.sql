-- Migration 014: Granular RBAC
-- Predefined permissions → role defaults → per-user overrides

-- ── Update VALID_ROLES (add developer and admin) ──────────────────────────────
-- No schema change needed — roles are stored as VARCHAR in users table.
-- The VALID_ROLES tuple in models/user.py will be updated in application code.

-- ── Permissions catalog ───────────────────────────────────────────────────────
-- Master list of all capabilities in the system.
CREATE TABLE IF NOT EXISTS permissions (
    key         VARCHAR(100) PRIMARY KEY,
    label       VARCHAR(200) NOT NULL,
    section     VARCHAR(100) NOT NULL,   -- e.g. 'Clients', 'Forms', 'Billing', 'Admin'
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0
);

-- Seed all permissions
INSERT INTO permissions (key, label, section, description, order_index) VALUES
  -- Dashboard
  ('view_dashboard',           'View Dashboard',           'Dashboard', 'Access the main dashboard', 10),

  -- Clients
  ('view_clients',             'View Clients',             'Clients',   'See the client list and profiles', 20),
  ('create_clients',           'Create Clients',           'Clients',   'Add new clients to the system', 21),
  ('edit_clients',             'Edit Clients',             'Clients',   'Modify client information', 22),
  ('delete_clients',           'Delete Clients',           'Clients',   'Remove clients (soft delete)', 23),
  ('view_client_forms',        'View Client Forms',        'Clients',   'See form data on client records', 24),
  ('fill_client_forms',        'Fill Client Forms',        'Clients',   'Submit form responses for clients', 25),

  -- Schedule
  ('view_schedule',            'View Schedule',            'Schedule',  'Access the scheduling calendar', 30),
  ('manage_schedule',          'Manage Schedule',          'Schedule',  'Create and modify visits/appointments', 31),

  -- Visits
  ('view_visits',              'View Visits',              'Visits',    'See all visits', 40),
  ('manage_visits',            'Manage Visits',            'Visits',    'Create, edit, delete visits', 41),

  -- Progress Notes
  ('view_notes',               'View Progress Notes',      'Notes',     'Read progress notes', 50),
  ('write_notes',              'Write Progress Notes',     'Notes',     'Create and edit progress notes', 51),
  ('sign_notes',               'Sign/Finalize Notes',      'Notes',     'Electronically sign notes', 52),

  -- Forms Engine
  ('view_forms',               'View Forms',               'Forms',     'See the forms list', 60),
  ('create_forms',             'Create / Ingest Forms',    'Forms',     'Upload PDFs and build new forms', 61),
  ('edit_forms',               'Edit Forms',               'Forms',     'Modify form fields and settings', 62),
  ('delete_forms',             'Delete Forms',             'Forms',     'Remove forms', 63),
  ('manage_form_automation',   'Manage Form Automation',   'Forms',     'Configure workflow rules on forms', 64),

  -- Claims
  ('view_claims',              'View Claims',              'Billing',   'Access claims list and detail', 70),
  ('create_claims',            'Submit Claims',            'Billing',   'Create and submit claims', 71),
  ('manage_claims',            'Manage Claims',            'Billing',   'Full claims management including voids', 72),

  -- Payroll
  ('view_payroll',             'View Payroll',             'Payroll',   'See payroll summaries', 80),
  ('manage_payroll',           'Process Payroll',          'Payroll',   'Run and manage payroll', 81),

  -- Map
  ('view_map',                 'View Live Map',            'Field',     'Access the live GPS map', 90),

  -- Audit
  ('view_audit',               'View Audit Log',           'Admin',    'Read the audit trail', 100),

  -- Settings
  ('view_settings',            'View Settings',            'Admin',    'Access the settings page', 110),
  ('manage_org_settings',      'Manage Org Settings',      'Admin',    'Edit organization profile', 111),
  ('manage_users',             'Manage Users',             'Admin',    'Invite, deactivate, and change user roles', 112),
  ('manage_roles',             'Manage Roles & Permissions','Admin',   'Configure what each role can do', 113),
  ('manage_workflow_settings', 'Manage Workflow Settings', 'Admin',    'Configure client record tabs and smart fields', 114),

  -- Developer-only
  ('developer_tools',          'Developer Tools',          'Developer','Access developer/debug utilities', 200)

ON CONFLICT (key) DO NOTHING;

-- ── Role defaults ─────────────────────────────────────────────────────────────
-- What permissions each predefined role gets by default.
CREATE TABLE IF NOT EXISTS role_permissions (
    role           VARCHAR(50)  NOT NULL,
    permission_key VARCHAR(100) NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
    granted        BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (role, permission_key)
);

-- Seed defaults for each role
-- developer: everything
INSERT INTO role_permissions (role, permission_key, granted)
SELECT 'developer', key, TRUE FROM permissions
ON CONFLICT DO NOTHING;

-- admin: everything except developer_tools
INSERT INTO role_permissions (role, permission_key, granted)
SELECT 'admin', key, TRUE FROM permissions WHERE key != 'developer_tools'
ON CONFLICT DO NOTHING;

-- owner: everything except developer_tools
INSERT INTO role_permissions (role, permission_key, granted)
SELECT 'owner', key, TRUE FROM permissions WHERE key != 'developer_tools'
ON CONFLICT DO NOTHING;

-- supervisor: most things, no manage_roles or developer_tools
INSERT INTO role_permissions (role, permission_key, granted)
SELECT 'supervisor', key, TRUE FROM permissions
WHERE key NOT IN ('developer_tools', 'manage_roles', 'manage_org_settings')
ON CONFLICT DO NOTHING;

-- case_manager: client work, forms, schedule, visits, notes
INSERT INTO role_permissions (role, permission_key, granted)
SELECT 'case_manager', key, TRUE FROM permissions
WHERE key IN (
  'view_dashboard', 'view_clients', 'edit_clients', 'view_client_forms', 'fill_client_forms',
  'view_schedule', 'view_visits', 'view_notes', 'write_notes',
  'view_forms', 'view_settings'
)
ON CONFLICT DO NOTHING;

-- billing: claims + payroll + basic
INSERT INTO role_permissions (role, permission_key, granted)
SELECT 'billing', key, TRUE FROM permissions
WHERE key IN (
  'view_dashboard', 'view_clients', 'view_client_forms',
  'view_claims', 'create_claims', 'manage_claims',
  'view_payroll', 'manage_payroll',
  'view_settings'
)
ON CONFLICT DO NOTHING;

-- intake: client creation and form filling
INSERT INTO role_permissions (role, permission_key, granted)
SELECT 'intake', key, TRUE FROM permissions
WHERE key IN (
  'view_dashboard', 'view_clients', 'create_clients', 'edit_clients',
  'view_client_forms', 'fill_client_forms',
  'view_forms', 'view_schedule', 'view_settings'
)
ON CONFLICT DO NOTHING;

-- auditor: read-only everywhere
INSERT INTO role_permissions (role, permission_key, granted)
SELECT 'auditor', key, TRUE FROM permissions
WHERE key IN (
  'view_dashboard', 'view_clients', 'view_client_forms',
  'view_schedule', 'view_visits', 'view_notes',
  'view_forms', 'view_claims', 'view_payroll',
  'view_map', 'view_audit', 'view_settings'
)
ON CONFLICT DO NOTHING;

-- staff: basic access
INSERT INTO role_permissions (role, permission_key, granted)
SELECT 'staff', key, TRUE FROM permissions
WHERE key IN (
  'view_dashboard', 'view_clients', 'view_client_forms', 'fill_client_forms',
  'view_schedule', 'view_visits', 'view_notes', 'write_notes'
)
ON CONFLICT DO NOTHING;

-- ── Per-user permission overrides ─────────────────────────────────────────────
-- state: 'granted' | 'denied' | NULL (inherit from role)
CREATE TABLE IF NOT EXISTS user_permissions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
    state          VARCHAR(10) NOT NULL DEFAULT 'granted',  -- 'granted' or 'denied'
    granted_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_org  ON user_permissions(org_id);

-- ── Grants for the tables ─────────────────────────────────────────────────────
GRANT ALL PRIVILEGES ON TABLE form_automation_rules    TO myprovidercare;
GRANT ALL PRIVILEGES ON TABLE form_automation_logs     TO myprovidercare;
GRANT ALL PRIVILEGES ON TABLE permissions              TO myprovidercare;
GRANT ALL PRIVILEGES ON TABLE role_permissions         TO myprovidercare;
GRANT ALL PRIVILEGES ON TABLE user_permissions         TO myprovidercare;
