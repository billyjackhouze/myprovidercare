-- =============================================================================
-- Migration 005 — Reconcile clients table with ORM model
-- Fixes column name mismatches between 001_initial_schema and current models
-- =============================================================================

-- ── zip → zip_code ───────────────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='clients' AND column_name='zip'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='clients' AND column_name='zip_code'
    ) THEN
        ALTER TABLE clients RENAME COLUMN zip TO zip_code;
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='clients' AND column_name='zip_code'
    ) THEN
        ALTER TABLE clients ADD COLUMN zip_code VARCHAR(10);
    END IF;
END $$;

-- ── emergency_contact JSONB (replaces split columns) ─────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS emergency_contact JSONB DEFAULT '{}';

-- Migrate any existing data from the split columns into the JSONB column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='clients' AND column_name='emergency_contact_name'
    ) THEN
        UPDATE clients
        SET emergency_contact = json_build_object(
            'name',  COALESCE(emergency_contact_name, ''),
            'phone', COALESCE(emergency_contact_phone, '')
        )
        WHERE emergency_contact_name IS NOT NULL
           OR emergency_contact_phone IS NOT NULL;
    END IF;
END $$;

-- ── assigned_cm_id (model uses this; DB had primary_cm_id) ───────────────────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='clients' AND column_name='primary_cm_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='clients' AND column_name='assigned_cm_id'
    ) THEN
        ALTER TABLE clients RENAME COLUMN primary_cm_id TO assigned_cm_id;
    ELSE
        ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_cm_id
            UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ── Missing columns that the ORM model expects ────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ssn_last4       VARCHAR(4);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payer_info      JSONB DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_active       BOOLEAN DEFAULT TRUE;

-- ── Ensure diagnosis_codes and risk_flags are JSONB (in case they weren't) ───
ALTER TABLE clients ADD COLUMN IF NOT EXISTS diagnosis_codes JSONB DEFAULT '[]';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS risk_flags      JSONB DEFAULT '[]';

-- ── pt_status default ────────────────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pt_status VARCHAR(50) DEFAULT 'active';

-- ── phone_primary alias (some code uses phone, some phone_primary) ────────────
-- Keep both — phone is already there from 001, this is a no-op safety net
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

SELECT 'Migration 005 complete — clients table reconciled.' AS result;
