-- =============================================================================
-- NationalCM — Initial Database Schema
-- PostgreSQL 15+  |  PostGIS required for geospatial queries
-- Run once on a fresh database:
--   psql -U postgres -d nationalcm -f 001_initial_schema.sql
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- fuzzy text search (note similarity)

-- =============================================================================
--  ORGANIZATIONS  (multi-tenant SaaS root)
-- =============================================================================
CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,  -- URL-safe identifier
    address         TEXT,
    phone           VARCHAR(20),
    email           VARCHAR(255),
    logo_s3_key     VARCHAR(500),
    settings        JSONB DEFAULT '{}',            -- org-level config (geofence defaults, pay policy, etc.)
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
--  USERS & ROLES
-- =============================================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    phone           VARCHAR(20),
    role            VARCHAR(50) NOT NULL CHECK (role IN (
                        'owner','supervisor','case_manager',
                        'billing','intake','auditor')),
    employee_id     VARCHAR(100),               -- for ADP mapping
    adp_associate_id VARCHAR(100),              -- ADP Workforce Now associate OID
    is_active       BOOLEAN DEFAULT true,
    mfa_enabled     BOOLEAN DEFAULT false,
    mfa_secret      VARCHAR(255),
    last_login_at   TIMESTAMPTZ,
    avatar_s3_key   VARCHAR(500),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, email)
);

CREATE TABLE user_devices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id       VARCHAR(255) NOT NULL,      -- fingerprint from app
    device_name     VARCHAR(255),
    platform        VARCHAR(50),                -- 'ios','android','web'
    push_token      VARCHAR(500),              -- for push notifications
    registered_at   TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT true,
    UNIQUE(device_id)
);

