-- Migration 017: PN2 progress note and the four risk screenings as typed tables
-- Replaces the repeating-field design (Text1000Rep, Date1000Rep, Numb1000Rep,
-- Broset Number 1000, Fall Number 1000) with one column per answer.
--
-- Every table hangs off progress_notes(id) and carries the lock guard from 016
-- (nc_attach_note_guard), so one lock covers PN2 and all four screenings, and every
-- change goes to field_audit with the server time.
--
-- Not stored here, on purpose:
--   * header date, start time, end time: they come from visits.hipaa_signed_at and
--     visits.photo_taken_at (the clock evidence), never typed.
--   * staff signature: a capture_event of kind 'staff_signature' (016).
--   * PHQ-9 / Fall / Broset totals: generated columns, so they cannot disagree
--     with the answers.
-- Legacy field each column replaces is noted as fm:<field>[slot].

BEGIN;

-- The 016 guard compared every column, including generated ones (which are not yet
-- computed inside a BEFORE trigger). Replace it with a version that skips them.
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
    IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = TG_RELID AND attname = k
               AND attgenerated <> '') THEN CONTINUE; END IF;
    IF (o -> k) IS DISTINCT FROM (w -> k) THEN
      INSERT INTO field_audit (org_id, note_id, user_id, table_name, field_name, old_value, new_value, note_state)
      VALUES (n.org_id, nid, who, TG_TABLE_NAME, k, o ->> k, w ->> k, n.lock_state);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

-- Signature image for capture events (staff / addendum / countersign signatures).
ALTER TABLE capture_events ADD COLUMN IF NOT EXISTS signature_s3_key VARCHAR(500);

