/**
 * IntakeTab — Biopsychosocial Assessment visit log + full form
 * Matches National SmartHealthCare Services Rev.11.11.2019 intake form (23 pages)
 *
 * Usage: <IntakeTab clientId={clientId} client={client} />
 */
import { useEffect, useState, useCallback } from 'react'
import {
  IconPlus, IconLoader2, IconDeviceFloppy, IconCheck,
  IconChevronDown, IconChevronUp, IconArrowLeft,
  IconFileText, IconTrash, IconUser,
} from '@tabler/icons-react'
import api from '@/lib/api'

// ─── Visit list ───────────────────────────────────────────────────────────────

export default function IntakeTab({ clientId, client }) {
  const [visits, setVisits]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [openId, setOpenId]     = useState(null)   // null = list view

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/clients/${clientId}/intake`)
      setVisits(r.data)
    } catch {}
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])

  const handleNew = async () => {
    const r = await api.post(`/clients/${clientId}/intake`, {})
    setOpenId(r.data.id)
    load()
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Delete this assessment?')) return
    await api.delete(`/clients/${clientId}/intake/${id}`)
    load()
  }

  // ── Form open ──
  if (openId) {
    return (
      <AssessmentForm
        clientId={clientId}
        visitId={openId}
        client={client}
        onClose={() => { setOpenId(null); load() }}
      />
    )
  }

  // ── Visit list ──
  if (loading) return (
    <div className="flex items-center gap-2 text-muted py-12 justify-center">
      <IconLoader2 size={18} className="animate-spin" /> Loading assessments…
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-heading">Biopsychosocial Assessments</h2>
        <button
          onClick={handleNew}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          <IconPlus size={14} /> New Assessment
        </button>
      </div>

      {/* Table */}
      {visits.length === 0 ? (
        <div className="border border-dashed border-border rounded-card py-14 text-center">
          <IconFileText size={28} className="text-muted mx-auto mb-2" />
          <p className="text-sm font-medium text-heading mb-1">No assessments on file</p>
          <p className="text-xs text-muted mb-4">Start a new Biopsychosocial Assessment to begin intake.</p>
          <button onClick={handleNew} className="btn-primary text-sm flex items-center gap-1.5 mx-auto">
            <IconPlus size={14} /> New Assessment
          </button>
        </div>
      ) : (
        <div className="border border-border rounded-card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-page border-b border-border">
                <th className="text-left px-3 py-2 text-muted font-medium">Visit Date</th>
                <th className="text-left px-3 py-2 text-muted font-medium">Case Manager</th>
                <th className="text-left px-3 py-2 text-muted font-medium">Visit Start</th>
                <th className="text-left px-3 py-2 text-muted font-medium">Visit End</th>
                <th className="text-left px-3 py-2 text-muted font-medium">Total Time</th>
                <th className="text-left px-3 py-2 text-muted font-medium">Status</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visits.map(v => (
                <tr
                  key={v.id}
                  onClick={() => setOpenId(v.id)}
                  className="hover:bg-page cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2.5 font-medium text-heading">
                    {v.visit_date ? new Date(v.visit_date + 'T00:00').toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-heading">{v.case_manager || '—'}</td>
                  <td className="px-3 py-2.5 text-muted">{v.visit_start || '—'}</td>
                  <td className="px-3 py-2.5 text-muted">{v.visit_end || '—'}</td>
                  <td className="px-3 py-2.5 text-muted">{v.total_time || '—'}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="px-2 py-2.5">
                    <button
                      onClick={e => handleDelete(v.id, e)}
                      className="text-muted hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <IconTrash size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    draft:    'bg-slate-100 text-slate-600',
    complete: 'bg-blue-100 text-blue-700',
    signed:   'bg-emerald-100 text-emerald-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${map[status] || map.draft}`}>
      {status}
    </span>
  )
}


// ─── Full assessment form ─────────────────────────────────────────────────────