-- =============================================================================
--  CLIENTS
-- =============================================================================
CREATE TABLE clients (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    date_of_birth   DATE,
    medicaid_id     VARCHAR(100),
    insurance_id    VARCHAR(100),
    payer_name      VARCHAR(255),
    -- primary address & geofence anchor
    address_line1   VARCHAR(255),
    address_line2   VARCHAR(255),
    city            VARCHAR(100),
    state           VARCHAR(2),
    zip             VARCHAR(10),
    geo_point       GEOMETRY(Point, 4326),      -- PostGIS point (lng, lat)
    geofence_radius_ft  INTEGER DEFAULT 300,
    -- contact
    phone           VARCHAR(20),
    email           VARCHAR(255),
    emergency_contact_name  VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    -- clinical
    diagnosis_codes JSONB DEFAULT '[]',         -- [{code:"F32.1", description:"..."}]
    risk_flags      JSONB DEFAULT '[]',         -- [{type:"safety", note:"..."}]
    -- assignment
    primary_cm_id   UUID REFERENCES users(id),
    backup_cm_id    UUID REFERENCES users(id),
    supervisor_id   UUID REFERENCES users(id),
    -- status
    status          VARCHAR(50) DEFAULT 'active' CHECK (status IN (
                        'active','inactive','discharged','on_hold','pending')),
    intake_date     DATE,
    discharge_date  DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE client_locations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    location_name   VARCHAR(255) NOT NULL,      -- e.g. "Home","School","Day Program"
    location_type   VARCHAR(50) DEFAULT 'other',
    address_line1   VARCHAR(255),
    city            VARCHAR(100),
    state           VARCHAR(2),
    zip             VARCHAR(10),
    geo_point       GEOMETRY(Point, 4326),
    geofence_radius_ft INTEGER DEFAULT 300,
    is_primary      BOOLEAN DEFAULT false,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
--  AUTHORIZATIONS
-- =============================================================================
CREATE TABLE authorizations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    auth_number     VARCHAR(100),
    service_code    VARCHAR(50),                -- e.g. H2015, T1017
    service_description VARCHAR(255),
    payer_name      VARCHAR(255),
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    units_authorized INTEGER NOT NULL DEFAULT 0,
    units_used      INTEGER NOT NULL DEFAULT 0,
    units_remaining INTEGER GENERATED ALWAYS AS (units_authorized - units_used) STORED,
    status          VARCHAR(50) DEFAULT 'active' CHECK (status IN (
                        'pending','active','approved','denied','expired','exhausted')),
    preauthpro_id   VARCHAR(100),              -- link to PreAuthPro record
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
--  SCHEDULES & VISITS
-- =============================================================================
CREATE TABLE scheduled_visits (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    client_id       UUID NOT NULL REFERENCES clients(id),
    cm_id           UUID NOT NULL REFERENCES users(id),
    auth_id         UUID REFERENCES authorizations(id),
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end   TIMESTAMPTZ,
    service_code    VARCHAR(50),
    location_id     UUID REFERENCES client_locations(id),
    is_recurring    BOOLEAN DEFAULT false,
    recurrence_rule JSONB,                     -- {freq:'weekly', days:['TU','TH']}
    status          VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN (
                        'scheduled','in_progress','completed','missed',
                        'cancelled','rescheduled')),
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE visits (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id                  UUID NOT NULL REFERENCES organizations(id),
    scheduled_visit_id      UUID REFERENCES scheduled_visits(id),
    client_id               UUID NOT NULL REFERENCES clients(id),
    cm_id                   UUID NOT NULL REFERENCES users(id),
    auth_id                 UUID REFERENCES authorizations(id),
    service_code            VARCHAR(50),
    -- PHASE 1: arrival
    arrived_at              TIMESTAMPTZ,
    arrived_gps             GEOMETRY(Point,4326),
    arrived_inside_geofence BOOLEAN,
    -- PHASE 2: visit start (HIPAA signature)
    hipaa_signed_at         TIMESTAMPTZ,       -- ★ CLOCK START
    hipaa_gps               GEOMETRY(Point,4326),
    hipaa_inside_geofence   BOOLEAN,
    hipaa_signature_s3_key  VARCHAR(500),
    hipaa_on_file           BOOLEAN DEFAULT false,
    hipaa_on_file_date      DATE,
    -- PHASE 3: visit end (camera photo)
    photo_taken_at          TIMESTAMPTZ,       -- ★ CLOCK STOP
    photo_gps               GEOMETRY(Point,4326),
    photo_inside_geofence   BOOLEAN,
    photo_s3_key            VARCHAR(500),
    photo_exif_metadata     JSONB,
    photo_tamper_flag       BOOLEAN DEFAULT false,
    -- computed face-to-face time (minutes)
    face_to_face_minutes    INTEGER GENERATED ALWAYS AS (
        CASE WHEN hipaa_signed_at IS NOT NULL AND photo_taken_at IS NOT NULL
             THEN EXTRACT(EPOCH FROM (photo_taken_at - hipaa_signed_at))::INTEGER / 60
             ELSE NULL END
    ) STORED,
    -- geofence exit / task tracking
    geofence_exit_at        TIMESTAMPTZ,
    geofence_exit_gps       GEOMETRY(Point,4326),
    outside_geofence_reason TEXT,
    -- status & flags
    status                  VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN (
                                'scheduled','traveling','arrived','active',
                                'note_in_progress','office_mode','awaiting_review',
                                'approved','flagged','cancelled')),
    is_flagged              BOOLEAN DEFAULT false,
    flag_reasons            JSONB DEFAULT '[]', -- [{code:"GEO_EXIT",detail:"..."}]
    -- billing
    billing_status          VARCHAR(50) DEFAULT 'pending',
    claim_id                VARCHAR(100),
    -- audit
    supervisor_id           UUID REFERENCES users(id),
    supervisor_reviewed_at  TIMESTAMPTZ,
    supervisor_notes        TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE visit_tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visit_id        UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    task_type       VARCHAR(100) CHECK (task_type IN (
                        'transport','errand','collateral_contact',
                        'appointment_escort','community_resource','other')),
    description     TEXT NOT NULL,
    destination     VARCHAR(500),
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ,
    start_gps       GEOMETRY(Point,4326),
    end_gps         GEOMETRY(Point,4326),
    distance_miles  NUMERIC(8,2),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
--  GPS / DEVICE TRACKING  (partitioned by day for performance)
-- =============================================================================
CREATE TABLE device_pings (
    id              UUID DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL,
    cm_id           UUID NOT NULL,
    visit_id        UUID,                      -- NULL when not on active visit
    pinged_at       TIMESTAMPTZ NOT NULL,
    lat             NUMERIC(10,7) NOT NULL,
    lng             NUMERIC(10,7) NOT NULL,
    accuracy_m      NUMERIC(8,2),
    speed_ms        NUMERIC(8,2),
    heading         NUMERIC(6,2),
    battery_pct     INTEGER,
    app_state       VARCHAR(20),               -- 'foreground','background'
    PRIMARY KEY (id, pinged_at)
) PARTITION BY RANGE (pinged_at);

-- Create rolling partitions (add more monthly)
CREATE TABLE device_pings_2026_05 PARTITION OF device_pings
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE device_pings_2026_06 PARTITION OF device_pings
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE device_pings_2026_07 PARTITION OF device_pings
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE device_pings_2026_08 PARTITION OF device_pings
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE device_pings_2026_09 PARTITION OF device_pings
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE device_pings_2026_10 PARTITION OF device_pings
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE device_pings_2026_11 PARTITION OF device_pings
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE device_pings_2026_12 PARTITION OF device_pings
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE device_pings_2027_01 PARTITION OF device_pings
    FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

-- =============================================================================
--  PROGRESS NOTES
-- =============================================================================
CREATE TABLE progress_notes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visit_id        UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    org_id          UUID NOT NULL REFERENCES organizations(id),
    cm_id           UUID NOT NULL REFERENCES users(id),
    client_id       UUID NOT NULL REFERENCES clients(id),
    note_format     VARCHAR(20) DEFAULT 'soap' CHECK (note_format IN ('soap','birp','dap','narrative')),
    -- SOAP sections (stored individually for AI analysis)
    section_s       TEXT,   -- Subjective
    section_o       TEXT,   -- Objective
    section_a       TEXT,   -- Assessment
    section_p       TEXT,   -- Plan
    risk_assessment TEXT,
    goals_addressed JSONB DEFAULT '[]',        -- [{goal_id, goal_text, addressed:true}]
    -- raw voice transcription before AI polish
    raw_voice_text  JSONB DEFAULT '{}',        -- {s:"...", o:"...", a:"...", p:"..."}
    -- AI polish
    ai_polished     JSONB DEFAULT '{}',
    ai_accepted     BOOLEAN DEFAULT false,
    ai_suggestions  JSONB DEFAULT '[]',        -- prior-note gap suggestions
    -- status
    status          VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
                        'draft','submitted','returned','approved','locked')),
    is_office_mode  BOOLEAN DEFAULT false,
    office_mode_started_at TIMESTAMPTZ,
    submitted_at    TIMESTAMPTZ,
    approved_at     TIMESTAMPTZ,
    approved_by     UUID REFERENCES users(id),
    supervisor_comment TEXT,
    -- copy-paste detection
    similarity_score NUMERIC(5,2),            -- 0-100, >80 triggers flag
    -- billing
    service_code    VARCHAR(50),
    units_billed    INTEGER DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
