-- Migration 016: Progress note lock, visit clock evidence, addenda, devices
-- Implements the "NSH Mobile Rebuild: Locking, Visit Clock and Evidence Design" doc.
--
-- Rules enforced here, in the database, so no API route, script, import or
-- queued offline edit can bypass them:
--   * One lock for the whole note. States: draft -> locked -> reopened -> locked.
--   * A locked note refuses every write to its data tables.
--   * Reopen = frozen time, data-only edits, restarts the 24 h submit clock.
--   * Addenda never overwrite; time can only change by an addendum written by
--     someone holding note.addendum_time.
--   * Evidence tables (capture_events, field_audit) are append-only.
--
-- The API must run every request inside a transaction that first does:
--     SELECT set_config('nc.user_id', '<user uuid>', true);
-- (true = local to the transaction). Guards read it with nc_current_user().

BEGIN;

-- ── 1. Roles and per-user settings ───────────────────────────────────────────
-- Replace any role CHECK on users with one that knows every level.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (
  'case_manager','clinician','team_lead','supervisor','owner','admin','developer',
  'billing','intake','auditor'));

-- Progress Note security: which device kinds this user may use. Laptops are
-- for clinicians only (enforced by nc_register_device below).
ALTER TABLE users ADD COLUMN IF NOT EXISTS progress_note_security VARCHAR(10)
  NOT NULL DEFAULT 'ipad' CHECK (progress_note_security IN ('ipad','laptop','both'));

-- ── 2. Permissions for the new capabilities ──────────────────────────────────
INSERT INTO permissions (key, label, section, description, order_index) VALUES
  ('note_reopen',            'Reopen Locked Notes',       'Notes', 'Reopen a submitted note for correction (time frozen, data only)', 60),
  ('note_addendum',          'Add Addenda',               'Notes', 'Write a signed addendum to a locked note', 61),
  ('note_addendum_time',     'Addendum Can Change Time',  'Notes', 'An addendum may adjust or extend contact time', 62),
  ('note_countersign',       'Countersign Addenda',       'Notes', 'Countersign an addendum written by field staff', 63),
  ('note_close_for_user',    'Close Note For Staff',      'Notes', 'Close a note with a supervisor photo upload or Photo not available', 64),
  ('device_approve',         'Approve Devices',           'Notes', 'Approve a second device (laptop) for a user', 65)
ON CONFLICT (key) DO NOTHING;

-- Defaults. Team lead: reopen + addendum (no time). Supervisor and above:
-- everything. Time changes: supervisor only by default; grant others per user.
INSERT INTO role_permissions (role, permission_key, granted)
SELECT r, k, TRUE FROM (VALUES
  ('team_lead','note_reopen'),('team_lead','note_addendum'),
  ('supervisor','note_reopen'),('supervisor','note_addendum'),('supervisor','note_addendum_time'),
  ('supervisor','note_countersign'),('supervisor','note_close_for_user'),('supervisor','device_approve'),
  ('admin','note_reopen'),('admin','note_addendum'),('admin','note_countersign'),
  ('admin','note_close_for_user'),('admin','device_approve'),
  ('owner','note_reopen'),('owner','note_addendum'),('owner','note_countersign'),
  ('owner','note_close_for_user'),('owner','device_approve'),
  ('developer','note_reopen'),('developer','note_addendum'),('developer','note_countersign'),
  ('developer','note_close_for_user'),('developer','device_approve')
) AS t(r,k)
ON CONFLICT DO NOTHING;

-- Resolve a permission: a per-user row wins, otherwise the role default. Fail closed.
CREATE OR REPLACE FUNCTION nc_has_permission(p_user uuid, p_key text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT up.state = 'granted' FROM user_permissions up
      WHERE up.user_id = p_user AND up.permission_key = p_key),
    (SELECT rp.granted FROM role_permissions rp JOIN users u ON u.role = rp.role
      WHERE u.id = p_user AND rp.permission_key = p_key),
    FALSE);
$$;

CREATE OR REPLACE FUNCTION nc_current_user() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('nc.user_id', true), '')::uuid;
$$;

