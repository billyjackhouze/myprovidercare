// Progress note (PN2) sections. Field names match pn2_data columns (migrations 017/018).
// `required` is a client-side convenience only; the database stays the authority on locking.
// Field types: text, area, date, bool, select.

const B = (key, label) => ({ key, label, type: 'bool' })
const T = (key, label, extra = {}) => ({ key, label, type: 'text', ...extra })
const A = (key, label, extra = {}) => ({ key, label, type: 'area', ...extra })
const D = (key, label) => ({ key, label, type: 'date' })

export const STAGES_OF_CHANGE = [
  'Precontemplation', 'Contemplation', 'Preparation', 'Action', 'Maintenance',
]

export const PN2_SECTIONS = [
  {
    id: 'header', title: 'Provider and location',
    required: ['service_location', 'stage_of_change'],
    fields: [
      T('provider_title', 'Provider title'), T('provider_name', 'Provider name'),
      T('provider_credentials', 'Credentials'),
      T('service_location', 'Service location'),
      { key: 'stage_of_change', label: 'Stage of change', type: 'select', options: STAGES_OF_CHANGE },
    ],
  },
  {
    id: 'focus', title: 'Areas of focus', requireAny: [
      'focus_independent_living', 'focus_coordination_linkage', 'focus_recovery_planning',
      'focus_crisis_prevention', 'focus_social_skills', 'focus_medication_services'],
    hint: 'Choose at least one.',
    fields: [
      B('focus_coordination_linkage', 'Coordination / linkage'),
      B('focus_independent_living', 'Independent living'),
      B('focus_recovery_planning', 'Recovery planning'),
      B('focus_crisis_prevention', 'Crisis prevention'),
      B('focus_social_skills', 'Social skills'),
      B('focus_medication_services', 'Medication services'),
    ],
  },
  {
    id: 'providers', title: 'Providers and appointments', required: [],
    fields: [
      T('psychiatric_provider', 'Psychiatric provider'),
      D('psychiatric_last_seen', 'Last seen'), D('psychiatric_next_visit', 'Next visit'),
      T('primary_care_provider', 'Primary care provider'),
      D('primary_care_last_seen', 'Last seen'), D('primary_care_next_visit', 'Next visit'),
      B('appts_current', 'Appointments current'), B('appts_past_due', 'Appointments past due'),
      T('no_medical_provider', 'No medical provider (note)'),
      T('no_psychiatric_provider', 'No psychiatric provider (note)'),
      A('appts_details', 'Appointment details'),
      T('upcoming_medical', 'Upcoming medical'), T('upcoming_psychiatric', 'Upcoming psychiatric'),
      T('upcoming_other', 'Upcoming other'),
    ],
  },
  {
    id: 'risk', title: 'Risk screening questions', required: [],
    fields: [
      ['self_harm', 'Self-harm'], ['harm_others', 'Harm to others'],
      ['depression', 'Depression'], ['fall_risk', 'Fall risk'],
    ].flatMap(([k, l]) => [
      B(`screen_${k}_done`, `${l}: screened`),
      T(`screen_${k}_tool`, `${l}: tool used`),
      A(`screen_${k}_outcome`, `${l}: outcome`),
    ]),
  },
  {
    id: 'living', title: 'Living situation and environment', required: ['environment'],
    fields: [
      T('lives_alone', 'Lives alone'), T('lives_with', 'Lives with'),
      T('lives_in_group', 'Lives in group setting'),
      T('environment', 'Environment'), T('environment_other', 'Environment, other'),
    ],
  },
  {
    id: 'status', title: 'Status and mood', required: ['current_status', 'mood_actions_reactions'],
    fields: [
      A('current_status', 'Current status', { rows: 6 }),
      A('mood_actions_reactions', 'Mood, actions and reactions', { rows: 6 }),
    ],
  },
  {
    id: 'methods', title: 'Training methods used', requireAny: [
      'tm_rehearsal', 'tm_instructions', 'tm_handout', 'tm_feedback_shaping', 'tm_coaching',
      'tm_prompting', 'tm_education', 'tm_reinforcement', 'tm_practice', 'tm_educational_video',
      'tm_active_listening', 'tm_motivational_interviewing'],
    hint: 'Choose at least one.',
    fields: [
      B('tm_rehearsal', 'Rehearsal'), B('tm_instructions', 'Instructions'),
      B('tm_handout', 'Handout'), B('tm_feedback_shaping', 'Feedback / shaping'),
      B('tm_coaching', 'Coaching'), B('tm_prompting', 'Prompting'),
      B('tm_education', 'Education'), B('tm_reinforcement', 'Reinforcement'),
      B('tm_practice', 'Practice'), B('tm_educational_video', 'Educational video'),
      B('tm_active_listening', 'Active listening'),
      B('tm_motivational_interviewing', 'Motivational interviewing'),
    ],
  },
  {
    id: 'plan', title: 'Recovery plan aspects addressed',
    required: ['plan_problem', 'plan_goal', 'plan_objective', 'plan_intervention'],
    fields: [
      A('plan_problem', 'Problem'), A('plan_goal', 'Goal'),
      A('plan_objective', 'Objective'), A('plan_intervention', 'Intervention'),
    ],
  },
  { id: 'meds', title: 'Medications', special: 'meds', required: [] },
  {
    id: 'other', title: 'Other issues and objectives', required: [],
    fields: [
      B('other_issues_flag', 'Other issues addressed'),
      A('other_issues_text', 'Other issues'),
      A('specific_objectives_text', 'Specific objectives'),
    ],
  },
  {
    id: 'evaluation', title: 'Evaluation and continuing needs', required: [],
    fields: [
      B('evaluation_flag', 'Evaluation completed'),
      B('eval_maintain_stability', 'Maintaining stability'),
      B('eval_assist_progress', 'Assist with progress'),
      B('continuing_needs_flag', 'Continuing needs'),
      B('need_interpersonal', 'Interpersonal'), B('need_adl', 'Activities of daily living'),
      B('need_hygiene', 'Hygiene'), B('need_food_prep', 'Food preparation'),
      B('need_nutrition', 'Nutrition'), B('need_finances', 'Finances'),
      B('need_inappropriate_behavior', 'Inappropriate behavior'),
      B('need_health_wellness', 'Health and wellness'), B('need_safety', 'Safety'),
    ],
  },
  {
    id: 'late', title: 'Late entry', required: [], lateRule: true,
    fields: [
      B('late_entry', 'This is a late entry'),
      D('late_entry_date', 'Date the service happened'),
    ],
  },
  { id: 'screenings', title: 'Risk screening tools', special: 'screenings', required: [] },
]