--  IMMUTABLE AUDIT LOG
-- =============================================================================
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID,
    actor_id        UUID,                      -- user who took the action
    actor_role      VARCHAR(50),
    action          VARCHAR(100) NOT NULL,     -- e.g. 'visit.start','note.approve','flag.clear'
    table_name      VARCHAR(100),
    record_id       UUID,
    old_value       JSONB,
    new_value       JSONB,
    ip_address      INET,
    device_id       VARCHAR(255),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- Enforce immutability via rule
CREATE RULE no_update_audit AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- =============================================================================
--  ███████╗ ██████╗ ██████╗ ███╗   ███╗███████╗    ███████╗███╗   ██╗ ██████╗
--  ██╔════╝██╔═══██╗██╔══██╗████╗ ████║██╔════╝    ██╔════╝████╗  ██║██╔════╝
--  █████╗  ██║   ██║██████╔╝██╔████╔██║███████╗    █████╗  ██╔██╗ ██║██║  ███╗
--  ██╔══╝  ██║   ██║██╔══██╗██║╚██╔╝██║╚════██║    ██╔══╝  ██║╚██╗██║██║   ██║
--  ██║     ╚██████╔╝██║  ██║██║ ╚═╝ ██║███████║    ███████╗██║ ╚████║╚██████╔╝
--  ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝    ╚══════╝╚═╝  ╚═══╝ ╚═════╝
--  The Forms Engine is the core of the SaaS platform's extensibility.
--  Every form — from any client organization — flows through this schema.
-- =============================================================================