-- ── 3. Devices ───────────────────────────────────────────────────────────────
-- `devices` already exists (push-token registry, referenced by visits.device_id).
-- Extend it in place; existing rows keep kind NULL and are left alone.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS kind VARCHAR(10) CHECK (kind IN ('ipad','laptop'));
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_uid VARCHAR(200);      -- hardware / install identifier
ALTER TABLE devices ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending','approved','revoked'));
ALTER TABLE devices ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS uq_devices_org_uid ON devices (org_id, device_uid) WHERE device_uid IS NOT NULL;
-- One iPad per user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_devices_one_ipad
  ON devices (user_id) WHERE kind = 'ipad' AND status <> 'revoked';

-- Register a device. iPad: the user's one assigned iPad. Laptop: clinicians
-- only, the Progress Note security setting must allow it, and it stays
-- 'pending' until someone with device_approve (supervisor and above) approves.
CREATE OR REPLACE FUNCTION nc_register_device(p_user uuid, p_kind text, p_uid text, p_label text)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE u users%ROWTYPE; d uuid;
BEGIN
  SELECT * INTO u FROM users WHERE id = p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF p_kind = 'laptop' THEN
    IF u.role <> 'clinician' THEN RAISE EXCEPTION 'LAPTOP_CLINICIAN_ONLY'; END IF;
    IF u.progress_note_security NOT IN ('laptop','both') THEN
      RAISE EXCEPTION 'LAPTOP_NOT_ALLOWED_FOR_USER'; END IF;
  ELSIF p_kind = 'ipad' THEN
    IF u.progress_note_security NOT IN ('ipad','both') THEN
      RAISE EXCEPTION 'IPAD_NOT_ALLOWED_FOR_USER'; END IF;
  END IF;
  INSERT INTO devices (id, org_id, user_id, kind, device_uid, device_name, device_type, is_active, status)
  VALUES (gen_random_uuid(), u.org_id, p_user, p_kind, p_uid, p_label, p_kind, TRUE,
          CASE WHEN p_kind = 'laptop' THEN 'pending' ELSE 'approved' END)
  RETURNING id INTO d;
  RETURN d;
END $$;