-- ── PN2 body ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pn2_data (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id               UUID NOT NULL UNIQUE REFERENCES progress_notes(id) ON DELETE CASCADE,
    org_id                UUID NOT NULL REFERENCES organizations(id),

    -- Provider block, snapshotted from the user at submit (fm:Text1000Rep[39],[37],[38])
    provider_title        VARCHAR(100),
    provider_name         VARCHAR(200),
    provider_credentials  VARCHAR(100),

    -- Medical providers (fm:[90],[91] and Date1000Rep[2],[5],[93],[94])
    psychiatric_provider          VARCHAR(255),
    psychiatric_last_seen         DATE,
    psychiatric_next_visit        DATE,
    primary_care_provider         VARCHAR(255),
    primary_care_last_seen        DATE,
    primary_care_next_visit       DATE,

    service_location      VARCHAR(255),                 -- fm:[100]
    stage_of_change       VARCHAR(100),                 -- fm:[121]

    -- Areas of focus (fm:[504],[743],[503],[1000],[505],[507])
    focus_independent_living  BOOLEAN NOT NULL DEFAULT FALSE,   -- [504]
    focus_therapy             BOOLEAN NOT NULL DEFAULT FALSE,   -- [743]
    focus_recovery_planning   BOOLEAN NOT NULL DEFAULT FALSE,   -- [503]
    focus_crisis_prevention   BOOLEAN NOT NULL DEFAULT FALSE,   -- [1000]
    focus_social_skills       BOOLEAN NOT NULL DEFAULT FALSE,   -- [505]
    focus_medication_services BOOLEAN NOT NULL DEFAULT FALSE,   -- [507]

    -- Risk screening questions: done? + tool + outcome
    screen_self_harm_done     BOOLEAN,  screen_self_harm_tool      VARCHAR(255), screen_self_harm_outcome      TEXT,  -- [130],[131],[132]
    screen_harm_others_done   BOOLEAN,  screen_harm_others_tool    VARCHAR(255), screen_harm_others_outcome    TEXT,  -- [135],[133],[134]
    screen_depression_done    BOOLEAN,  screen_depression_tool     VARCHAR(255), screen_depression_outcome     TEXT,  -- [850],[851],[852]
    screen_fall_risk_done     BOOLEAN,  screen_fall_risk_tool      VARCHAR(255), screen_fall_risk_outcome      TEXT,  -- [853],[854],[855]

    -- Living situation and environment
    lives_alone           VARCHAR(255),                 -- [140]
    lives_with            VARCHAR(255),                 -- [141]
    lives_in_group        VARCHAR(255),                 -- [142]
    environment           VARCHAR(255),                 -- [150]
    environment_other     VARCHAR(255),                 -- [151]

    -- Status of medical and psychiatric appointments
    appts_current         BOOLEAN NOT NULL DEFAULT FALSE,       -- [152]
    appts_past_due        BOOLEAN NOT NULL DEFAULT FALSE,       -- [153]
    no_medical_provider   VARCHAR(255),                         -- [160]
    no_psychiatric_provider VARCHAR(255),                       -- [161]
    appts_details         TEXT,                                 -- [162]
    upcoming_medical      VARCHAR(255),                         -- [163]
    upcoming_psychiatric  VARCHAR(255),                         -- [164]
    upcoming_other        VARCHAR(255),                         -- [165]

    current_status        TEXT,                                 -- [170]
    mood_actions_reactions TEXT,                                -- [180]

    -- Training methods used (fm:[520]..[531])
    tm_rehearsal BOOLEAN NOT NULL DEFAULT FALSE,                -- [520]
    tm_instructions BOOLEAN NOT NULL DEFAULT FALSE,             -- [521]
    tm_handout BOOLEAN NOT NULL DEFAULT FALSE,                  -- [522]
    tm_feedback_shaping BOOLEAN NOT NULL DEFAULT FALSE,         -- [523]
    tm_coaching BOOLEAN NOT NULL DEFAULT FALSE,                 -- [524]
    tm_prompting BOOLEAN NOT NULL DEFAULT FALSE,                -- [525]
    tm_education BOOLEAN NOT NULL DEFAULT FALSE,                -- [526]
    tm_reinforcement BOOLEAN NOT NULL DEFAULT FALSE,            -- [527]
    tm_practice BOOLEAN NOT NULL DEFAULT FALSE,                 -- [528]
    tm_educational_video BOOLEAN NOT NULL DEFAULT FALSE,        -- [529]
    tm_active_listening BOOLEAN NOT NULL DEFAULT FALSE,         -- [530]
    tm_motivational_interviewing BOOLEAN NOT NULL DEFAULT FALSE,-- [531]

    -- Recovery plan aspects addressed (named, non-repeating fields in the old file)
    plan_problem          TEXT,
    plan_goal             TEXT,
    plan_objective        TEXT,
    plan_intervention     TEXT,

    -- Medications section toggles (fm:[569],[570]; which is which is confirmed in 018 check)
    meds_not_reviewed     BOOLEAN NOT NULL DEFAULT FALSE,
    meds_section_flag     BOOLEAN NOT NULL DEFAULT FALSE,

    -- Other issues / evaluation / continuing needs
    other_issues_flag     BOOLEAN NOT NULL DEFAULT FALSE,       -- [580]
    other_issues_text     TEXT,                                 -- [362]
    specific_objectives_text TEXT,                              -- [363]
    evaluation_flag       BOOLEAN NOT NULL DEFAULT FALSE,       -- [581]
    eval_maintain_stability BOOLEAN NOT NULL DEFAULT FALSE,     -- [582]
    eval_assist_progress  BOOLEAN NOT NULL DEFAULT FALSE,       -- [583]
    continuing_needs_flag BOOLEAN NOT NULL DEFAULT FALSE,       -- [584]
    need_interpersonal    BOOLEAN NOT NULL DEFAULT FALSE,       -- [585]
    need_adl              BOOLEAN NOT NULL DEFAULT FALSE,       -- [586]
    need_hygiene          BOOLEAN NOT NULL DEFAULT FALSE,       -- [587]
    need_food_prep        BOOLEAN NOT NULL DEFAULT FALSE,       -- [588]
    need_nutrition        BOOLEAN NOT NULL DEFAULT FALSE,       -- [589]
    need_finances         BOOLEAN NOT NULL DEFAULT FALSE,       -- [590]
    need_inappropriate_behavior BOOLEAN NOT NULL DEFAULT FALSE, -- [591]
    need_health_wellness  BOOLEAN NOT NULL DEFAULT FALSE,       -- [592]
    need_safety           BOOLEAN NOT NULL DEFAULT FALSE,       -- [593]

    -- Place text (reverse-geocoded from the GPS evidence; not typed by staff)
    arrival_address       TEXT,
    departure_address     TEXT,

    -- Client signature image, locked with the note (fm:Container10Rep[426], to confirm)
    client_signature_s3_key VARCHAR(500),

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Medication table on the note: seven rows. A per-note snapshot, so a locked note
-- keeps what was reviewed at the time even if the client's medication list changes.
CREATE TABLE IF NOT EXISTS pn2_medications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id       UUID NOT NULL REFERENCES progress_notes(id) ON DELETE CASCADE,
    row_no        SMALLINT NOT NULL CHECK (row_no BETWEEN 1 AND 7),
    name          VARCHAR(255),        -- fm:[8]..[14]
    route         VARCHAR(100),        -- [355]..[361]
    dosage        VARCHAR(100),        -- [15]..[21]
    frequency     VARCHAR(100),        -- [22]..[28]
    indication    VARCHAR(255),        -- [371]..[377]
    prescribing_md VARCHAR(255),       -- [29]..[35]
    UNIQUE (note_id, row_no)
);

