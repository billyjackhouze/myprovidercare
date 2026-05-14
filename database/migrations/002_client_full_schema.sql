-- =============================================================================
-- Migration 002 — Full Client Schema, Medications, Treatment Plans
-- Run: psql -U myprovidercare -d myprovidercare -f 002_client_full_schema.sql
-- =============================================================================

-- ── Extended client demographics & clinical fields ───────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS salutation          VARCHAR(20);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS middle_name         VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS suffix              VARCHAR(20);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gender              VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gender_expression   VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gender_identifier   VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gender_orientation  VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS birth_year          INTEGER;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ssn                 VARCHAR(255);   -- store encrypted
ALTER TABLE clients ADD COLUMN IF NOT EXISTS marital_status      VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS race                VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ethnicity           VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS birthday_65th       DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_visit_date     DATE;

-- ── Insurance ────────────────────────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS medicare_id         VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS subscriber_id       VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ins_vendor          VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS psych_name          VARCHAR(255);   -- psychiatrist name
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pcp_name            VARCHAR(255);   -- primary care physician name
ALTER TABLE clients ADD COLUMN IF NOT EXISTS primary_care_physician   VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS psychiatric_provider     VARCHAR(255);

-- ── LAI (Long-Acting Injectable) ─────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS on_a_lai            BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lai_medication       VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS injection_dates      TEXT;

-- ── Location extras ──────────────────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS county              VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sda                 VARCHAR(100);

-- ── Assignment / admin ───────────────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS loc                 VARCHAR(100);   -- Level of Care
ALTER TABLE clients ADD COLUMN IF NOT EXISTS chart_id            VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hit_list            BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS legal_guardian       VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mc_note2            TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pt_status           VARCHAR(50) DEFAULT 'active';

-- ── Pre-Auth cross-reference ─────────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pre_auth_status     VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pre_auth_cm1        VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pre_auth_cm2        VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pre_auth_ansa       VARCHAR(100);

-- ── ANSA / BIO / TP / Auth tracking dates ────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_ansa_date      DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS exp_ansa_date       DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_bios_date      DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS exp_bios_date       DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_tp_date        DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS exp_tp_date         DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_pn_date        DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_auth_start_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_auth_end_date  DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS auth_hrs_units      NUMERIC(10,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS avail_hrs_units     NUMERIC(10,2);

-- ── Photo ────────────────────────────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_s3_key        VARCHAR(500);

-- =============================================================================
--  MEDICATIONS  (living list — shared across all forms for this client)
-- =============================================================================
CREATE TABLE IF NOT EXISTS client_medications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    route           VARCHAR(100),
    dosage          VARCHAR(100),
    frequency       VARCHAR(100),
    indication      VARCHAR(255),
    prescribing_md  VARCHAR(255),
    is_active       BOOLEAN DEFAULT TRUE,
    start_date      DATE,
    end_date        DATE,
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_medications_client ON client_medications(client_id);
CREATE INDEX IF NOT EXISTS idx_client_medications_active ON client_medications(client_id, is_active);

-- =============================================================================
--  TREATMENT PLANS  (4 per client, used in Progress Notes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS client_treatment_plans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    plan_number     INTEGER NOT NULL CHECK (plan_number BETWEEN 1 AND 4),
    problem         TEXT,
    goals           TEXT,
    objective       TEXT,
    interventions   TEXT,
    target_date     DATE,
    status          VARCHAR(50) DEFAULT 'active',
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, plan_number)
);

CREATE INDEX IF NOT EXISTS idx_treatment_plans_client ON client_treatment_plans(client_id);

-- =============================================================================
--  DROPDOWN CONFIG  (admin-managed lists per page/field)
-- =============================================================================
CREATE TABLE IF NOT EXISTS dropdown_options (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    page_key        VARCHAR(100) NOT NULL,   -- e.g. 'client_general', 'visit_form'
    field_key       VARCHAR(100) NOT NULL,   -- e.g. 'gender', 'marital_status'
    label           VARCHAR(255) NOT NULL,
    value           VARCHAR(255) NOT NULL,
    sort_order      INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, page_key, field_key, value)
);

CREATE INDEX IF NOT EXISTS idx_dropdown_options_lookup ON dropdown_options(org_id, page_key, field_key, is_active);

-- Seed default dropdown values
INSERT INTO dropdown_options (org_id, page_key, field_key, label, value, sort_order)
SELECT o.id, 'client_general', 'salutation', v.label, v.value, v.sort_order
FROM organizations o
CROSS JOIN (VALUES
    ('Mr.','Mr.',1), ('Mrs.','Mrs.',2), ('Ms.','Ms.',3),
    ('Miss','Miss',4), ('Dr.','Dr.',5), ('Rev.','Rev.',6)
) AS v(label, value, sort_order)
ON CONFLICT DO NOTHING;