CREATE TABLE forms (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    form_type           VARCHAR(100) NOT NULL,  -- 'progress_note','hipaa','intake','treatment_plan',
                                                -- 'discharge','incident','mileage','custom'
    version             INTEGER DEFAULT 1,
    original_file_s3_key VARCHAR(500),          -- uploaded PDF/image of original paper form
    print_template_s3_key VARCHAR(500),         -- generated print-ready PDF template
    -- AI extraction metadata
    ai_extracted        BOOLEAN DEFAULT false,
    ai_extraction_model VARCHAR(100),
    ai_extraction_at    TIMESTAMPTZ,
    ai_extraction_raw   JSONB,                  -- raw Claude response for audit
    -- configuration
    workflow_config     JSONB DEFAULT '{}',     -- trigger events, role assignments, routing
    settings            JSONB DEFAULT '{}',     -- org-specific overrides
    is_active           BOOLEAN DEFAULT true,
    is_system           BOOLEAN DEFAULT false,  -- true = built-in system form, cannot be deleted
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE form_sections (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id     UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    section_key VARCHAR(100) NOT NULL,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_repeating BOOLEAN DEFAULT false,        -- for sections that repeat (e.g. multiple medications)
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE form_fields (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id         UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    section_id      UUID REFERENCES form_sections(id) ON DELETE SET NULL,
    field_key       VARCHAR(255) NOT NULL,     -- machine name, used as DB column & JSON key
    field_label     VARCHAR(500) NOT NULL,     -- human-readable label from original form
    field_type      VARCHAR(50) NOT NULL CHECK (field_type IN (
                        -- text inputs
                        'text','textarea','number','email','phone','date','time','datetime',
                        -- selections
                        'dropdown','radio','checkbox','multi_select','boolean',
                        -- special
                        'signature','photo','gps_capture','file_upload',
                        -- system-populated (read-only in form, pulled from DB)
                        'client_name','cm_name','visit_date','visit_time',
                        'visit_duration','auth_number','service_code',
                        -- calculated
                        'calculated','hidden'
                    )),
    order_index     INTEGER NOT NULL DEFAULT 0,
    placeholder     TEXT,
    help_text       TEXT,
    default_value   TEXT,
    is_required     BOOLEAN DEFAULT false,
    is_read_only    BOOLEAN DEFAULT false,
    is_hidden       BOOLEAN DEFAULT false,
    -- options for dropdown/radio/checkbox/multi_select
    options         JSONB DEFAULT '[]',        -- [{value:"yes",label:"Yes"},{value:"no",label:"No"}]
    -- validation rules
    validation      JSONB DEFAULT '{}',        -- {min:0,max:100,pattern:"\\d{10}",message:"Must be 10 digits"}
    -- conditional logic: show this field only when...
    conditional     JSONB DEFAULT NULL,        -- {field_key:"attended",operator:"eq",value:"yes"}
    -- mapping to system fields (for auto-population)
    system_field    VARCHAR(100),              -- e.g. 'client.medicaid_id', 'visit.face_to_face_minutes'
    -- original position on paper form (from AI extraction, for print layout)
    print_x         NUMERIC(6,2),
    print_y         NUMERIC(6,2),
    print_width     NUMERIC(6,2),
    print_height    NUMERIC(6,2),
    print_page      INTEGER DEFAULT 1,
    -- AI extraction metadata
    ai_confidence   NUMERIC(4,2),              -- 0.0 to 1.0 confidence score from Claude
    ai_notes        TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(form_id, field_key)
);

CREATE TABLE form_workflows (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id         UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    workflow_name   VARCHAR(255) NOT NULL,
    step_order      INTEGER NOT NULL DEFAULT 0,
    -- when this step triggers
    trigger_event   VARCHAR(100) NOT NULL CHECK (trigger_event IN (
                        'visit_arrival','visit_start','visit_end',
                        'manual','scheduled','supervisor_action',
                        'client_portal','intake','discharge')),
    assigned_role   VARCHAR(50) NOT NULL,      -- who fills this step
    -- routing
    requires_signature          BOOLEAN DEFAULT false,
    requires_supervisor_review  BOOLEAN DEFAULT false,
    auto_populate_from_visit    BOOLEAN DEFAULT true,  -- pre-fill system fields from visit
    -- actions after completion
    on_complete_action  VARCHAR(100),          -- 'notify_supervisor','create_billing_record','submit_to_oa'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE form_submissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id         UUID NOT NULL REFERENCES forms(id),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    visit_id        UUID REFERENCES visits(id),
    client_id       UUID NOT NULL REFERENCES clients(id),
    submitted_by    UUID NOT NULL REFERENCES users(id),
    workflow_step   INTEGER DEFAULT 0,
    -- the actual field data
    data            JSONB NOT NULL DEFAULT '{}',
    -- status
    status          VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
                        'draft','submitted','returned','approved','archived')),
    -- signatures (array — multiple signers possible)
    signatures      JSONB DEFAULT '[]',        -- [{signer_role,signer_name,signed_at,gps,image_s3_key}]
    -- GPS at time of submission
    submission_gps  GEOMETRY(Point,4326),
    submission_inside_geofence BOOLEAN,
    -- print output
    print_pdf_s3_key VARCHAR(500),
    -- review
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    reviewer_notes  TEXT,
    -- timestamps
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    submitted_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
--  BILLING (Office Ally / Claims)
-- =============================================================================
CREATE TABLE claims (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id),
    visit_id            UUID NOT NULL REFERENCES visits(id),
    client_id           UUID NOT NULL REFERENCES clients(id),
    cm_id               UUID NOT NULL REFERENCES users(id),
    auth_id             UUID REFERENCES authorizations(id),
    -- 837P fields
    service_date        DATE NOT NULL,
    service_code        VARCHAR(50) NOT NULL,
    modifiers           VARCHAR(100),
    units               INTEGER NOT NULL DEFAULT 1,
    charge_amount       NUMERIC(10,2),
    diagnosis_codes     JSONB DEFAULT '[]',
    rendering_npi       VARCHAR(20),
    billing_npi         VARCHAR(20),
    taxonomy_code       VARCHAR(20),
    place_of_service    VARCHAR(10) DEFAULT '12',  -- 12=home, 99=other
    -- submission
    oa_claim_id         VARCHAR(100),
    submission_batch_id VARCHAR(100),
    submitted_at        TIMESTAMPTZ,
    -- response
    status              VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
                            'pending','submitted','accepted','rejected',
                            'paid','denied','adjusted','voided')),
    payer_control_num   VARCHAR(100),
    paid_amount         NUMERIC(10,2),
    paid_date           DATE,
    adjustment_reason   VARCHAR(500),
    denial_code         VARCHAR(100),
    denial_reason       TEXT,
    era_s3_key          VARCHAR(500),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