-- ── Fall Risk screening (fm:Fall Number 1000[1..21], Fall Number Total) ─────────
CREATE TABLE IF NOT EXISTS screening_fall_risk (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id       UUID NOT NULL UNIQUE REFERENCES progress_notes(id) ON DELETE CASCADE,
    org_id        UUID NOT NULL REFERENCES organizations(id),
    -- Conditions that stop the score
    deemed_high_fall_risk  BOOLEAN NOT NULL DEFAULT FALSE,   -- [1]
    complete_immobility    BOOLEAN NOT NULL DEFAULT FALSE,   -- [2] (low fall risk)
    -- Age (single-select)
    age_60_69     BOOLEAN NOT NULL DEFAULT FALSE,            -- [3]  1 pt
    age_70_79     BOOLEAN NOT NULL DEFAULT FALSE,            -- [4]  2 pts
    age_80_plus   BOOLEAN NOT NULL DEFAULT FALSE,            -- [5]  3 pts
    -- Fall history
    fall_within_6mo BOOLEAN NOT NULL DEFAULT FALSE,          -- [6]  5 pts
    -- Elimination (single-select)
    elim_incontinence BOOLEAN NOT NULL DEFAULT FALSE,        -- [7]  2 pts
    elim_urgency      BOOLEAN NOT NULL DEFAULT FALSE,        -- [8]  2 pts
    elim_urgency_incontinence BOOLEAN NOT NULL DEFAULT FALSE,-- [9]  4 pts
    -- Medications (single-select)
    meds_one_high_risk BOOLEAN NOT NULL DEFAULT FALSE,       -- [10] 3 pts
    meds_two_plus      BOOLEAN NOT NULL DEFAULT FALSE,       -- [11] 5 pts
    meds_sedated_24h   BOOLEAN NOT NULL DEFAULT FALSE,       -- [12] 7 pts
    -- Patient care equipment (single-select)
    equip_one     BOOLEAN NOT NULL DEFAULT FALSE,            -- [13] 1 pt
    equip_two     BOOLEAN NOT NULL DEFAULT FALSE,            -- [14] 2 pts
    equip_three_plus BOOLEAN NOT NULL DEFAULT FALSE,         -- [15] 3 pts
    -- Mobility (multi-select)
    mob_needs_assist BOOLEAN NOT NULL DEFAULT FALSE,         -- [16] 2 pts
    mob_unsteady     BOOLEAN NOT NULL DEFAULT FALSE,         -- [17] 2 pts
    mob_impairment   BOOLEAN NOT NULL DEFAULT FALSE,         -- [18] 2 pts
    -- Cognition (multi-select)
    cog_altered_awareness BOOLEAN NOT NULL DEFAULT FALSE,    -- [19] 1 pt
    cog_impulsive         BOOLEAN NOT NULL DEFAULT FALSE,    -- [20] 2 pts
    cog_lack_understanding BOOLEAN NOT NULL DEFAULT FALSE,   -- [21] 4 pts
    CHECK (age_60_69::int + age_70_79::int + age_80_plus::int <= 1),
    CHECK (elim_incontinence::int + elim_urgency::int + elim_urgency_incontinence::int <= 1),
    CHECK (meds_one_high_risk::int + meds_two_plus::int + meds_sedated_24h::int <= 1),
    CHECK (equip_one::int + equip_two::int + equip_three_plus::int <= 1),
    total_score SMALLINT GENERATED ALWAYS AS (
        age_60_69::int*1 + age_70_79::int*2 + age_80_plus::int*3 + fall_within_6mo::int*5
      + elim_incontinence::int*2 + elim_urgency::int*2 + elim_urgency_incontinence::int*4
      + meds_one_high_risk::int*3 + meds_two_plus::int*5 + meds_sedated_24h::int*7
      + equip_one::int*1 + equip_two::int*2 + equip_three_plus::int*3
      + mob_needs_assist::int*2 + mob_unsteady::int*2 + mob_impairment::int*2
      + cog_altered_awareness::int*1 + cog_impulsive::int*2 + cog_lack_understanding::int*4
    ) STORED,
    -- Form: 6-13 moderate, >13 high; a checked "deemed high" forces high.
    risk_band VARCHAR(10) GENERATED ALWAYS AS (
        CASE WHEN deemed_high_fall_risk THEN 'high'
             WHEN complete_immobility THEN 'low'
             WHEN (age_60_69::int*1 + age_70_79::int*2 + age_80_plus::int*3 + fall_within_6mo::int*5
      + elim_incontinence::int*2 + elim_urgency::int*2 + elim_urgency_incontinence::int*4
      + meds_one_high_risk::int*3 + meds_two_plus::int*5 + meds_sedated_24h::int*7
      + equip_one::int*1 + equip_two::int*2 + equip_three_plus::int*3
      + mob_needs_assist::int*2 + mob_unsteady::int*2 + mob_impairment::int*2
      + cog_altered_awareness::int*1 + cog_impulsive::int*2 + cog_lack_understanding::int*4) > 13 THEN 'high'
             WHEN (age_60_69::int*1 + age_70_79::int*2 + age_80_plus::int*3 + fall_within_6mo::int*5
      + elim_incontinence::int*2 + elim_urgency::int*2 + elim_urgency_incontinence::int*4
      + meds_one_high_risk::int*3 + meds_two_plus::int*5 + meds_sedated_24h::int*7
      + equip_one::int*1 + equip_two::int*2 + equip_three_plus::int*3
      + mob_needs_assist::int*2 + mob_unsteady::int*2 + mob_impairment::int*2
      + cog_altered_awareness::int*1 + cog_impulsive::int*2 + cog_lack_understanding::int*4) >= 6 THEN 'moderate'
             ELSE 'low' END
    ) STORED
);