INSERT INTO dropdown_options (org_id, page_key, field_key, label, value, sort_order)
SELECT o.id, 'client_general', 'gender', v.label, v.value, v.sort_order
FROM organizations o
CROSS JOIN (VALUES
    ('Male','Male',1), ('Female','Female',2), ('Non-Binary','Non-Binary',3),
    ('Transgender Male','Transgender Male',4), ('Transgender Female','Transgender Female',5),
    ('Other','Other',6), ('Unknown','Unknown',7), ('Declined to State','Declined to State',8)
) AS v(label, value, sort_order)
ON CONFLICT DO NOTHING;

INSERT INTO dropdown_options (org_id, page_key, field_key, label, value, sort_order)
SELECT o.id, 'client_general', 'marital_status', v.label, v.value, v.sort_order
FROM organizations o
CROSS JOIN (VALUES
    ('Single','Single',1), ('Married','Married',2), ('Divorced','Divorced',3),
    ('Widowed','Widowed',4), ('Separated','Separated',5), ('Domestic Partner','Domestic Partner',6),
    ('Unknown','Unknown',7)
) AS v(label, value, sort_order)
ON CONFLICT DO NOTHING;

INSERT INTO dropdown_options (org_id, page_key, field_key, label, value, sort_order)
SELECT o.id, 'client_general', 'race', v.label, v.value, v.sort_order
FROM organizations o
CROSS JOIN (VALUES
    ('American Indian or Alaska Native','American Indian or Alaska Native',1),
    ('Asian','Asian',2),
    ('Black or African American','Black or African American',3),
    ('Hispanic or Latino','Hispanic or Latino',4),
    ('Native Hawaiian or Pacific Islander','Native Hawaiian or Pacific Islander',5),
    ('White','White',6),
    ('Two or More Races','Two or More Races',7),
    ('Other','Other',8),
    ('Declined to State','Declined to State',9),
    ('Unknown','Unknown',10)
) AS v(label, value, sort_order)
ON CONFLICT DO NOTHING;

INSERT INTO dropdown_options (org_id, page_key, field_key, label, value, sort_order)
SELECT o.id, 'client_general', 'pt_status', v.label, v.value, v.sort_order
FROM organizations o
CROSS JOIN (VALUES
    ('Active','active',1), ('Inactive','inactive',2), ('Pending','pending',3),
    ('On Hold','on_hold',4), ('Discharged','discharged',5)
) AS v(label, value, sort_order)
ON CONFLICT DO NOTHING;

INSERT INTO dropdown_options (org_id, page_key, field_key, label, value, sort_order)
SELECT o.id, 'client_general', 'loc', v.label, v.value, v.sort_order
FROM organizations o
CROSS JOIN (VALUES
    ('Level 1 - Outpatient','1',1), ('Level 2 - Intensive Outpatient','2',2),
    ('Level 3 - Residential','3',3), ('Level 4 - Medically Managed','4',4),
    ('Community Based','community_based',5), ('Crisis Stabilization','crisis',6)
) AS v(label, value, sort_order)
ON CONFLICT DO NOTHING;

INSERT INTO dropdown_options (org_id, page_key, field_key, label, value, sort_order)
SELECT o.id, 'client_medications', 'route', v.label, v.value, v.sort_order
FROM organizations o
CROSS JOIN (VALUES
    ('Oral','Oral',1), ('Injection - IM','IM',2), ('Injection - SubQ','SubQ',3),
    ('Topical','Topical',4), ('Inhalation','Inhalation',5), ('IV','IV',6),
    ('Sublingual','Sublingual',7), ('Transdermal Patch','Transdermal',8), ('Other','Other',9)
) AS v(label, value, sort_order)
ON CONFLICT DO NOTHING;

INSERT INTO dropdown_options (org_id, page_key, field_key, label, value, sort_order)
SELECT o.id, 'client_medications', 'frequency', v.label, v.value, v.sort_order
FROM organizations o
CROSS JOIN (VALUES
    ('Once Daily (QD)','QD',1), ('Twice Daily (BID)','BID',2),
    ('Three Times Daily (TID)','TID',3), ('Four Times Daily (QID)','QID',4),
    ('Every Morning (QAM)','QAM',5), ('Every Night (QHS)','QHS',6),
    ('Every Other Day','QOD',7), ('Weekly','Weekly',8),
    ('Bi-Weekly','Bi-Weekly',9), ('Monthly','Monthly',10), ('As Needed (PRN)','PRN',11)
) AS v(label, value, sort_order)
ON CONFLICT DO NOTHING;

SELECT 'Migration 002 complete' AS result;