--  PAYROLL (ADP)
-- =============================================================================
CREATE TABLE payroll_periods (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    pay_date        DATE,
    status          VARCHAR(50) DEFAULT 'open' CHECK (status IN (
                        'open','generating','review','submitted','processed','error')),
    adp_batch_id    VARCHAR(100),
    submitted_by    UUID REFERENCES users(id),
    submitted_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payroll_line_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_id       UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
    cm_id           UUID NOT NULL REFERENCES users(id),
    earnings_code   VARCHAR(50) NOT NULL,      -- configured per org
    hours           NUMERIC(8,2),
    amount          NUMERIC(10,2),
    mileage         NUMERIC(8,2),
    visit_count     INTEGER DEFAULT 0,
    source_visit_ids JSONB DEFAULT '[]',
    is_adjustment   BOOLEAN DEFAULT false,
    adjustment_reason TEXT,
    adjusted_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
--  INDEXES (performance)
-- =============================================================================
CREATE INDEX idx_clients_org         ON clients(org_id);
CREATE INDEX idx_clients_cm          ON clients(primary_cm_id);
CREATE INDEX idx_clients_geo         ON clients USING GIST(geo_point);
CREATE INDEX idx_client_locs_geo     ON client_locations USING GIST(geo_point);
CREATE INDEX idx_visits_org          ON visits(org_id);
CREATE INDEX idx_visits_client       ON visits(client_id);
CREATE INDEX idx_visits_cm           ON visits(cm_id);
CREATE INDEX idx_visits_status       ON visits(status);
CREATE INDEX idx_visits_flagged      ON visits(is_flagged) WHERE is_flagged = true;
CREATE INDEX idx_visits_date         ON visits(hipaa_signed_at);
CREATE INDEX idx_notes_visit         ON progress_notes(visit_id);
CREATE INDEX idx_notes_status        ON progress_notes(status);
CREATE INDEX idx_notes_text_trgm     ON progress_notes USING GIN(section_s gin_trgm_ops);
CREATE INDEX idx_audit_actor         ON audit_log(actor_id);
CREATE INDEX idx_audit_record        ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_created       ON audit_log(created_at);
CREATE INDEX idx_forms_org           ON forms(org_id);
CREATE INDEX idx_form_fields_form    ON form_fields(form_id);
CREATE INDEX idx_form_subs_visit     ON form_submissions(visit_id);
CREATE INDEX idx_form_subs_client    ON form_submissions(client_id);
CREATE INDEX idx_claims_visit        ON claims(visit_id);
CREATE INDEX idx_claims_status       ON claims(status);
CREATE INDEX idx_device_pings_cm     ON device_pings(cm_id, pinged_at);
CREATE INDEX idx_auths_client        ON authorizations(client_id);
CREATE INDEX idx_auths_status        ON authorizations(status);

-- =============================================================================
--  UPDATED_AT trigger function
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated  BEFORE UPDATE ON organizations  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated          BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_clients_updated        BEFORE UPDATE ON clients        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_visits_updated         BEFORE UPDATE ON visits         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notes_updated          BEFORE UPDATE ON progress_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_forms_updated          BEFORE UPDATE ON forms          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_form_fields_updated    BEFORE UPDATE ON form_fields    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_form_subs_updated      BEFORE UPDATE ON form_submissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_claims_updated         BEFORE UPDATE ON claims         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_auths_updated          BEFORE UPDATE ON authorizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
--  GEOFENCE containment helper function
-- =============================================================================
CREATE OR REPLACE FUNCTION is_inside_geofence(
    check_point  GEOMETRY(Point, 4326),
    fence_center GEOMETRY(Point, 4326),
    radius_ft    INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN ST_DWithin(
        check_point::geography,
        fence_center::geography,
        radius_ft * 0.3048   -- convert feet to meters
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