-- ── Broset Violence Checklist (fm:Broset Number 1000[1..6], Broset Number Total) ─
CREATE TABLE IF NOT EXISTS screening_broset (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id       UUID NOT NULL UNIQUE REFERENCES progress_notes(id) ON DELETE CASCADE,
    org_id        UUID NOT NULL REFERENCES organizations(id),
    confused          BOOLEAN NOT NULL DEFAULT FALSE,   -- [1]
    irritable         BOOLEAN NOT NULL DEFAULT FALSE,   -- [2]
    boisterous        BOOLEAN NOT NULL DEFAULT FALSE,   -- [3]
    verbal_threats    BOOLEAN NOT NULL DEFAULT FALSE,   -- [4]
    physical_threats  BOOLEAN NOT NULL DEFAULT FALSE,   -- [5]
    attacking_objects BOOLEAN NOT NULL DEFAULT FALSE,   -- [6]
    total_score SMALLINT GENERATED ALWAYS AS (
        confused::int + irritable::int + boisterous::int
      + verbal_threats::int + physical_threats::int + attacking_objects::int) STORED,
    -- Form: 0 small, 1-2 moderate, 3-6 high
    risk_band VARCHAR(10) GENERATED ALWAYS AS (
        CASE WHEN (confused::int + irritable::int + boisterous::int
                 + verbal_threats::int + physical_threats::int + attacking_objects::int) = 0 THEN 'small'
             WHEN (confused::int + irritable::int + boisterous::int
                 + verbal_threats::int + physical_threats::int + attacking_objects::int) <= 2 THEN 'moderate'
             ELSE 'high' END) STORED
);