function AssessmentForm({ clientId, visitId, client, onClose }) {
  const [visit,   setVisit]   = useState(null)
  const [fd,      setFd]      = useState({})   // form_data
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/clients/${clientId}/intake/${visitId}`)
      setVisit(r.data)
      setFd(r.data.form_data || {})
    } catch { setError('Failed to load assessment.') }
    setLoading(false)
  }, [clientId, visitId])

  useEffect(() => { load() }, [load])

  const f = (key) => fd[key] ?? ''
  const s = (key) => (val) => setFd(p => ({ ...p, [key]: val }))

  const handleSave = async (status = null) => {
    setSaving(true)
    try {
      await api.put(`/clients/${clientId}/intake/${visitId}`, {
        visit_date:          visit?.visit_date,
        case_manager:        visit?.case_manager,
        visit_start:         visit?.visit_start,
        visit_end:           visit?.visit_end,
        assessor_name:       visit?.assessor_name,
        assessor_credentials: visit?.assessor_credentials,
        form_data:           fd,
        status:              status || visit?.status || 'draft',
        signed_by:           status === 'signed' ? (visit?.assessor_name || '') : null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      if (status) setVisit(p => ({ ...p, status }))
    } catch { setError('Save failed.') }
    setSaving(false)
  }

  const sv = (key) => (val) => setVisit(p => ({ ...p, [key]: val }))

  if (loading) return (
    <div className="flex items-center gap-2 text-muted py-12 justify-center">
      <IconLoader2 size={18} className="animate-spin" /> Loading assessment…
    </div>
  )

  return (
    <div>
      {/* Sticky top bar */}
      <div className="flex items-center justify-between mb-5 sticky top-0 bg-card z-10 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-muted hover:text-heading transition-colors">
            <IconArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-base font-semibold text-heading">Biopsychosocial Assessment</h2>
            <p className="text-xs text-muted">
              {client?.first_name} {client?.last_name}
              {visit?.visit_date ? ` · ${new Date(visit.visit_date + 'T00:00').toLocaleDateString()}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><IconCheck size={12} />Saved</span>}
          {error && <span className="text-xs text-red-500">{error}</span>}
          <StatusBadge status={visit?.status} />
          {visit?.status !== 'signed' && (
            <button
              onClick={() => handleSave('complete')}
              disabled={saving}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Mark Complete
            </button>
          )}
          {visit?.status === 'complete' && (
            <button
              onClick={() => handleSave('signed')}
              disabled={saving}
              className="btn-secondary text-xs px-3 py-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            >
              Sign
            </button>
          )}
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconDeviceFloppy size={14} />}
            Save
          </button>
        </div>
      </div>

      {/* Visit header fields */}
      <Section title="Assessment Header" defaultOpen>
        <div className="grid grid-cols-12 gap-3">
          <F label="Assessor Name" className="col-span-4">
            <TI value={visit?.assessor_name || ''} onChange={sv('assessor_name')} />
          </F>
          <F label="Credentials" className="col-span-3">
            <TI value={visit?.assessor_credentials || ''} onChange={sv('assessor_credentials')} />
          </F>
          <F label="Visit Date" className="col-span-2">
            <TI type="date" value={visit?.visit_date || ''} onChange={sv('visit_date')} />
          </F>
          <F label="Visit Start" className="col-span-1">
            <TI type="time" value={visit?.visit_start || ''} onChange={sv('visit_start')} />
          </F>
          <F label="Visit End" className="col-span-1">
            <TI type="time" value={visit?.visit_end || ''} onChange={sv('visit_end')} />
          </F>
          <F label="Case Manager" className="col-span-1">
            <TI value={visit?.case_manager || ''} onChange={sv('case_manager')} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 1: Demographics ─────────────────────────────────────────── */}
      <Section title="Demographics">
        <div className="grid grid-cols-12 gap-3">
          <F label="Client Name" className="col-span-4">
            <div className="field-input bg-page text-muted cursor-not-allowed">
              {client?.last_name}, {client?.first_name}
            </div>
          </F>
          <F label="Date of Assessment" className="col-span-3">
            <TI type="date" value={f('demo_assessment_date')} onChange={s('demo_assessment_date')} />
          </F>
          <F label="Phone #" className="col-span-2">
            <div className="field-input bg-page text-muted">{client?.phone_primary || '—'}</div>
          </F>
          <F label="Date of Birth" className="col-span-3">
            <div className="field-input bg-page text-muted">{client?.dob || '—'}</div>
          </F>

          <F label="Current Street Address" className="col-span-6">
            <TI value={f('demo_street')} onChange={s('demo_street')} />
          </F>
          <F label="City / State" className="col-span-3">
            <TI value={f('demo_city_state')} onChange={s('demo_city_state')} />
          </F>
          <F label="Zip Code" className="col-span-2">
            <TI value={f('demo_zip')} onChange={s('demo_zip')} />
          </F>
          <F label="How Long at Address" className="col-span-1">
            <TI value={f('demo_address_duration')} onChange={s('demo_address_duration')} />
          </F>

          <F label="Marital / Relationship Status" className="col-span-4">
            <TI value={f('demo_marital_status')} onChange={s('demo_marital_status')} />
          </F>
          <F label="Nation / Tribe / Ethnicity" className="col-span-4">
            <TI value={f('demo_ethnicity')} onChange={s('demo_ethnicity')} />
          </F>
          <F label="Primary Language" className="col-span-4">
            <TI value={f('demo_language')} onChange={s('demo_language')} />
          </F>

          <F label="Veteran?" className="col-span-2">
            <YesNo value={f('demo_veteran')} onChange={s('demo_veteran')} />
          </F>
          <F label="Branch of Service" className="col-span-4">
            <TI value={f('demo_branch')} onChange={s('demo_branch')} />
          </F>
          <F label="Type of Discharge" className="col-span-3">
            <SI value={f('demo_discharge')} onChange={s('demo_discharge')}
              options={['Honorable','Dishonorable','General','Other Than Honorable']} />
          </F>
          <F label="If Dishonorable, Why?" className="col-span-3">
            <TI value={f('demo_discharge_reason')} onChange={s('demo_discharge_reason')} />
          </F>

          <F label="Adult Day Care?" className="col-span-2">
            <YesNo value={f('demo_adult_daycare')} onChange={s('demo_adult_daycare')} />
          </F>
          <F label="Day Care Name" className="col-span-4">
            <TI value={f('demo_daycare_name')} onChange={s('demo_daycare_name')} />
          </F>
          <F label="Location" className="col-span-3">
            <TI value={f('demo_daycare_location')} onChange={s('demo_daycare_location')} />
          </F>
          <F label="Days Attending" className="col-span-3">
            <TI value={f('demo_daycare_days')} onChange={s('demo_daycare_days')} />
          </F>

          <F label="Secure Caregiver?" className="col-span-2">
            <YesNo value={f('demo_caregiver')} onChange={s('demo_caregiver')} />
          </F>
          <F label="Caregiver Name" className="col-span-4">
            <TI value={f('demo_caregiver_name')} onChange={s('demo_caregiver_name')} />
          </F>
          <F label="Relationship to Consumer" className="col-span-3">
            <TI value={f('demo_caregiver_rel')} onChange={s('demo_caregiver_rel')} />
          </F>
          <F label="Caregiver Contact Info" className="col-span-3">
            <TI value={f('demo_caregiver_contact')} onChange={s('demo_caregiver_contact')} />
          </F>

          <div className="col-span-full">
            <label className="field-label">Diagnosis (Per Medical Records)</label>
            <div className="flex flex-wrap gap-3 mt-1">
              {['MCO','Provider','Hospital'].map(src => (
                <label key={src} className="flex items-center gap-1.5 text-sm text-heading cursor-pointer">
                  <input type="checkbox"
                    checked={!!(fd['demo_dx_source'] || []).includes(src)}
                    onChange={e => {
                      const arr = [...(fd['demo_dx_source'] || [])]
                      if (e.target.checked) arr.push(src)
                      else arr.splice(arr.indexOf(src), 1)
                      s('demo_dx_source')(arr)
                    }}
                    className="accent-blue-600" />
                  {src}
                </label>
              ))}
            </div>
          </div>
          <F label="Date of Documented Diagnosis" className="col-span-3">
            <TI type="date" value={f('demo_dx_date')} onChange={s('demo_dx_date')} />
          </F>
          <div className="col-span-full">
            <div className="flex flex-wrap gap-3">
              {['Schizophrenia','Schizoaffective','Bipolar','Major Depressive','Other'].map(dx => (
                <label key={dx} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox"
                    checked={!!(fd['demo_dx_types'] || []).includes(dx)}
                    onChange={e => {
                      const arr = [...(fd['demo_dx_types'] || [])]
                      if (e.target.checked) arr.push(dx)
                      else arr.splice(arr.indexOf(dx), 1)
                      s('demo_dx_types')(arr)
                    }}
                    className="accent-blue-600" />
                  {dx}
                </label>
              ))}
            </div>
          </div>
          <F label="Other Diagnosis" className="col-span-6">
            <TI value={f('demo_dx_other')} onChange={s('demo_dx_other')} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 2: Sources of Information ──────────────────────────────── */}
      <Section title="Sources of Information">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-full">
            <label className="field-label mb-1 block">Sources (Name / Relationship / Phone)</label>
            <div className="border border-border rounded-card overflow-hidden text-xs">
              <table className="w-full">
                <thead><tr className="bg-page border-b border-border">
                  <th className="text-left px-3 py-2 text-muted font-medium">Name</th>
                  <th className="text-left px-3 py-2 text-muted font-medium">Relationship</th>
                  <th className="text-left px-3 py-2 text-muted font-medium">Phone Number</th>
                </tr></thead>
                <tbody>
                  {[0,1,2].map(i => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1.5"><input type="text" value={(fd['sources'] || [])[i]?.name || ''} onChange={e => { const a = [...(fd['sources'] || [{},{},{}])]; a[i] = {...(a[i]||{}), name: e.target.value}; s('sources')(a) }} className="field-input text-xs py-1" /></td>
                      <td className="px-2 py-1.5"><input type="text" value={(fd['sources'] || [])[i]?.rel || ''} onChange={e => { const a = [...(fd['sources'] || [{},{},{}])]; a[i] = {...(a[i]||{}), rel: e.target.value}; s('sources')(a) }} className="field-input text-xs py-1" /></td>
                      <td className="px-2 py-1.5"><input type="text" value={(fd['sources'] || [])[i]?.phone || ''} onChange={e => { const a = [...(fd['sources'] || [{},{},{}])]; a[i] = {...(a[i]||{}), phone: e.target.value}; s('sources')(a) }} className="field-input text-xs py-1" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <F label="Guardian?" className="col-span-2">
            <YesNo value={f('src_guardian')} onChange={s('src_guardian')} />
          </F>
          <F label="Guardian Name" className="col-span-3">
            <TI value={f('src_guardian_name')} onChange={s('src_guardian_name')} />
          </F>
          <F label="Relationship" className="col-span-3">
            <TI value={f('src_guardian_rel')} onChange={s('src_guardian_rel')} />
          </F>
          <F label="Guardian Phone" className="col-span-4">
            <TI value={f('src_guardian_phone')} onChange={s('src_guardian_phone')} />
          </F>
          <F label="Payee?" className="col-span-2">
            <YesNo value={f('src_payee')} onChange={s('src_payee')} />
          </F>
          <F label="Payee Name" className="col-span-3">
            <TI value={f('src_payee_name')} onChange={s('src_payee_name')} />
          </F>
          <F label="Relationship" className="col-span-3">
            <TI value={f('src_payee_rel')} onChange={s('src_payee_rel')} />
          </F>
          <F label="Payee Phone" className="col-span-4">
            <TI value={f('src_payee_phone')} onChange={s('src_payee_phone')} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 3: Referral Information ────────────────────────────────── */}
      <Section title="Referral Information">
        <div className="grid grid-cols-12 gap-3">
          <F label="Date of Referral" className="col-span-3">
            <TI type="date" value={f('ref_date')} onChange={s('ref_date')} />
          </F>
          <F label="Discharge from Hospitalization" className="col-span-3">
            <TI type="date" value={f('ref_discharge_date')} onChange={s('ref_discharge_date')} />
          </F>
          <F label="Name & Location of Hospital" className="col-span-6">
            <TI value={f('ref_hospital')} onChange={s('ref_hospital')} />
          </F>
          <div className="col-span-full">
            <label className="field-label mb-1 block">Reason for Referral</label>
            <div className="flex flex-wrap gap-4">
              {['Assess need for Home & Community Based Services – PSR','Medication Management','Other'].map(r => (
                <label key={r} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox"
                    checked={!!(fd['ref_reasons'] || []).includes(r)}
                    onChange={e => {
                      const arr = [...(fd['ref_reasons'] || [])]
                      if (e.target.checked) arr.push(r)
                      else arr.splice(arr.indexOf(r), 1)
                      s('ref_reasons')(arr)
                    }}
                    className="accent-blue-600" />
                  {r}
                </label>
              ))}
            </div>
          </div>
          <F label="Other / Explain" className="col-span-full">
            <TI value={f('ref_other')} onChange={s('ref_other')} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 4: Mental Status – General Observations ─────────────────── */}
      <Section title="Mental Status – General Observations">
        <div className="space-y-3">
          {[
            { key: 'ms_appearance', label: 'Appearance',   opts: ['Well groomed','Unkempt','Disheveled','Malodorous'] },
            { key: 'ms_build',      label: 'Build',        opts: ['Average','Thin','Overweight','Obese'] },
            { key: 'ms_demeanor',   label: 'Demeanor',     opts: ['Cooperative','Hostile','Guarded','Withdrawn','Preoccupied','Demanding','Seductive'] },
            { key: 'ms_eye',        label: 'Eye Contact',  opts: ['Average','Decreased','Increased'] },
            { key: 'ms_activity',   label: 'Activity',     opts: ['Average','Decreased','Increased'] },
            { key: 'ms_speech',     label: 'Speech',       opts: ['Clear','Slurred','Rapid','Slow','Pressured','Soft','Loud','Monotone'] },
          ].map(row => (
            <CheckboxRow key={row.key} label={row.label} fieldKey={row.key} opts={row.opts} fd={fd} s={s} />
          ))}
          <F label="Describe">
            <TA value={f('ms_describe')} onChange={s('ms_describe')} rows={2} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 5: Thought Content ──────────────────────────────────────── */}
      <Section title="Thought Content">
        <div className="space-y-3">
          {[
            { key: 'tc_delusions',  label: 'Delusions',    opts: ['None Reported','Grandiose','Persecutory','Somatic','Bizarre','Nihilist','Religious'] },
            { key: 'tc_other',      label: 'Other',        opts: ['None','Poverty of Content','Obsessions','Compulsions','Phobias','Guilt','Anhedonia','Thought Insertion','Ideas of Reference','Thought Broadcasting'] },
            { key: 'tc_self_abuse', label: 'Self-Abuse',   opts: ['None Reported','Suicidal','Self-Mutilation','Intent','Plan'] },
            { key: 'tc_aggressive', label: 'Aggressive',   opts: ['None Reported','Aggressive','Intent','Plan'] },
          ].map(row => (
            <CheckboxRow key={row.key} label={row.label} fieldKey={row.key} opts={row.opts} fd={fd} s={s} />
          ))}
          <F label="Describe / Assess Lethality">
            <TA value={f('tc_describe')} onChange={s('tc_describe')} rows={2} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 6: Perception ───────────────────────────────────────────── */}
      <Section title="Perception">
        <div className="space-y-3">
          {[
            { key: 'perc_hallucinations', label: 'Hallucinations', opts: ['None Reported','Auditory','Visual','Olfactory','Gustatory','Tactile'] },
            { key: 'perc_other',          label: 'Other',          opts: ['None Reported','Illusions','Depersonalization','Derealization'] },
          ].map(row => (
            <CheckboxRow key={row.key} label={row.label} fieldKey={row.key} opts={row.opts} fd={fd} s={s} />
          ))}
          <F label="Describe">
            <TA value={f('perc_describe')} onChange={s('perc_describe')} rows={2} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 7: Thought Process / Mood / Affect / Behavior ───────────── */}
      <Section title="Thought Process, Mood, Affect & Behavior">
        <div className="space-y-3">
          {[
            { key: 'tp_process',  label: 'Thought Process', opts: ['Logical','Goal Oriented','Circumstantial','Tangential','Loose','Rapid Thoughts','Incoherent','Concrete','Blocked','Flight of Ideas','Perseverative','Derailment'] },
            { key: 'tp_mood',     label: 'Mood',            opts: ['Euthymic','Depressed','Anxious','Angry','Euphoric','Irritable'] },
            { key: 'tp_affect',   label: 'Affect',          opts: ['Flat','Inappropriate','Labile','Blunted','Congruent with Mood','Full','Constricted'] },
            { key: 'tp_behavior', label: 'Behavior',        opts: ['No behavior issues','Assaultive','Resistant','Aggressive','Agitated','Hyperactive','Restless','Sleepy','Intrusive'] },
            { key: 'tp_movement', label: 'Movement',        opts: ['None Reported','Akathisia','Tardive Dyskinesia','Yes – EPS'] },
          ].map(row => (
            <CheckboxRow key={row.key} label={row.label} fieldKey={row.key} opts={row.opts} fd={fd} s={s} />
          ))}
          <F label="Describe">
            <TA value={f('tp_describe')} onChange={s('tp_describe')} rows={2} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 8: Cognitive Assessment ─────────────────────────────────── */}
      <Section title="Cognitive Assessment">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-full">
            <label className="field-label mb-1 block">Impairment of:</label>
            <div className="flex flex-wrap gap-4">
              {['Attention/Concentration','Memory','Impaired Judgment','Lacks Insight','Ability to Abstract'].map(opt => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox"
                    checked={!!(fd['cog_impairment'] || []).includes(opt)}
                    onChange={e => {
                      const arr = [...(fd['cog_impairment'] || [])]
                      if (e.target.checked) arr.push(opt)
                      else arr.splice(arr.indexOf(opt), 1)
                      s('cog_impairment')(arr)
                    }}
                    className="accent-blue-600" />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <F label="Basis of Assessment" className="col-span-full">
            <TA value={f('cog_basis')} onChange={s('cog_basis')} rows={2} />
          </F>
          <div className="col-span-full border-t border-border pt-3">
            <label className="field-label mb-2 block">PTSD/Depression Symptoms (present during last 3 months?)</label>
            <div className="flex flex-wrap gap-3">
              {['Depressed mood most of the day','Decreased interest or pleasure','Significant weight change','Sleep problems','Fatigue or loss of energy','Feelings of worthlessness','Difficulty concentrating','Recurring thoughts of death'].map(opt => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer w-full sm:w-auto">
                  <input type="checkbox"
                    checked={!!(fd['ptsd_symptoms'] || []).includes(opt)}
                    onChange={e => {
                      const arr = [...(fd['ptsd_symptoms'] || [])]
                      if (e.target.checked) arr.push(opt)
                      else arr.splice(arr.indexOf(opt), 1)
                      s('ptsd_symptoms')(arr)
                    }}
                    className="accent-blue-600" />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── SECTION 9: Trauma / Abuse History ──────────────────────────────── */}
      <Section title="History of Trauma / Abuse Victimization">
        <div className="border border-border rounded-card overflow-hidden text-xs mb-3">
          <table className="w-full">
            <thead><tr className="bg-page border-b border-border">
              <th className="text-left px-3 py-2 text-muted font-medium">Type</th>
              <th className="text-center px-3 py-2 text-muted font-medium">Current</th>
              <th className="text-left px-3 py-2 text-muted font-medium">Past (Age)</th>
              <th className="text-center px-3 py-2 text-muted font-medium">Secondary Trauma</th>
              <th className="text-left px-3 py-2 text-muted font-medium">Explain</th>
            </tr></thead>
            <tbody>
              {['Physical','Sexual','Emotional','Exploitation','Neglect','Crime','Military','Natural Disaster','Loss','Domestic Violence'].map(type => (
                <tr key={type} className="border-t border-border">
                  <td className="px-3 py-1.5 font-medium text-heading">{type}</td>
                  <td className="px-3 py-1.5 text-center">
                    <input type="checkbox"
                      checked={!!((fd['trauma'] || {})[type]?.current)}
                      onChange={e => {
                        const t = { ...(fd['trauma'] || {}), [type]: { ...((fd['trauma'] || {})[type] || {}), current: e.target.checked } }
                        s('trauma')(t)
                      }}
                      className="accent-blue-600" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="text" value={((fd['trauma'] || {})[type]?.past_age) || ''}
                      onChange={e => {
                        const t = { ...(fd['trauma'] || {}), [type]: { ...((fd['trauma'] || {})[type] || {}), past_age: e.target.value } }
                        s('trauma')(t)
                      }}
                      className="field-input text-xs py-1 w-16" />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input type="checkbox"
                      checked={!!((fd['trauma'] || {})[type]?.secondary)}
                      onChange={e => {
                        const t = { ...(fd['trauma'] || {}), [type]: { ...((fd['trauma'] || {})[type] || {}), secondary: e.target.checked } }
                        s('trauma')(t)
                      }}
                      className="accent-blue-600" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="text" value={((fd['trauma'] || {})[type]?.explain) || ''}
                      onChange={e => {
                        const t = { ...(fd['trauma'] || {}), [type]: { ...((fd['trauma'] || {})[type] || {}), explain: e.target.value } }
                        s('trauma')(t)
                      }}
                      className="field-input text-xs py-1" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={!!f('trauma_denies')} onChange={e => s('trauma_denies')(e.target.checked)} className="accent-blue-600" />
          Denies experiencing any form of abuse and/or witnessing trauma
        </label>
      </Section>

      {/* ── SECTION 10: Family History ──────────────────────────────────────── */}
      <Section title="Family History – Substance Abuse & Mental Health">
        <div className="grid grid-cols-12 gap-3">
          <F label="Family Substance Abuse History" className="col-span-full">
            <TA value={f('fam_substance')} onChange={s('fam_substance')} rows={3}
              placeholder="Does anyone in your family have substance abuse or addiction issues? Relationship, substance of choice, how long…" />
          </F>
          <div className="col-span-full border-t border-border pt-3">
            <label className="field-label mb-2 block">Family Behavioral Health History — Does anyone have a mental health diagnosis?</label>
            <YesNo value={f('fam_mh_yn')} onChange={s('fam_mh_yn')} />
          </div>
          <div className="col-span-full">
            <div className="border border-border rounded-card overflow-hidden text-xs">
              <table className="w-full">
                <thead><tr className="bg-page border-b border-border">
                  <th className="text-left px-3 py-2 text-muted font-medium">Name</th>
                  <th className="text-left px-3 py-2 text-muted font-medium">Relationship to Consumer</th>
                  <th className="text-left px-3 py-2 text-muted font-medium">Diagnosis</th>
                </tr></thead>
                <tbody>
                  {[0,1,2,3].map(i => (
                    <tr key={i} className="border-t border-border">
                      {['name','rel','dx'].map(col => (
                        <td key={col} className="px-2 py-1.5">
                          <input type="text"
                            value={((fd['fam_mh'] || [])[i] || {})[col] || ''}
                            onChange={e => {
                              const a = [...(fd['fam_mh'] || [{},{},{},{}])]
                              a[i] = { ...(a[i] || {}), [col]: e.target.value }
                              s('fam_mh')(a)
                            }}
                            className="field-input text-xs py-1" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <F label="Sleep Pattern – Hours per Day" className="col-span-2">
            <TI value={f('sleep_hours')} onChange={s('sleep_hours')} />
          </F>
          <F label="Time to Onset of Sleep" className="col-span-2">
            <TI value={f('sleep_onset')} onChange={s('sleep_onset')} />
          </F>
          <F label="Sleep Quality" className="col-span-4">
            <SI value={f('sleep_quality')} onChange={s('sleep_quality')}
              options={['Normal','Sleeping too much','Sleeping too little']} />
          </F>
          <F label="Ability to Concentrate" className="col-span-4">
            <SI value={f('concentrate')} onChange={s('concentrate')}
              options={['Normal','Difficulty Concentrating']} />
          </F>
          <F label="Energy Level" className="col-span-3">
            <SI value={f('energy')} onChange={s('energy')} options={['Low','Average/Normal','High']} />
          </F>
          <F label="Additional Information" className="col-span-9">
            <TA value={f('sleep_notes')} onChange={s('sleep_notes')} rows={2} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 11: Substance Use / Risk Behaviors ──────────────────────── */}
      <Section title="Substance Use & Risk Behaviors">
        <div className="grid grid-cols-12 gap-3">
          <F label="Triggers to Use (list all that apply)" className="col-span-full">
            <TA value={f('sub_triggers')} onChange={s('sub_triggers')} rows={2} />
          </F>
          <F label="Has client traded sex for drugs?" className="col-span-3">
            <YesNo value={f('sub_sex_for_drugs')} onChange={s('sub_sex_for_drugs')} />
          </F>
          <F label="Explain" className="col-span-3">
            <TI value={f('sub_sex_explain')} onChange={s('sub_sex_explain')} />
          </F>
          <F label="Tested for HIV?" className="col-span-2">
            <YesNo value={f('sub_hiv_tested')} onChange={s('sub_hiv_tested')} />
          </F>
          <F label="Date of Last HIV Test" className="col-span-2">
            <TI type="date" value={f('sub_hiv_date')} onChange={s('sub_hiv_date')} />
          </F>
          <F label="HIV Results" className="col-span-2">
            <TI value={f('sub_hiv_results')} onChange={s('sub_hiv_results')} />
          </F>
          <div className="col-span-full">
            <label className="field-label mb-1 block">Problem Gambling Behaviors (select all that apply)</label>
            <div className="grid grid-cols-2 gap-1">
              {['Gambled longer than planned','Gambled until last dollar was gone','Lost sleep thinking of gambling','Used income or savings to gamble while letting bills go unpaid','Borrowed money to gamble','Made repeated unsuccessful attempts to stop gambling','Been remorseful after gambling','Broken the law to finance gambling','Gambled to get money to meet financial obligations','Other'].map(opt => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox"
                    checked={!!(fd['gambling'] || []).includes(opt)}
                    onChange={e => {
                      const arr = [...(fd['gambling'] || [])]
                      if (e.target.checked) arr.push(opt)
                      else arr.splice(arr.indexOf(opt), 1)
                      s('gambling')(arr)
                    }}
                    className="accent-blue-600" />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <div className="col-span-full border-t border-border pt-2">
            <label className="field-label mb-1 block">Risk Taking / Impulsive Behavior (current/past – select all that apply)</label>
            <div className="flex flex-wrap gap-3">
              {['Unprotected sex','Shoplifting','Reckless driving','Gang Involvement','Drug Dealing','Carrying/using weapon','Other'].map(opt => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox"
                    checked={!!(fd['risk_behavior'] || []).includes(opt)}
                    onChange={e => {
                      const arr = [...(fd['risk_behavior'] || [])]
                      if (e.target.checked) arr.push(opt)
                      else arr.splice(arr.indexOf(opt), 1)
                      s('risk_behavior')(arr)
                    }}
                    className="accent-blue-600" />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <F label="Does member smoke?" className="col-span-2">
            <YesNo value={f('sub_smoke')} onChange={s('sub_smoke')} />
          </F>
          <F label="How much?" className="col-span-2">
            <TI value={f('sub_smoke_amt')} onChange={s('sub_smoke_amt')} />
          </F>
          <F label="Drink alcohol?" className="col-span-2">
            <YesNo value={f('sub_alcohol')} onChange={s('sub_alcohol')} />
          </F>
          <F label="How much?" className="col-span-2">
            <TI value={f('sub_alcohol_amt')} onChange={s('sub_alcohol_amt')} />
          </F>
          <F label="Problems sleeping?" className="col-span-4">
            <YesNo value={f('sub_sleep_problems')} onChange={s('sub_sleep_problems')} />
          </F>
          <F label="Explain" className="col-span-full">
            <TI value={f('sub_explain')} onChange={s('sub_explain')} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 12: Education & Learning ────────────────────────────────── */}
      <Section title="Education & Learning Needs">
        <div className="grid grid-cols-12 gap-3">
          <F label="Highest Grade Completed" className="col-span-4">
            <TI value={f('edu_grade')} onChange={s('edu_grade')} />
          </F>
          <F label="Did you leave school due to behavioral/learning issues/homelessness?" className="col-span-8">
            <TI value={f('edu_left_reason')} onChange={s('edu_left_reason')} />
          </F>
          <F label="Able to Read/Write?" className="col-span-3">
            <YesNo value={f('edu_read_write')} onChange={s('edu_read_write')} />
          </F>
          <div className="col-span-full border-t border-border pt-3">
            <label className="field-label mb-2 block">Learning Needs Assessment — How does the consumer best learn? (self-report)</label>
            <div className="flex flex-wrap gap-4">
              {['Written materials','Visually (pictures, videos etc.)','Hearing the information','Consumer/client cannot determine'].map(opt => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox"
                    checked={!!(fd['edu_learning'] || []).includes(opt)}
                    onChange={e => {
                      const arr = [...(fd['edu_learning'] || [])]
                      if (e.target.checked) arr.push(opt)
                      else arr.splice(arr.indexOf(opt), 1)
                      s('edu_learning')(arr)
                    }}
                    className="accent-blue-600" />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── SECTION 13: Housing ─────────────────────────────────────────────── */}
      <Section title="Housing">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-full">
            <label className="field-label mb-1 block">Lives in:</label>
            <div className="flex flex-wrap gap-4">
              {['Personal Care Home','Shelter','Homeless','With family/support person','With roommate'].map(opt => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox"
                    checked={!!(fd['housing_type'] || []).includes(opt)}
                    onChange={e => {
                      const arr = [...(fd['housing_type'] || [])]
                      if (e.target.checked) arr.push(opt)
                      else arr.splice(arr.indexOf(opt), 1)
                      s('housing_type')(arr)
                    }}
                    className="accent-blue-600" />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <F label="How Long?" className="col-span-2">
            <TI value={f('housing_duration')} onChange={s('housing_duration')} />
          </F>
          <F label="Name of Facility" className="col-span-4">
            <TI value={f('housing_facility_name')} onChange={s('housing_facility_name')} />
          </F>
          <F label="Facility Phone" className="col-span-3">
            <TI value={f('housing_facility_phone')} onChange={s('housing_facility_phone')} />
          </F>
          <F label="Facility Address" className="col-span-3">
            <TI value={f('housing_facility_addr')} onChange={s('housing_facility_addr')} />
          </F>
          {[
            ['housing_stable',  'Able to maintain stable housing?'],
            ['housing_duties',  'Able to complete/maintain household duties?'],
            ['housing_cooking', 'Able to safely operate cooking appliances?'],
            ['housing_electric','Is there electricity?'],
            ['housing_food',    'Is there food in the refrigerator/pantry?'],
          ].map(([k, label]) => (
            <F key={k} label={label} className="col-span-4">
              <YesNo value={f(k)} onChange={s(k)} />
            </F>
          ))}
        </div>
      </Section>

      {/* ── SECTION 14: Caregiver Support & Nutritional Screening ───────────── */}
      <Section title="Caregiver Support & Nutritional Screening">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-full">
            <label className="field-label mb-1 block">Care Giver Support</label>
          </div>
          {[
            ['cg_overwhelmed', '1. Is caregiver overwhelmed?'],
            ['cg_access',      '2. Does caregiver know how to access services?'],
            ['cg_respite',     '3. Does caregiver have adequate support and respite in place?'],
          ].map(([k, label]) => (
            <F key={k} label={label} className="col-span-4">
              <YesNo value={f(k)} onChange={s(k)} />
            </F>
          ))}
          <div className="col-span-full border-t border-border pt-3">
            <label className="field-label mb-1 block">Nutritional Screening</label>
          </div>
          {[
            ['nutr_weight_change',  'Has consumer lost or gained 10+ lbs in last 3 months without intervention?'],
            ['nutr_anorexic',       'Does consumer report anorexic behaviors?'],
            ['nutr_bulimic',        'Does consumer report bulimic behaviors?'],
            ['nutr_dental',         'Does consumer report dental problems that interfere with eating?'],
          ].map(([k, label]) => (
            <F key={k} label={label} className="col-span-6">
              <YesNo value={f(k)} onChange={s(k)} />
            </F>
          ))}
        </div>
      </Section>

      {/* ── SECTION 15: Pain & Health Screening ─────────────────────────────── */}
      <Section title="Pain & Health Screening">
        <div className="grid grid-cols-12 gap-3">
          <F label="Acute Pain Score (0–10)" className="col-span-2">
            <TI type="number" value={f('pain_acute_score')} onChange={s('pain_acute_score')} />
          </F>
          <F label="Referral Made?" className="col-span-2">
            <YesNo value={f('pain_referral')} onChange={s('pain_referral')} />
          </F>
          <F label="Chronic Pain Score (0–14)" className="col-span-2">
            <TI type="number" value={f('pain_chronic_score')} onChange={s('pain_chronic_score')} />
          </F>
          <F label="Chronic Pain Referral?" className="col-span-2">
            <YesNo value={f('pain_chronic_referral')} onChange={s('pain_chronic_referral')} />
          </F>
          <F label="If yes, who?" className="col-span-4">
            <TI value={f('pain_referral_who')} onChange={s('pain_referral_who')} />
          </F>
          <div className="col-span-full border-t border-border pt-3">
            <label className="field-label mb-1 block">Health Screening</label>
          </div>
          <div className="col-span-full">
            <div className="flex flex-wrap gap-3">
              {['No Medical Issues Reported','Currently Pregnant','Cardiovascular (includes stroke)','Diabetes – Non-insulin dependent','Diabetes – Insulin dependent','Chronic Obstructive Pulmonary Disorder','Hypertension','Seizure Disorder','Cancer','Ulcerative/Wounds','Other Serious Medical Illness','Chronic Pain','Infectious Diseases','Physical Disabilities'].map(opt => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox"
                    checked={!!(fd['health_conditions'] || []).includes(opt)}
                    onChange={e => {
                      const arr = [...(fd['health_conditions'] || [])]
                      if (e.target.checked) arr.push(opt)
                      else arr.splice(arr.indexOf(opt), 1)
                      s('health_conditions')(arr)
                    }}
                    className="accent-blue-600" />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <F label="Prenatal Visit Date (if pregnant)" className="col-span-3">
            <TI type="date" value={f('health_prenatal_date')} onChange={s('health_prenatal_date')} />
          </F>
          <F label="Last Seizure Date" className="col-span-3">
            <TI type="date" value={f('health_seizure_date')} onChange={s('health_seizure_date')} />
          </F>
          <F label="Cancer Type / When Diagnosed" className="col-span-3">
            <TI value={f('health_cancer_detail')} onChange={s('health_cancer_detail')} />
          </F>
          <F label="Chronic Pain Type" className="col-span-3">
            <TI value={f('health_pain_type')} onChange={s('health_pain_type')} />
          </F>
          <F label="Medical Risk Factors" className="col-span-full">
            <div className="flex flex-wrap gap-3">
              {['High Cholesterol','Nausea','Vomiting','Diarrhea','High Blood Pressure','Chronic Indigestion','Other'].map(opt => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox"
                    checked={!!(fd['health_risk_factors'] || []).includes(opt)}
                    onChange={e => {
                      const arr = [...(fd['health_risk_factors'] || [])]
                      if (e.target.checked) arr.push(opt)
                      else arr.splice(arr.indexOf(opt), 1)
                      s('health_risk_factors')(arr)
                    }}
                    className="accent-blue-600" />
                  {opt}
                </label>
              ))}
            </div>
          </F>
          <F label="Name and Phone of PCP" className="col-span-4">
            <TI value={f('health_pcp')} onChange={s('health_pcp')} />
          </F>
          <F label="Sees PCP Regularly?" className="col-span-2">
            <YesNo value={f('health_pcp_regular')} onChange={s('health_pcp_regular')} />
          </F>
          <F label="Date of Last PCP Visit" className="col-span-3">
            <TI type="date" value={f('health_pcp_last_visit')} onChange={s('health_pcp_last_visit')} />
          </F>
          <F label="Able to Obtain Medication?" className="col-span-3">
            <YesNo value={f('health_meds_obtainable')} onChange={s('health_meds_obtainable')} />
          </F>
          <F label="Barrier to Medication" className="col-span-full">
            <TI value={f('health_med_barrier')} onChange={s('health_med_barrier')} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 16: Medical Providers ────────────────────────────────────── */}
      <Section title="Additional Medical Providers">
        <div className="border border-border rounded-card overflow-hidden text-xs">
          <table className="w-full">
            <thead><tr className="bg-page border-b border-border">
              <th className="text-left px-3 py-2 text-muted font-medium">Name</th>
              <th className="text-left px-3 py-2 text-muted font-medium">Phone Number</th>
              <th className="text-left px-3 py-2 text-muted font-medium">Specialty</th>
              <th className="text-left px-3 py-2 text-muted font-medium">Last Visit</th>
              <th className="text-left px-3 py-2 text-muted font-medium">Coordinating?</th>
            </tr></thead>
            <tbody>
              {[0,1,2,3,4].map(i => (
                <tr key={i} className="border-t border-border">
                  {['name','phone','specialty','last_visit'].map(col => (
                    <td key={col} className="px-2 py-1.5">
                      <input type={col === 'last_visit' ? 'date' : 'text'}
                        value={((fd['providers'] || [])[i] || {})[col] || ''}
                        onChange={e => {
                          const a = [...(fd['providers'] || [])]
                          while (a.length <= i) a.push({})
                          a[i] = { ...(a[i] || {}), [col]: e.target.value }
                          s('providers')(a)
                        }}
                        className="field-input text-xs py-1" />
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <select
                      value={((fd['providers'] || [])[i] || {}).coordinating || ''}
                      onChange={e => {
                        const a = [...(fd['providers'] || [])]
                        while (a.length <= i) a.push({})
                        a[i] = { ...(a[i] || {}), coordinating: e.target.value }
                        s('providers')(a)
                      }}
                      className="field-input text-xs py-1">
                      <option value="">—</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-12 gap-3 mt-3">
          <F label="Instructed to contact PCP (if no visit in 1 year)?" className="col-span-6">
            <YesNo value={f('health_pcp_instructed')} onChange={s('health_pcp_instructed')} />
          </F>
          <F label="Summary (Document Medical Necessity for identified problem areas)" className="col-span-full">
            <TA value={f('health_summary')} onChange={s('health_summary')} rows={3} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 17: Medication Information ──────────────────────────────── */}
      <Section title="Medication Information">
        <div className="grid grid-cols-12 gap-3">
          <F label="Pharmacy Name" className="col-span-5">
            <TI value={f('rx_pharmacy_name')} onChange={s('rx_pharmacy_name')} />
          </F>
          <F label="Pharmacy Phone" className="col-span-4">
            <TI value={f('rx_pharmacy_phone')} onChange={s('rx_pharmacy_phone')} />
          </F>
          <F label="Takes Medication as Prescribed?" className="col-span-3">
            <YesNo value={f('rx_adherent')} onChange={s('rx_adherent')} />
          </F>
          <F label="Understands Indication for Each Medication?" className="col-span-4">
            <YesNo value={f('rx_understands')} onChange={s('rx_understands')} />
          </F>
          <F label="Explain" className="col-span-8">
            <TI value={f('rx_explain')} onChange={s('rx_explain')} />
          </F>

          <div className="col-span-full">
            <label className="field-label mb-1 block">Psychiatric Medications</label>
            <MedTable fieldKey="rx_psych" fd={fd} s={s} columns={['Medication','Dosage','Frequency','Prescribing MD','Phone Number','Reported Side Effects']} />
          </div>
          <div className="col-span-full border-t border-border pt-3">
            <label className="field-label mb-1 block">Non-Psychiatric Medications</label>
            <MedTable fieldKey="rx_nonpsych" fd={fd} s={s} columns={['Medication','Dosage','Frequency','Indication','Prescribing MD','Phone Number','Reported Side Effects']} />
          </div>
        </div>
      </Section>

      {/* ── SECTION 18: Support System / Brief Social History ───────────────── */}
      <Section title="Support System / Brief Social History">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-full">
            <label className="field-label mb-1 block">What family support does consumer have now? (Name / Relationship)</label>
            <div className="border border-border rounded-card overflow-hidden text-xs">
              <table className="w-full">
                <thead><tr className="bg-page border-b border-border">
                  <th className="text-left px-3 py-2 text-muted font-medium w-1/2">Name</th>
                  <th className="text-left px-3 py-2 text-muted font-medium">Relationship</th>
                </tr></thead>
                <tbody>
                  {[0,1,2,3,4].map(i => (
                    <tr key={i} className="border-t border-border">
                      {['name','rel'].map(col => (
                        <td key={col} className="px-2 py-1.5">
                          <input type="text"
                            value={((fd['support_system'] || [])[i] || {})[col] || ''}
                            onChange={e => {
                              const a = [...(fd['support_system'] || [])]
                              while (a.length <= i) a.push({})
                              a[i] = { ...(a[i] || {}), [col]: e.target.value }
                              s('support_system')(a)
                            }}
                            className="field-input text-xs py-1" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Section>

      {/* ── SECTION 19: Cultural / Spiritual ────────────────────────────────── */}
      <Section title="Cultural / Spiritual">
        <div className="grid grid-cols-12 gap-3">
          <F label="Does consumer identify with a Spiritual belief system or Religion?" className="col-span-6">
            <YesNo value={f('cultural_spiritual')} onChange={s('cultural_spiritual')} />
          </F>
          <F label="Are they active?" className="col-span-3">
            <YesNo value={f('cultural_active')} onChange={s('cultural_active')} />
          </F>
          <F label="What Spiritual / Religious system?" className="col-span-3">
            <TI value={f('cultural_what')} onChange={s('cultural_what')} />
          </F>
          <F label="Does consumer have spiritually satisfied needs?" className="col-span-6">
            <YesNo value={f('cultural_needs_met')} onChange={s('cultural_needs_met')} />
          </F>
          <F label="Does consumer attend any mental health support group?" className="col-span-6">
            <YesNo value={f('cultural_support_group')} onChange={s('cultural_support_group')} />
          </F>
          <F label="Are cultural needs unmet?" className="col-span-4">
            <YesNo value={f('cultural_unmet')} onChange={s('cultural_unmet')} />
          </F>
          <F label="Explain" className="col-span-8">
            <TI value={f('cultural_unmet_explain')} onChange={s('cultural_unmet_explain')} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 20: Financial ────────────────────────────────────────────── */}
      <Section title="Financial">
        <div className="grid grid-cols-12 gap-3">
          {[
            ['fin_manage', '1. Is consumer able to manage his/her own finances?'],
            ['fin_budget',  '2. Can consumer effectively budget monthly income?'],
            ['fin_shelter', '3. Can consumer meet basic needs (food/shelter)?'],
          ].map(([k, label]) => (
            <F key={k} label={label} className="col-span-6">
              <YesNo value={f(k)} onChange={s(k)} />
            </F>
          ))}
          <F label="Explain any financial issues" className="col-span-full">
            <TA value={f('fin_explain')} onChange={s('fin_explain')} rows={2} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 21: Transportation / Vocational ──────────────────────────── */}
      <Section title="Transportation & Vocational / Employment">
        <div className="grid grid-cols-12 gap-3">
          {[
            ['trans_public', '1. Is consumer able to use transportation to appointments?'],
            ['trans_bus',    '2. Able to use public transportation?'],
            ['trans_indep',  '3. Is consumer able to get to pharmacy independently?'],
          ].map(([k, label]) => (
            <F key={k} label={label} className="col-span-6">
              <YesNo value={f(k)} onChange={s(k)} />
            </F>
          ))}
          <F label="PCG / Transportation for contact?" className="col-span-6">
            <YesNo value={f('trans_pcg')} onChange={s('trans_pcg')} />
          </F>
          <div className="col-span-full border-t border-border pt-3">
            <label className="field-label mb-1 block">Vocational / Employment</label>
          </div>
          <F label="Currently Employed?" className="col-span-3">
            <YesNo value={f('voc_employed')} onChange={s('voc_employed')} />
          </F>
          <F label="How long?" className="col-span-2">
            <TI value={f('voc_how_long')} onChange={s('voc_how_long')} />
          </F>
          <F label="Job Location" className="col-span-4">
            <TI value={f('voc_location')} onChange={s('voc_location')} />
          </F>
          <F label="Occupation" className="col-span-3">
            <TI value={f('voc_occupation')} onChange={s('voc_occupation')} />
          </F>
          {[
            ['voc_job_problems',  '4. Does consumer have problems on the job?'],
            ['voc_attendance',    '5. Have trouble showing up for work?'],
          ].map(([k, label]) => (
            <F key={k} label={label} className="col-span-6">
              <YesNo value={f(k)} onChange={s(k)} />
            </F>
          ))}
          <F label="Past Employment History" className="col-span-full">
            <TA value={f('voc_past')} onChange={s('voc_past')} rows={2} />
          </F>
          <F label="Interested in part-time employment?" className="col-span-4">
            <YesNo value={f('voc_part_time')} onChange={s('voc_part_time')} />
          </F>
          <F label="Had problems with employment?" className="col-span-4">
            <YesNo value={f('voc_had_problems')} onChange={s('voc_had_problems')} />
          </F>
          <F label="Explain" className="col-span-4">
            <TI value={f('voc_explain')} onChange={s('voc_explain')} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 22: Daily Living Skills / ADLs ──────────────────────────── */}
      <Section title="Daily Living Skills (ADLs)">
        <div className="grid grid-cols-12 gap-3">
          {[
            ['adl_perform',   '1. Can consumer perform ADLs by self?'],
            ['adl_bath',      '2. Does consumer bathe/brush teeth regularly?'],
            ['adl_appearance','3. Does consumer present with clean appearance (hair, nails, shaved)?'],
            ['adl_meals',     '4. Does consumer prepare own meals?'],
            ['adl_food',      '5. Is consumer able to obtain, keep and prepare food appropriately?'],
            ['adl_eating',    '6. Does consumer have a problem with eating?'],
            ['adl_miss_meals','7. Does consumer frequently miss meals?'],
            ['adl_nutrition', '8. Does consumer understand basic nutrition?'],
            ['adl_sexual',    '9. Does consumer exhibit appropriate sexual behaviors?'],
            ['adl_sex_aware', '10. Is consumer aware of consequences of unprotected sex?'],
            ['adl_dress',     '11. Does consumer dress appropriately for climate?'],
            ['adl_laundry',   '12. Is consumer able to keep clothing clean?'],
            ['adl_disrobe',   '13. Does consumer disrobe inappropriately?'],
            ['adl_toilet',    '14. Does consumer urinate/defecate in clothes?'],
          ].map(([k, label]) => (
            <F key={k} label={label} className="col-span-6">
              <YesNo value={f(k)} onChange={s(k)} />
            </F>
          ))}
          <F label="Is client able to care for him/herself?" className="col-span-6">
            <YesNo value={f('adl_self_care')} onChange={s('adl_self_care')} />
          </F>
          <F label="If No, please explain:" className="col-span-6">
            <TI value={f('adl_explain')} onChange={s('adl_explain')} />
          </F>
          <F label="Does the client have a history of falls?" className="col-span-4">
            <YesNo value={f('adl_falls')} onChange={s('adl_falls')} />
          </F>
          <F label="Explain" className="col-span-8">
            <TI value={f('adl_falls_explain')} onChange={s('adl_falls_explain')} />
          </F>
          <div className="col-span-full">
            <label className="field-label mb-1 block">Uses or Needs Assistive/Adaptive Devices (select all that apply)</label>
            <div className="flex flex-wrap gap-4">
              {['None','Glasses','Walker','Braille','Hearing Aids','Cane','Crutches','Wheelchair','Translated Written Info','Translator for Speaking','Other'].map(opt => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox"
                    checked={!!(fd['adl_devices'] || []).includes(opt)}
                    onChange={e => {
                      const arr = [...(fd['adl_devices'] || [])]
                      if (e.target.checked) arr.push(opt)
                      else arr.splice(arr.indexOf(opt), 1)
                      s('adl_devices')(arr)
                    }}
                    className="accent-blue-600" />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── SECTION 23: Coping Skills / Socialization / Leisure ─────────────── */}
      <Section title="Coping Skills, Socialization & Leisure">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-full">
            <label className="field-label mb-1 block">Coping Skills</label>
          </div>
          {[
            ['cope_identify',  '1. Is consumer able to identify coping skills for symptom management?'],
            ['cope_recognize', '2. Able to recognize signs/symptoms of relapse?'],
            ['cope_verbalize', '3. Able to verbalize/demonstrate techniques to prevent relapse?'],
            ['cope_others',    '4. Is consumer able to get along with others?'],
            ['cope_crisis',    '5. Has consumer demonstrated ability to deal with crisis situations?'],
          ].map(([k, label]) => (
            <F key={k} label={label} className="col-span-6">
              <YesNo value={f(k)} onChange={s(k)} />
            </F>
          ))}
          <div className="col-span-full border-t border-border pt-3">
            <label className="field-label mb-1 block">Socialization</label>
          </div>
          {[
            ['soc_family',    '1. Does consumer get along with family members, roommates and other consumers?'],
            ['soc_network',   '2. Does consumer have supportive social network?'],
            ['soc_sexual',    '3. Has consumer had problem with sexual/physical assault?'],
            ['soc_accused',   '4. Has consumer ever been accused of sexual/physical assault?'],
            ['soc_neglect',   '5. Has consumer been a victim of neglect?'],
            ['soc_theft',     '6. Has consumer been a victim of theft?'],
            ['soc_abuse_env', '7. Is consumer able to assess environment for safety?'],
            ['soc_abuse_yn',  '8. Does consumer place self in situations that could lead to abuse?'],
            ['soc_money',     '9. Does consumer give away belonging/money?'],
            ['soc_volunteer', '10. Does consumer have volunteer experience?'],
          ].map(([k, label]) => (
            <F key={k} label={label} className="col-span-6">
              <YesNo value={f(k)} onChange={s(k)} />
            </F>
          ))}
          <div className="col-span-full border-t border-border pt-3">
            <label className="field-label mb-1 block">Leisure & Recreation — Which of the following does the client do?</label>
            <div className="grid grid-cols-3 gap-2">
              {['Spend Time with Friends','Dancing/Exercise','Time with Family','Hobbies','Work Part-Time','Watch Movies/TV','Go "Downtown"','Stay at Home','Listen to Music','Spend Time at Clubs/Bars','Go to Casinos','Other'].map(opt => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox"
                    checked={!!(fd['leisure'] || []).includes(opt)}
                    onChange={e => {
                      const arr = [...(fd['leisure'] || [])]
                      if (e.target.checked) arr.push(opt)
                      else arr.splice(arr.indexOf(opt), 1)
                      s('leisure')(arr)
                    }}
                    className="accent-blue-600" />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <F label="What limits the client's leisure/recreational activities?" className="col-span-full">
            <TA value={f('leisure_limits')} onChange={s('leisure_limits')} rows={2} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 24: Family & Relationship History ────────────────────────── */}
      <Section title="Family & Relationship History">
        <div className="grid grid-cols-12 gap-3">
          <F label="Describe childhood (Happy? Stressful? Neglected? Abused?)" className="col-span-full">
            <TA value={f('fam_childhood')} onChange={s('fam_childhood')} rows={3} />
          </F>
          <F label="Did you live with both parents?" className="col-span-3">
            <YesNo value={f('fam_both_parents')} onChange={s('fam_both_parents')} />
          </F>
          <F label="If No, with whom?" className="col-span-3">
            <TI value={f('fam_lived_with')} onChange={s('fam_lived_with')} />
          </F>
          <F label="Do you have siblings?" className="col-span-3">
            <YesNo value={f('fam_siblings')} onChange={s('fam_siblings')} />
          </F>
          <F label="How many siblings?" className="col-span-3">
            <TI type="number" value={f('fam_sibling_count')} onChange={s('fam_sibling_count')} />
          </F>
          <F label="Get along with siblings?" className="col-span-4">
            <SI value={f('fam_sibling_rel')} onChange={s('fam_sibling_rel')} options={['Yes','No','N/A']} />
          </F>
          <F label="Explain" className="col-span-8">
            <TI value={f('fam_sibling_explain')} onChange={s('fam_sibling_explain')} />
          </F>
          <F label="Ever been married?" className="col-span-3">
            <YesNo value={f('fam_married')} onChange={s('fam_married')} />
          </F>
          <F label="How many times?" className="col-span-2">
            <TI type="number" value={f('fam_married_times')} onChange={s('fam_married_times')} />
          </F>
          <F label="Still married to same person?" className="col-span-3">
            <YesNo value={f('fam_same_spouse')} onChange={s('fam_same_spouse')} />
          </F>
          <F label="Have a significant other?" className="col-span-4">
            <YesNo value={f('fam_sig_other')} onChange={s('fam_sig_other')} />
          </F>
          <F label="Have children?" className="col-span-3">
            <YesNo value={f('fam_children')} onChange={s('fam_children')} />
          </F>
          <F label="How many?" className="col-span-2">
            <TI type="number" value={f('fam_children_count')} onChange={s('fam_children_count')} />
          </F>
          <F label="How many live with you?" className="col-span-3">
            <TI type="number" value={f('fam_children_home')} onChange={s('fam_children_home')} />
          </F>
          <F label="Can contact friends/family if trouble locating client?" className="col-span-4">
            <YesNo value={f('fam_contact_ok')} onChange={s('fam_contact_ok')} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 25: Consumer / Client Goals ─────────────────────────────── */}
      <Section title="Consumer / Client Goals">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-full">
            <label className="field-label mb-1 block">If given 3 wishes what would they be?</label>
            {[0,1,2].map(i => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="text-sm text-muted w-4">{i+1}.</span>
                <input type="text"
                  value={(fd['goals_wishes'] || [])[i] || ''}
                  onChange={e => {
                    const a = [...(fd['goals_wishes'] || ['','',''])]
                    a[i] = e.target.value
                    s('goals_wishes')(a)
                  }}
                  className="field-input flex-1" />
              </div>
            ))}
          </div>
          <F label="What time in your life were you the happiest? Why?" className="col-span-full">
            <TA value={f('goals_happiest')} onChange={s('goals_happiest')} rows={2} />
          </F>
          <F label="If you could change things in your life, what would they be?" className="col-span-full">
            <TA value={f('goals_change')} onChange={s('goals_change')} rows={2} />
          </F>
          <F label="What activities would you like to do to help others?" className="col-span-full">
            <TI value={f('goals_helping')} onChange={s('goals_helping')} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 26: Rating Scales ────────────────────────────────────────── */}
      <Section title="Rating Scales – Addendum">
        <div className="border border-border rounded-card overflow-hidden text-xs">
          <table className="w-full">
            <thead><tr className="bg-page border-b border-border">
              <th className="text-left px-3 py-2 text-muted font-medium">Scale</th>
              <th className="text-left px-3 py-2 text-muted font-medium">Date Completed</th>
              <th className="text-left px-3 py-2 text-muted font-medium">Score (If Applicable)</th>
            </tr></thead>
            <tbody>
              {['Columbia-Suicide Severity Rating Scale','Patient Health Questionnaire PHQ-9','Life\'s Events Checklist','Assault & Homicidal Danger Assessment Tool'].map((scale, i) => (
                <tr key={scale} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-heading">{scale}</td>
                  <td className="px-2 py-1.5">
                    <input type="date"
                      value={((fd['rating_scales'] || [])[i] || {}).date || ''}
                      onChange={e => {
                        const a = [...(fd['rating_scales'] || [{},{},{},{}])]
                        a[i] = { ...(a[i] || {}), date: e.target.value }
                        s('rating_scales')(a)
                      }}
                      className="field-input text-xs py-1" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="text"
                      value={((fd['rating_scales'] || [])[i] || {}).score || ''}
                      onChange={e => {
                        const a = [...(fd['rating_scales'] || [{},{},{},{}])]
                        a[i] = { ...(a[i] || {}), score: e.target.value }
                        s('rating_scales')(a)
                      }}
                      className="field-input text-xs py-1" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── SECTION 27: Targeted Issues for Treatment Plan ───────────────────── */}
      <Section title="Targeted Issues for Master Treatment Plan Development">
        <div className="grid grid-cols-2 gap-2">
          {['1. Independent Living Services','2. Personal Hygiene/Self-care','3. Transportation Utilization','4. Medication Management/Adherence','5. Medical/Physical Health','6. Medical Decision Making','7. Engagement','8. Understanding Diagnosis','9. Substance Abuse','10. Cognitive Function','11. Housing/Residential Stability','12. Supports','13. Financial (Money Management)','14. Legal','15. Transportation','16. Caregiver Support','17. Employment','18. Daily Living Skills','19. Coping Skills','20. Socialization/Social Functioning','21. Hospitalization'].map(item => (
            <label key={item} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded hover:bg-page transition-colors">
              <input type="checkbox"
                checked={!!(fd['targeted_issues'] || []).includes(item)}
                onChange={e => {
                  const arr = [...(fd['targeted_issues'] || [])]
                  if (e.target.checked) arr.push(item)
                  else arr.splice(arr.indexOf(item), 1)
                  s('targeted_issues')(arr)
                }}
                className="accent-blue-600 shrink-0" />
              {item}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-12 gap-3 mt-3 border-t border-border pt-3">
          <F label="Request for family involvement in treatment planning?" className="col-span-6">
            <YesNo value={f('tx_family_involve')} onChange={s('tx_family_involve')} />
          </F>
        </div>
      </Section>

      {/* ── SECTION 28: Patient Safety Plan ─────────────────────────────────── */}
      <Section title="Patient Safety Plan">
        <div className="grid grid-cols-12 gap-3">
          <F label="Step 1: Warning signs (thoughts, images, mood, situation, behavior) that a crisis may be developing" className="col-span-full">
            <div className="space-y-2">
              {[0,1,2].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-muted w-4">{i+1}.</span>
                  <input type="text"
                    value={(fd['safety_warning'] || [])[i] || ''}
                    onChange={e => {
                      const a = [...(fd['safety_warning'] || ['','',''])]
                      a[i] = e.target.value
                      s('safety_warning')(a)
                    }}
                    className="field-input flex-1" />
                </div>
              ))}
            </div>
          </F>
          <F label="Step 2: Internal coping strategies (things I can do to take my mind off problems without contacting another person)" className="col-span-full">
            <div className="space-y-2">
              {[0,1,2].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-muted w-4">{i+1}.</span>
                  <input type="text"
                    value={(fd['safety_coping'] || [])[i] || ''}
                    onChange={e => {
                      const a = [...(fd['safety_coping'] || ['','',''])]
                      a[i] = e.target.value
                      s('safety_coping')(a)
                    }}
                    className="field-input flex-1" />
                </div>
              ))}
            </div>
          </F>
          <F label="Step 3: People and social settings that provide distraction" className="col-span-full">
            <div className="space-y-2">
              {[0,1,2,3].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-muted w-4">{i+1}.</span>
                  <input type="text" placeholder="Name or Place"
                    value={(fd['safety_distraction'] || [])[i]?.name || ''}
                    onChange={e => {
                      const a = [...(fd['safety_distraction'] || [])]
                      while (a.length <= i) a.push({})
                      a[i] = { ...(a[i] || {}), name: e.target.value }
                      s('safety_distraction')(a)
                    }}
                    className="field-input flex-1" />
                  <input type="tel" placeholder="Phone"
                    value={(fd['safety_distraction'] || [])[i]?.phone || ''}
                    onChange={e => {
                      const a = [...(fd['safety_distraction'] || [])]
                      while (a.length <= i) a.push({})
                      a[i] = { ...(a[i] || {}), phone: e.target.value }
                      s('safety_distraction')(a)
                    }}
                    className="field-input w-36" />
                </div>
              ))}
            </div>
          </F>
          <F label="Step 4: People whom I can ask for help" className="col-span-full">
            <div className="space-y-2">
              {[0,1,2].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-muted w-4">{i+1}.</span>
                  <input type="text" placeholder="Name"
                    value={(fd['safety_help'] || [])[i]?.name || ''}
                    onChange={e => {
                      const a = [...(fd['safety_help'] || [])]
                      while (a.length <= i) a.push({})
                      a[i] = { ...(a[i] || {}), name: e.target.value }
                      s('safety_help')(a)
                    }}
                    className="field-input flex-1" />
                  <input type="tel" placeholder="Phone"
                    value={(fd['safety_help'] || [])[i]?.phone || ''}
                    onChange={e => {
                      const a = [...(fd['safety_help'] || [])]
                      while (a.length <= i) a.push({})
                      a[i] = { ...(a[i] || {}), phone: e.target.value }
                      s('safety_help')(a)
                    }}
                    className="field-input w-36" />
                </div>
              ))}
            </div>
          </F>
        </div>
      </Section>

      {/* ── SECTION 29: Signatures ───────────────────────────────────────────── */}
      <Section title="Signatures">
        <div className="grid grid-cols-12 gap-3">
          <F label="Consumer / Guardian Signature" className="col-span-5">
            <TI value={f('sig_consumer')} onChange={s('sig_consumer')} placeholder="Type full name to sign" />
          </F>
          <F label="Date" className="col-span-2">
            <TI type="date" value={f('sig_consumer_date')} onChange={s('sig_consumer_date')} />
          </F>
          <div className="col-span-5" />
          <F label="NSH Staff Signature & Credentials" className="col-span-5">
            <TI value={f('sig_staff')} onChange={s('sig_staff')} placeholder="Type full name to sign" />
          </F>
          <F label="Date" className="col-span-2">
            <TI type="date" value={f('sig_staff_date')} onChange={s('sig_staff_date')} />
          </F>
          <div className="col-span-5" />
          <F label="Supervising Clinician & Credentials" className="col-span-5">
            <TI value={f('sig_supervisor')} onChange={s('sig_supervisor')} placeholder="Type full name to sign" />
          </F>
          <F label="Date" className="col-span-2">
            <TI type="date" value={f('sig_supervisor_date')} onChange={s('sig_supervisor_date')} />
          </F>
        </div>
      </Section>

      {/* Bottom save */}
      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
        {saved && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><IconCheck size={12} />Saved</span>}
        {visit?.status !== 'signed' && (
          <button onClick={() => handleSave('complete')} disabled={saving} className="btn-secondary text-sm px-4 py-2">
            Mark Complete
          </button>
        )}
        {visit?.status === 'complete' && (
          <button onClick={() => handleSave('signed')} disabled={saving} className="btn-secondary text-sm text-emerald-700 border-emerald-300 hover:bg-emerald-50 px-4 py-2">
            Sign Assessment
          </button>
        )}
        <button onClick={() => handleSave()} disabled={saving} className="btn-primary text-sm flex items-center gap-1.5">
          {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconDeviceFloppy size={14} />}
          Save
        </button>
      </div>
    </div>
  )
}


// ─── Reusable field sub-components ───────────────────────────────────────────

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-3 border border-border rounded-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-page hover:bg-border/30 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-heading">{title}</span>
        {open ? <IconChevronUp size={15} className="text-muted" /> : <IconChevronDown size={15} className="text-muted" />}
      </button>
      {open && (
        <div className="px-4 py-4 bg-card border-t border-border">
          {children}
        </div>
      )}
    </div>
  )
}

function F({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  )
}

function TI({ value, onChange, placeholder, type = 'text', className = '' }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || ''}
      className={`field-input ${className}`}
    />
  )
}

function TA({ value, onChange, rows = 3, placeholder = '' }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="field-input resize-none"
    />
  )
}

function SI({ value, onChange, options = [] }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)} className="field-input">
      <option value="">Select…</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function YesNo({ value, onChange }) {
  return (
    <div className="flex gap-4 mt-1">
      {['Yes','No'].map(opt => (
        <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="radio"
            name={Math.random().toString(36).slice(2)}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="accent-blue-600"
          />
          {opt}
        </label>
      ))}
    </div>
  )
}

function CheckboxRow({ label, fieldKey, opts, fd, s }) {
  return (
    <div>
      <label className="field-label mb-1 block">{label}</label>
      <div className="flex flex-wrap gap-3">
        {opts.map(opt => (
          <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={!!(fd[fieldKey] || []).includes(opt)}
              onChange={e => {
                const arr = [...(fd[fieldKey] || [])]
                if (e.target.checked) arr.push(opt)
                else arr.splice(arr.indexOf(opt), 1)
                s(fieldKey)(arr)
              }}
              className="accent-blue-600"
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  )
}

function MedTable({ fieldKey, fd, s, columns }) {
  return (
    <div className="border border-border rounded-card overflow-hidden text-xs">
      <table className="w-full">
        <thead>
          <tr className="bg-page border-b border-border">
            {columns.map(c => (
              <th key={c} className="text-left px-2 py-2 text-muted font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0,1,2,3,4,5,6].map(i => (
            <tr key={i} className="border-t border-border">
              {columns.map((col, ci) => (
                <td key={col} className="px-2 py-1.5">
                  <input
                    type="text"
                    value={((fd[fieldKey] || [])[i] || {})[`col${ci}`] || ''}
                    onChange={e => {
                      const a = [...(fd[fieldKey] || [])]
                      while (a.length <= i) a.push({})
                      a[i] = { ...(a[i] || {}), [`col${ci}`]: e.target.value }
                      s(fieldKey)(a)
                    }}
                    className="field-input text-xs py-1"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
