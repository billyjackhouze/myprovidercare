-- 018: corrections from reading the PN3.5 layout in NSHCMobile48 (read-only).
--  * fm [743] is not on the form; the slot is [501] "Coordination of Services/Linkage".
--  * Late-entry block ([699] checkbox + Date1000Rep[122]) kept as a separate flag and date.
-- The note guard (nc_attach_note_guard on pn2_data) is column-generic, so no guard change.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='pn2_data' AND column_name='focus_therapy') THEN
    ALTER TABLE pn2_data RENAME COLUMN focus_therapy TO focus_coordination_linkage;
  END IF;
END $$;
COMMENT ON COLUMN pn2_data.focus_coordination_linkage IS 'fm Text1000Rep[501] Coordination of Services/Linkage';

ALTER TABLE pn2_data
  ADD COLUMN IF NOT EXISTS late_entry      BOOLEAN NOT NULL DEFAULT FALSE,  -- fm Text1000Rep[699]
  ADD COLUMN IF NOT EXISTS late_entry_date DATE;                            -- fm Date1000Rep[122]

ALTER TABLE pn2_data DROP CONSTRAINT IF EXISTS pn2_late_entry_date_chk;
ALTER TABLE pn2_data ADD CONSTRAINT pn2_late_entry_date_chk
  CHECK (late_entry OR late_entry_date IS NULL);

COMMENT ON COLUMN pn2_data.client_signature_s3_key IS
  'Client signature image, locked with the note. Source container in the old file unconfirmed (Container10Rep[3] likely); new app captures it directly.';

COMMIT;