-- ── PHQ-9 (fm:Numb1000Rep[800..808], Total, difficulty boxes) ───────────────────
CREATE TABLE IF NOT EXISTS screening_phq9 (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id       UUID NOT NULL UNIQUE REFERENCES progress_notes(id) ON DELETE CASCADE,
    org_id        UUID NOT NULL REFERENCES organizations(id),
    q1_interest   SMALLINT CHECK (q1_interest   BETWEEN 0 AND 3),   -- [800]
    q2_depressed  SMALLINT CHECK (q2_depressed  BETWEEN 0 AND 3),   -- [801]
    q3_sleep      SMALLINT CHECK (q3_sleep      BETWEEN 0 AND 3),   -- [802]
    q4_energy     SMALLINT CHECK (q4_energy     BETWEEN 0 AND 3),   -- [803]
    q5_appetite   SMALLINT CHECK (q5_appetite   BETWEEN 0 AND 3),   -- [804]
    q6_self_worth SMALLINT CHECK (q6_self_worth BETWEEN 0 AND 3),   -- [805]
    q7_concentration SMALLINT CHECK (q7_concentration BETWEEN 0 AND 3), -- [806]
    q8_psychomotor SMALLINT CHECK (q8_psychomotor BETWEEN 0 AND 3), -- [807]
    q9_self_harm_thoughts SMALLINT CHECK (q9_self_harm_thoughts BETWEEN 0 AND 3), -- [808]
    difficulty    VARCHAR(20) CHECK (difficulty IN
                  ('not_difficult','somewhat','very','extremely')),
    total_score   SMALLINT GENERATED ALWAYS AS (
        COALESCE(q1_interest,0) + COALESCE(q2_depressed,0) + COALESCE(q3_sleep,0)
      + COALESCE(q4_energy,0) + COALESCE(q5_appetite,0) + COALESCE(q6_self_worth,0)
      + COALESCE(q7_concentration,0) + COALESCE(q8_psychomotor,0)
      + COALESCE(q9_self_harm_thoughts,0)) STORED,
    -- Standard PHQ-9 bands
    severity VARCHAR(20) GENERATED ALWAYS AS (
        CASE WHEN (COALESCE(q1_interest,0) + COALESCE(q2_depressed,0) + COALESCE(q3_sleep,0)
      + COALESCE(q4_energy,0) + COALESCE(q5_appetite,0) + COALESCE(q6_self_worth,0)
      + COALESCE(q7_concentration,0) + COALESCE(q8_psychomotor,0)
      + COALESCE(q9_self_harm_thoughts,0)) >= 20 THEN 'severe'
             WHEN (COALESCE(q1_interest,0) + COALESCE(q2_depressed,0) + COALESCE(q3_sleep,0)
      + COALESCE(q4_energy,0) + COALESCE(q5_appetite,0) + COALESCE(q6_self_worth,0)
      + COALESCE(q7_concentration,0) + COALESCE(q8_psychomotor,0)
      + COALESCE(q9_self_harm_thoughts,0)) >= 15 THEN 'moderately_severe'
             WHEN (COALESCE(q1_interest,0) + COALESCE(q2_depressed,0) + COALESCE(q3_sleep,0)
      + COALESCE(q4_energy,0) + COALESCE(q5_appetite,0) + COALESCE(q6_self_worth,0)
      + COALESCE(q7_concentration,0) + COALESCE(q8_psychomotor,0)
      + COALESCE(q9_self_harm_thoughts,0)) >= 10 THEN 'moderate'
             WHEN (COALESCE(q1_interest,0) + COALESCE(q2_depressed,0) + COALESCE(q3_sleep,0)
      + COALESCE(q4_energy,0) + COALESCE(q5_appetite,0) + COALESCE(q6_self_worth,0)
      + COALESCE(q7_concentration,0) + COALESCE(q8_psychomotor,0)
      + COALESCE(q9_self_harm_thoughts,0)) >= 5 THEN 'mild'
             ELSE 'minimal' END) STORED,
    -- Item 9 above zero needs same-day attention; generated so it is never missed
    q9_positive   BOOLEAN GENERATED ALWAYS AS (COALESCE(q9_self_harm_thoughts,0) > 0) STORED
);

-- ── Columbia-Suicide Severity Rating Scale, screen version ──────────────────────
-- fm:Broset Number 1000[600,601,602,605,606,607]; slots 603/604 were never used.
-- Past-month yes/no. NULL = not asked (questions 3-5 are skipped when Q2 is No).
CREATE TABLE IF NOT EXISTS screening_columbia (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id       UUID NOT NULL UNIQUE REFERENCES progress_notes(id) ON DELETE CASCADE,
    org_id        UUID NOT NULL REFERENCES organizations(id),
    q1_wish_dead              BOOLEAN,   -- [600]
    q2_suicidal_thoughts      BOOLEAN,   -- [601]
    q3_method                 BOOLEAN,   -- [602]
    q4_intent                 BOOLEAN,   -- [605]
    q5_intent_with_plan       BOOLEAN,   -- [606]
    q6_behavior               BOOLEAN,   -- [607]
    any_yes BOOLEAN GENERATED ALWAYS AS (
        COALESCE(q1_wish_dead,FALSE) OR COALESCE(q2_suicidal_thoughts,FALSE)
     OR COALESCE(q3_method,FALSE) OR COALESCE(q4_intent,FALSE)
     OR COALESCE(q5_intent_with_plan,FALSE) OR COALESCE(q6_behavior,FALSE)) STORED
);

-- ── Attach the one lock guard to every note data table ──────────────────────────
SELECT nc_attach_note_guard('pn2_data');
SELECT nc_attach_note_guard('pn2_medications');
SELECT nc_attach_note_guard('screening_fall_risk');
SELECT nc_attach_note_guard('screening_broset');
SELECT nc_attach_note_guard('screening_phq9');
SELECT nc_attach_note_guard('screening_columbia');

COMMIT;