export const MED_FIELDS = [
  ['name', 'Medication'], ['dosage', 'Dosage'], ['route', 'Route'],
  ['frequency', 'Frequency'], ['indication', 'Indication'], ['prescribing_md', 'Prescriber'],
]

const yn = (k, l) => ({ key: k, label: l })
export const SCREENINGS = {
  fall_risk: {
    title: 'Fall risk',
    groups: [
      { label: 'General', items: [yn('deemed_high_fall_risk', 'Deemed high fall risk'), yn('complete_immobility', 'Complete immobility'), yn('fall_within_6mo', 'Fall within 6 months')] },
      { label: 'Age', single: true, items: [yn('age_60_69', '60 to 69'), yn('age_70_79', '70 to 79'), yn('age_80_plus', '80 or older')] },
      { label: 'Elimination', single: true, items: [yn('elim_incontinence', 'Incontinence'), yn('elim_urgency', 'Urgency'), yn('elim_urgency_incontinence', 'Urgency and incontinence')] },
      { label: 'Medications', single: true, items: [yn('meds_one_high_risk', 'One high-risk medication'), yn('meds_two_plus', 'Two or more'), yn('meds_sedated_24h', 'Sedated in past 24 hours')] },
      { label: 'Equipment', single: true, items: [yn('equip_one', 'One piece'), yn('equip_two', 'Two pieces'), yn('equip_three_plus', 'Three or more')] },
      { label: 'Mobility', items: [yn('mob_needs_assist', 'Needs assistance'), yn('mob_unsteady', 'Unsteady'), yn('mob_impairment', 'Impairment')] },
      { label: 'Cognition', items: [yn('cog_altered_awareness', 'Altered awareness'), yn('cog_impulsive', 'Impulsive'), yn('cog_lack_understanding', 'Lacks understanding of limits')] },
    ],
  },
  broset: {
    title: 'Broset violence checklist',
    groups: [{ label: 'Observed in the last 24 hours', items: [
      yn('confused', 'Confused'), yn('irritable', 'Irritable'), yn('boisterous', 'Boisterous'),
      yn('verbal_threats', 'Verbal threats'), yn('physical_threats', 'Physical threats'),
      yn('attacking_objects', 'Attacking objects')] }],
  },
  phq9: {
    title: 'PHQ-9',
    scale: [
      ['q1_interest', 'Little interest or pleasure in doing things'],
      ['q2_depressed', 'Feeling down, depressed or hopeless'],
      ['q3_sleep', 'Trouble sleeping, or sleeping too much'],
      ['q4_energy', 'Feeling tired or having little energy'],
      ['q5_appetite', 'Poor appetite or overeating'],
      ['q6_self_worth', 'Feeling bad about yourself'],
      ['q7_concentration', 'Trouble concentrating'],
      ['q8_psychomotor', 'Moving or speaking slowly, or restless'],
      ['q9_self_harm_thoughts', 'Thoughts of being better off dead or of self-harm'],
    ],
    options: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'],
    difficulty: ['not_difficult', 'somewhat', 'very', 'extremely'],
  },
  columbia: {
    title: 'Columbia suicide severity',
    groups: [{ label: 'In the past month', tri: true, items: [
      yn('q1_wish_dead', 'Wished to be dead'), yn('q2_suicidal_thoughts', 'Suicidal thoughts'),
      yn('q3_method', 'Thought of a method'), yn('q4_intent', 'Had intent'),
      yn('q5_intent_with_plan', 'Intent with a plan'), yn('q6_behavior', 'Suicidal behavior')] }],
  },
}

// Is a section filled in enough to show green?
export function sectionState(sec, data, touched) {
  if (sec.special) return touched ? 'done' : 'todo'
  const has = (k) => {
    const v = data?.[k]
    return v !== null && v !== undefined && String(v).trim() !== '' && v !== false
  }
  if (sec.requireAny) return sec.requireAny.some(has) ? 'done' : 'todo'
  if (sec.lateRule) return data?.late_entry && !data?.late_entry_date ? 'todo' : (touched ? 'done' : 'todo')
  if (sec.required?.length) return sec.required.every(has) ? 'done' : 'todo'
  return touched ? 'done' : 'todo'
}