CREATE OR REPLACE FUNCTION nc_approve_device(p_device uuid, p_approver uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT nc_has_permission(p_approver, 'device_approve') THEN
    RAISE EXCEPTION 'NOT_ALLOWED: device_approve'; END IF;
  UPDATE devices SET status = 'approved', approved_by = p_approver, approved_at = NOW()
   WHERE id = p_device AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'DEVICE_NOT_PENDING'; END IF;
END $$;

-- ── 4. Progress notes (lock container) ───────────────────────────────────────
-- progress_notes already exists (001, SOAP columns, cm_id, review status).
-- The review workflow stays in `status`; the lock lives in its own column so
-- the two cannot be confused. cm_id is the note author.
ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS note_type VARCHAR(30) NOT NULL DEFAULT 'PN2';
ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS lock_state VARCHAR(10) NOT NULL DEFAULT 'draft'
    CHECK (lock_state IN ('draft','locked','reopened'));
ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS submit_due_at TIMESTAMPTZ;    -- 24 h after contact end, or after a reopen
ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS submitted_late BOOLEAN;       -- set at each submit
ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS closed_correctly BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS close_reason TEXT;
ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS credited_minutes INTEGER;     -- 15 when closed late or by a supervisor
CREATE UNIQUE INDEX IF NOT EXISTS uq_pn_visit_type ON progress_notes (visit_id, note_type);
CREATE INDEX IF NOT EXISTS idx_pn_author_lock ON progress_notes (cm_id, lock_state);
CREATE INDEX IF NOT EXISTS idx_pn_due ON progress_notes (submit_due_at) WHERE lock_state <> 'locked';

-- The SOAP columns on progress_notes itself obey the same lock.
CREATE OR REPLACE FUNCTION nc_guard_pn_columns() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.lock_state = 'locked' AND (
       NEW.section_s IS DISTINCT FROM OLD.section_s OR NEW.section_o IS DISTINCT FROM OLD.section_o
    OR NEW.section_a IS DISTINCT FROM OLD.section_a OR NEW.section_p IS DISTINCT FROM OLD.section_p
    OR NEW.risk_assessment IS DISTINCT FROM OLD.risk_assessment
    OR NEW.goals_addressed IS DISTINCT FROM OLD.goals_addressed
    OR NEW.raw_voice_text IS DISTINCT FROM OLD.raw_voice_text
    OR NEW.ai_polished IS DISTINCT FROM OLD.ai_polished) THEN
    RAISE EXCEPTION 'NOTE_LOCKED: changes to a locked note are made by addendum';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pn_column_guard ON progress_notes;
CREATE TRIGGER trg_pn_column_guard BEFORE UPDATE ON progress_notes
  FOR EACH ROW EXECUTE FUNCTION nc_guard_pn_columns();

-- ── 5. Evidence: capture events (append-only) ────────────────────────────────
CREATE TABLE IF NOT EXISTS capture_events (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id             UUID NOT NULL REFERENCES organizations(id),
    visit_id           UUID REFERENCES visits(id),
    note_id            UUID REFERENCES progress_notes(id),
    user_id            UUID NOT NULL REFERENCES users(id),
    device_id          UUID REFERENCES devices(id),
    kind               VARCHAR(30) NOT NULL CHECK (kind IN (
                         'hipaa_signature','end_photo','staff_signature',
                         'addendum_signature','countersign','supervisor_close')),
    server_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- the authoritative time
    device_clock_at    TIMESTAMPTZ,                          -- what the device claimed
    device_elapsed_ms  BIGINT,                               -- offline anchor counter
    clock_skew_s       INTEGER GENERATED ALWAYS AS (
        CASE WHEN device_clock_at IS NULL THEN NULL
             ELSE ABS(EXTRACT(EPOCH FROM (server_received_at - device_clock_at)))::INTEGER END
    ) STORED,
    gps                GEOMETRY(Point,4326),
    gps_accuracy_m     NUMERIC(8,2),
    photo_hash         CHAR(64),                             -- SHA-256 of the camera image
    photo_s3_key       VARCHAR(500),
    camera_only        BOOLEAN,                              -- true only for in-app camera capture
    not_available_reason TEXT,                               -- supervisor "Photo not available"
    mutation_id        UUID UNIQUE,                          -- client idempotency key
    CHECK (kind <> 'end_photo' OR photo_hash IS NOT NULL OR not_available_reason IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_capture_photo_hash
  ON capture_events (photo_hash) WHERE photo_hash IS NOT NULL;  -- the same photo can never close two notes
CREATE INDEX IF NOT EXISTS idx_capture_note ON capture_events (note_id, server_received_at);
CREATE INDEX IF NOT EXISTS idx_capture_user ON capture_events (user_id, server_received_at DESC);

-- One open clock per user: a second hipaa_signature while an earlier visit has
-- no end_photo for the same user is refused by nc_start_clock().
CREATE OR REPLACE FUNCTION nc_start_clock(p_visit uuid, p_user uuid, p_device uuid,
  p_gps geometry, p_acc numeric, p_device_clock timestamptz, p_elapsed bigint, p_mutation uuid)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE ev uuid; v visits%ROWTYPE;
BEGIN
  SELECT * INTO v FROM visits WHERE id = p_visit FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VISIT_NOT_FOUND'; END IF;
  IF v.cm_id <> p_user THEN RAISE EXCEPTION 'NOT_YOUR_VISIT'; END IF;
  IF v.hipaa_signed_at IS NOT NULL THEN RAISE EXCEPTION 'CLOCK_ALREADY_STARTED'; END IF;
  IF EXISTS (SELECT 1 FROM visits o WHERE o.cm_id = p_user AND o.id <> p_visit
             AND o.hipaa_signed_at IS NOT NULL AND o.photo_taken_at IS NULL) THEN
    RAISE EXCEPTION 'ANOTHER_CLOCK_OPEN'; END IF;
  INSERT INTO capture_events (org_id, visit_id, user_id, device_id, kind, gps, gps_accuracy_m,
                              device_clock_at, device_elapsed_ms, mutation_id)
  VALUES (v.org_id, p_visit, p_user, p_device, 'hipaa_signature', p_gps, p_acc,
          p_device_clock, p_elapsed, p_mutation) RETURNING id INTO ev;
  PERFORM set_config('nc.time_write', 'on', true);
  UPDATE visits SET hipaa_signed_at = (SELECT server_received_at FROM capture_events WHERE id = ev),
                    hipaa_gps = p_gps, status = 'active' WHERE id = p_visit;
  RETURN ev;
END $$;

-- The photo is the stop. End time = the server time the camera capture arrived.
CREATE OR REPLACE FUNCTION nc_stop_clock(p_visit uuid, p_user uuid, p_device uuid,
  p_gps geometry, p_acc numeric, p_photo_hash text, p_photo_key text, p_camera_only boolean,
  p_device_clock timestamptz, p_elapsed bigint, p_mutation uuid,
  p_closed_by uuid DEFAULT NULL, p_not_available_reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE ev uuid; v visits%ROWTYPE; t timestamptz; mins int; supervised boolean;
BEGIN
  SELECT * INTO v FROM visits WHERE id = p_visit FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VISIT_NOT_FOUND'; END IF;
  IF v.hipaa_signed_at IS NULL THEN RAISE EXCEPTION 'CLOCK_NOT_STARTED'; END IF;
  IF v.photo_taken_at IS NOT NULL THEN RAISE EXCEPTION 'CLOCK_ALREADY_STOPPED'; END IF;
  supervised := p_closed_by IS NOT NULL;
  IF supervised THEN
    IF NOT nc_has_permission(p_closed_by, 'note_close_for_user') THEN
      RAISE EXCEPTION 'NOT_ALLOWED: note_close_for_user'; END IF;
  ELSE
    IF v.cm_id <> p_user THEN RAISE EXCEPTION 'NOT_YOUR_VISIT'; END IF;
    IF p_camera_only IS NOT TRUE OR p_photo_hash IS NULL THEN
      RAISE EXCEPTION 'PHOTO_MUST_COME_FROM_CAMERA'; END IF;
  END IF;
  INSERT INTO capture_events (org_id, visit_id, user_id, device_id, kind, gps, gps_accuracy_m,
         photo_hash, photo_s3_key, camera_only, device_clock_at, device_elapsed_ms, mutation_id,
         not_available_reason)
  VALUES (v.org_id, p_visit, COALESCE(p_closed_by, p_user), p_device,
          CASE WHEN supervised THEN 'supervisor_close' ELSE 'end_photo' END,
          p_gps, p_acc, p_photo_hash, p_photo_key, p_camera_only, p_device_clock, p_elapsed,
          p_mutation, p_not_available_reason)
  RETURNING id, server_received_at INTO ev, t;
  mins := (EXTRACT(EPOCH FROM (t - v.hipaa_signed_at)) / 60)::int;
  PERFORM set_config('nc.time_write', 'on', true);
  UPDATE visits SET photo_taken_at = t, photo_gps = p_gps, photo_s3_key = p_photo_key,
                    status = 'note_in_progress' WHERE id = p_visit;
  -- Contact past 90 minutes without a clean close is credited 15 minutes (supervisor addendum can raise it).
  UPDATE progress_notes
     SET submit_due_at = t + INTERVAL '24 hours',
         closed_correctly = NOT (supervised OR mins > 90),
         close_reason = CASE WHEN supervised THEN COALESCE(p_not_available_reason,'Closed by supervisor')
                             WHEN mins > 90 THEN 'Closed after the 90 minute limit' END,
         credited_minutes = CASE WHEN supervised OR mins > 90 THEN 15 ELSE mins END
   WHERE visit_id = p_visit;
  RETURN ev;
END $$;

-- Contact times are frozen once set. Only the two clock functions (nc.time_write)
-- or an applied time addendum (nc.time_addendum) may write them.
CREATE OR REPLACE FUNCTION nc_guard_visit_time() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.hipaa_signed_at IS DISTINCT FROM OLD.hipaa_signed_at AND OLD.hipaa_signed_at IS NOT NULL)
  OR (NEW.photo_taken_at  IS DISTINCT FROM OLD.photo_taken_at  AND OLD.photo_taken_at  IS NOT NULL)
  OR (NEW.hipaa_signed_at IS DISTINCT FROM OLD.hipaa_signed_at AND OLD.hipaa_signed_at IS NULL
      AND COALESCE(current_setting('nc.time_write', true),'') <> 'on')
  OR (NEW.photo_taken_at  IS DISTINCT FROM OLD.photo_taken_at  AND OLD.photo_taken_at  IS NULL
      AND COALESCE(current_setting('nc.time_write', true),'') <> 'on') THEN
    IF COALESCE(current_setting('nc.time_addendum', true),'') = '' THEN
      RAISE EXCEPTION 'TIME_FROZEN: contact times change only by an addendum';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_visits_time_guard ON visits;
CREATE TRIGGER trg_visits_time_guard BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION nc_guard_visit_time();

-- ── 6. Field audit (append-only) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS field_audit (
    id          BIGSERIAL PRIMARY KEY,
    org_id      UUID NOT NULL,
    note_id     UUID NOT NULL REFERENCES progress_notes(id),
    user_id     UUID,
    device_id   UUID,
    table_name  TEXT NOT NULL,
    field_name  TEXT NOT NULL,
    old_value   TEXT,
    new_value   TEXT,
    note_state  VARCHAR(10) NOT NULL,
    server_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_field_audit_note ON field_audit (note_id, server_time);

CREATE OR REPLACE FUNCTION nc_block_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY: % cannot be %', TG_TABLE_NAME, lower(TG_OP);
END $$;
DROP TRIGGER IF EXISTS trg_capture_append_only ON capture_events;
CREATE TRIGGER trg_capture_append_only BEFORE UPDATE OR DELETE ON capture_events
  FOR EACH ROW EXECUTE FUNCTION nc_block_change();
DROP TRIGGER IF EXISTS trg_field_audit_append_only ON field_audit;
CREATE TRIGGER trg_field_audit_append_only BEFORE UPDATE OR DELETE ON field_audit
  FOR EACH ROW EXECUTE FUNCTION nc_block_change();

-- ── 7. THE lock check. One function, attached to every note data table. ──────
-- Locked: refuse. Draft or reopened: only the author writes. Every change is
-- written to field_audit with the server time. Time columns are not in these
-- tables; they live on visits and are guarded above.
CREATE OR REPLACE FUNCTION nc_guard_note_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  n progress_notes%ROWTYPE; nid uuid; who uuid := nc_current_user();
  o jsonb; w jsonb; k text;
BEGIN
  nid := CASE WHEN TG_OP = 'DELETE' THEN OLD.note_id ELSE NEW.note_id END;
  SELECT * INTO n FROM progress_notes WHERE id = nid;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOTE_NOT_FOUND'; END IF;
  IF n.lock_state = 'locked' THEN
    RAISE EXCEPTION 'NOTE_LOCKED: changes to a locked note are made by addendum';
  END IF;
  IF who IS NULL THEN RAISE EXCEPTION 'NO_USER_CONTEXT'; END IF;
  IF who <> n.cm_id THEN RAISE EXCEPTION 'NOT_NOTE_AUTHOR'; END IF;
  IF TG_OP = 'DELETE' THEN
    INSERT INTO field_audit (org_id, note_id, user_id, table_name, field_name, old_value, note_state)
    VALUES (n.org_id, nid, who, TG_TABLE_NAME, '(row deleted)', to_jsonb(OLD)::text, n.lock_state);
    RETURN OLD;
  END IF;
  w := to_jsonb(NEW);
  o := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  FOR k IN SELECT jsonb_object_keys(w) LOOP
    IF k IN ('id','note_id','updated_at','created_at') THEN CONTINUE; END IF;
    IF (o -> k) IS DISTINCT FROM (w -> k) THEN
      INSERT INTO field_audit (org_id, note_id, user_id, table_name, field_name, old_value, new_value, note_state)
      VALUES (n.org_id, nid, who, TG_TABLE_NAME, k, o ->> k, w ->> k, n.lock_state);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION nc_attach_note_guard(p_table regclass) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS trg_note_guard ON %s', p_table);
  EXECUTE format('CREATE TRIGGER trg_note_guard BEFORE INSERT OR UPDATE OR DELETE ON %s
                  FOR EACH ROW EXECUTE FUNCTION nc_guard_note_write()', p_table);
END $$;

-- ── 8. Submit, reopen, addenda ───────────────────────────────────────────────
-- Submit = the signing capture event + the lock, atomically. Works from draft
-- or reopened. Measured against submit_due_at (24 h after contact end, or
-- after the reopen).
CREATE OR REPLACE FUNCTION nc_submit_note(p_note uuid, p_user uuid, p_device uuid,
  p_gps geometry, p_acc numeric, p_device_clock timestamptz, p_elapsed bigint, p_mutation uuid)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE n progress_notes%ROWTYPE; ev uuid; t timestamptz; v visits%ROWTYPE;
BEGIN
  SELECT * INTO n FROM progress_notes WHERE id = p_note FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOTE_NOT_FOUND'; END IF;
  IF n.lock_state = 'locked' THEN RAISE EXCEPTION 'NOTE_LOCKED'; END IF;
  IF n.cm_id <> p_user THEN RAISE EXCEPTION 'NOT_NOTE_AUTHOR'; END IF;
  SELECT * INTO v FROM visits WHERE id = n.visit_id;
  IF v.photo_taken_at IS NULL THEN RAISE EXCEPTION 'CONTACT_NOT_CLOSED'; END IF;
  INSERT INTO capture_events (org_id, visit_id, note_id, user_id, device_id, kind, gps, gps_accuracy_m,
                              device_clock_at, device_elapsed_ms, mutation_id)
  VALUES (n.org_id, n.visit_id, p_note, p_user, p_device, 'staff_signature', p_gps, p_acc,
          p_device_clock, p_elapsed, p_mutation)
  RETURNING id, server_received_at INTO ev, t;
  UPDATE progress_notes SET lock_state = 'locked', submitted_at = t,
         submitted_late = (t > COALESCE(submit_due_at, t))
   WHERE id = p_note;
  UPDATE note_reopens SET resubmitted_at = t
   WHERE note_id = p_note AND resubmitted_at IS NULL;
  RETURN ev;
END $$;

CREATE TABLE IF NOT EXISTS note_reopens (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id        UUID NOT NULL REFERENCES progress_notes(id),
    reopened_by    UUID NOT NULL REFERENCES users(id),
    reason         TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
    reopened_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resubmitted_at TIMESTAMPTZ,
    prev_due_at    TIMESTAMPTZ,
    hipaa_signed_at TIMESTAMPTZ,      -- snapshot proving time was frozen
    photo_taken_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reopens_note ON note_reopens (note_id);

-- Reopen: note_reopen permission, never your own note, locked notes only,
-- reason required. Time stays frozen; the 24 h clock restarts from now.
CREATE OR REPLACE FUNCTION nc_reopen_note(p_note uuid, p_user uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE n progress_notes%ROWTYPE; v visits%ROWTYPE; r uuid;
BEGIN
  IF NOT nc_has_permission(p_user, 'note_reopen') THEN
    RAISE EXCEPTION 'NOT_ALLOWED: note_reopen'; END IF;
  SELECT * INTO n FROM progress_notes WHERE id = p_note FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOTE_NOT_FOUND'; END IF;
  IF n.lock_state <> 'locked' THEN RAISE EXCEPTION 'NOTE_NOT_LOCKED'; END IF;
  IF n.cm_id = p_user THEN RAISE EXCEPTION 'AUTHOR_CANNOT_REOPEN_OWN_NOTE'; END IF;
  SELECT * INTO v FROM visits WHERE id = n.visit_id;
  INSERT INTO note_reopens (note_id, reopened_by, reason, prev_due_at, hipaa_signed_at, photo_taken_at)
  VALUES (p_note, p_user, p_reason, n.submit_due_at, v.hipaa_signed_at, v.photo_taken_at)
  RETURNING id INTO r;
  UPDATE progress_notes SET lock_state = 'reopened', submit_due_at = NOW() + INTERVAL '24 hours'
   WHERE id = p_note;
  RETURN r;
END $$;

CREATE TABLE IF NOT EXISTS note_addenda (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           UUID NOT NULL REFERENCES organizations(id),
    note_id          UUID NOT NULL REFERENCES progress_notes(id),
    author_id        UUID NOT NULL REFERENCES users(id),
    author_role      VARCHAR(50) NOT NULL,
    reason           TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
    changes          JSONB NOT NULL DEFAULT '[]',     -- [{table,field,before,after}]
    changes_time     BOOLEAN NOT NULL DEFAULT FALSE,
    new_hipaa_signed_at TIMESTAMPTZ,
    new_photo_taken_at  TIMESTAMPTZ,
    signature_event_id UUID REFERENCES capture_events(id),
    status           VARCHAR(20) NOT NULL DEFAULT 'pending_countersign'
                     CHECK (status IN ('pending_countersign','countersigned','rejected')),
    countersigned_by UUID REFERENCES users(id),
    countersigned_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (NOT changes_time OR (new_hipaa_signed_at IS NOT NULL OR new_photo_taken_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_addenda_note ON note_addenda (note_id, created_at);

-- Add an addendum. Needs note_addendum; a time change also needs
-- note_addendum_time. The author's signature event is required. The original
-- answers are never touched; the addendum is its own record.
CREATE OR REPLACE FUNCTION nc_add_addendum(p_note uuid, p_user uuid, p_reason text, p_changes jsonb,
  p_sig_event uuid, p_new_start timestamptz DEFAULT NULL, p_new_end timestamptz DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE n progress_notes%ROWTYPE; u users%ROWTYPE; a uuid; ct boolean;
BEGIN
  IF NOT nc_has_permission(p_user, 'note_addendum') THEN
    RAISE EXCEPTION 'NOT_ALLOWED: note_addendum'; END IF;
  ct := (p_new_start IS NOT NULL OR p_new_end IS NOT NULL);
  IF ct AND NOT nc_has_permission(p_user, 'note_addendum_time') THEN
    RAISE EXCEPTION 'NOT_ALLOWED: note_addendum_time'; END IF;
  SELECT * INTO n FROM progress_notes WHERE id = p_note;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOTE_NOT_FOUND'; END IF;
  IF n.lock_state <> 'locked' THEN RAISE EXCEPTION 'ADDENDUM_ONLY_ON_LOCKED_NOTE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM capture_events WHERE id = p_sig_event AND user_id = p_user
                 AND kind = 'addendum_signature') THEN
    RAISE EXCEPTION 'SIGNATURE_EVENT_REQUIRED'; END IF;
  SELECT * INTO u FROM users WHERE id = p_user;
  INSERT INTO note_addenda (org_id, note_id, author_id, author_role, reason, changes, changes_time,
                            new_hipaa_signed_at, new_photo_taken_at, signature_event_id)
  VALUES (n.org_id, p_note, p_user, u.role, p_reason, COALESCE(p_changes,'[]'), ct,
          p_new_start, p_new_end, p_sig_event) RETURNING id INTO a;
  RETURN a;
END $$;

-- Countersign. Field staff addenda need a supervisor-level countersign; a
-- time change takes effect on visits only at countersign, through the one
-- sanctioned path (nc.time_addendum).
CREATE OR REPLACE FUNCTION nc_countersign_addendum(p_addendum uuid, p_user uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE a note_addenda%ROWTYPE; v visits%ROWTYPE; n progress_notes%ROWTYPE; mins int;
BEGIN
  IF NOT nc_has_permission(p_user, 'note_countersign') THEN
    RAISE EXCEPTION 'NOT_ALLOWED: note_countersign'; END IF;
  SELECT * INTO a FROM note_addenda WHERE id = p_addendum FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ADDENDUM_NOT_FOUND'; END IF;
  IF a.status <> 'pending_countersign' THEN RAISE EXCEPTION 'ADDENDUM_NOT_PENDING'; END IF;
  IF a.author_id = p_user THEN RAISE EXCEPTION 'CANNOT_COUNTERSIGN_OWN_ADDENDUM'; END IF;
  UPDATE note_addenda SET status = 'countersigned', countersigned_by = p_user, countersigned_at = NOW()
   WHERE id = p_addendum;
  IF a.changes_time THEN
    SELECT * INTO n FROM progress_notes WHERE id = a.note_id;
    PERFORM set_config('nc.time_addendum', p_addendum::text, true);
    UPDATE visits SET hipaa_signed_at = COALESCE(a.new_hipaa_signed_at, hipaa_signed_at),
                      photo_taken_at  = COALESCE(a.new_photo_taken_at,  photo_taken_at)
     WHERE id = n.visit_id RETURNING * INTO v;
    mins := (EXTRACT(EPOCH FROM (v.photo_taken_at - v.hipaa_signed_at)) / 60)::int;
    UPDATE progress_notes SET credited_minutes = mins WHERE id = a.note_id;
  END IF;
END $$;

-- ── 9. Offline edits that arrive after a lock ────────────────────────────────
CREATE TABLE IF NOT EXISTS held_edits (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES organizations(id),
    note_id      UUID NOT NULL REFERENCES progress_notes(id),
    user_id      UUID NOT NULL REFERENCES users(id),
    device_id    UUID REFERENCES devices(id),
    mutation_id  UUID UNIQUE NOT NULL,
    payload      JSONB NOT NULL,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status       VARCHAR(10) NOT NULL DEFAULT 'held' CHECK (status IN ('held','applied','rejected')),
    reviewed_by  UUID REFERENCES users(id),
    reviewed_at  TIMESTAMPTZ
);

-- ── 10. Live map and work log ────────────────────────────────────────────────
-- device_pings already exists (001). Add the fields the map and work log need.
ALTER TABLE device_pings ADD COLUMN IF NOT EXISTS note_id UUID;
ALTER TABLE device_pings ADD COLUMN IF NOT EXISTS device_id UUID;
ALTER TABLE device_pings ADD COLUMN IF NOT EXISTS section_key VARCHAR(60);   -- what they were working on

COMMIT;
