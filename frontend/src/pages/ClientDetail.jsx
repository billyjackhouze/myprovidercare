import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  IconLoader2, IconDeviceFloppy, IconArrowLeft, IconPlus,
  IconTrash, IconPill, IconAlertTriangle, IconUser, IconSettings,
} from '@tabler/icons-react'
import api from '@/lib/api'
import DynamicForm from '@/components/DynamicForm'

// Default tabs — used as fallback while workflow config loads
const DEFAULT_TABS = [
  { tab_key: 'general',    label: 'General Info', is_visible: true },
  { tab_key: 'intake',     label: 'Intake',       is_visible: true },
  { tab_key: 'referral',   label: 'Referral',     is_visible: true },
  { tab_key: 'treatment',  label: 'Treatment Plan', is_visible: true },
  { tab_key: 'notes',      label: 'Progress Notes', is_visible: true },
  { tab_key: 'auths',      label: 'Auths',          is_visible: true },
  { tab_key: 'discharge',  label: 'Discharge',      is_visible: true },
  { tab_key: 'contacts',   label: 'Contact Notes',  is_visible: true },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', className = '' }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`field-input ${className}`}
    />
  )
}

function Select({ value, onChange, options = [], placeholder = 'Select…' }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)} className="field-input">
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function Textarea({ value, onChange, rows = 3 }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      className="field-input resize-none"
    />
  )
}

function SectionHeader({ title }) {
  return (
    <div className="col-span-full border-b border-border pb-1 mb-1">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</h3>
    </div>
  )
}

// ─── Medications sub-component ───────────────────────────────────────────────
function MedicationsPanel({ clientId, dropdowns }) {
  const [meds, setMeds] = useState([])
  const [adding, setAdding] = useState(false)
  const [newMed, setNewMed] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/clients/${clientId}/medications`, { params: { active_only: false } })
      setMeds(r.data)
    } catch {}
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])

  const routeOpts = dropdowns?.route || []
  const freqOpts = dropdowns?.frequency || []

  const handleAdd = async () => {
    if (!newMed.name) return
    await api.post(`/clients/${clientId}/medications`, newMed)
    setNewMed({})
    setAdding(false)
    load()
  }

  const handleToggleActive = async (med) => {
    await api.put(`/clients/${clientId}/medications/${med.id}`, { ...med, is_active: !med.is_active })
    load()
  }

  const handleDelete = async (med) => {
    if (!confirm(`Remove ${med.name}?`)) return
    await api.delete(`/clients/${clientId}/medications/${med.id}`)
    load()
  }

  if (loading) return <div className="text-muted text-sm py-4 text-center"><IconLoader2 size={16} className="animate-spin inline mr-2" />Loading medications…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-heading flex items-center gap-1.5">
          <IconPill size={15} style={{ color: '#2563EB' }} />
          Current Medications
        </h3>
        <button onClick={() => setAdding(true)} className="btn-secondary text-xs flex items-center gap-1 px-2 py-1">
          <IconPlus size={12} /> Add
        </button>
      </div>

      {/* Add row */}
      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-card p-3 mb-3 grid grid-cols-6 gap-2">
          <div className="col-span-2">
            <label className="field-label">Medication Name *</label>
            <input
              type="text"
              value={newMed.name || ''}
              onChange={e => setNewMed(p => ({ ...p, name: e.target.value }))}
              className="field-input text-xs"
              placeholder="Name"
              autoFocus
            />
          </div>
          <div>
            <label className="field-label">Route</label>
            <select value={newMed.route || ''} onChange={e => setNewMed(p => ({ ...p, route: e.target.value }))} className="field-input text-xs">
              <option value="">—</option>
              {routeOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Dosage</label>
            <input type="text" value={newMed.dosage || ''} onChange={e => setNewMed(p => ({ ...p, dosage: e.target.value }))} className="field-input text-xs" placeholder="e.g. 10mg" />
          </div>
          <div>
            <label className="field-label">Frequency</label>
            <select value={newMed.frequency || ''} onChange={e => setNewMed(p => ({ ...p, frequency: e.target.value }))} className="field-input text-xs">
              <option value="">—</option>
              {freqOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Prescribing MD</label>
            <input type="text" value={newMed.prescribing_md || ''} onChange={e => setNewMed(p => ({ ...p, prescribing_md: e.target.value }))} className="field-input text-xs" placeholder="Dr. Name" />
          </div>
          <div className="col-span-6 flex gap-2 mt-1">
            <button onClick={handleAdd} className="btn-primary text-xs px-3 py-1">Save Medication</button>
            <button onClick={() => { setAdding(false); setNewMed({}) }} className="btn-secondary text-xs px-3 py-1">Cancel</button>
          </div>
        </div>
      )}

      {meds.length === 0 && !adding ? (
        <p className="text-muted text-xs py-3 text-center border border-dashed border-border rounded-card">No medications on file</p>
      ) : (
        <div className="border border-border rounded-card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-page border-b border-border">
                <th className="text-left px-3 py-2 text-muted font-medium">Medication</th>
                <th className="text-left px-3 py-2 text-muted font-medium">Route</th>
                <th className="text-left px-3 py-2 text-muted font-medium">Dosage</th>
                <th className="text-left px-3 py-2 text-muted font-medium">Frequency</th>
                <th className="text-left px-3 py-2 text-muted font-medium">Indication</th>
                <th className="text-left px-3 py-2 text-muted font-medium">Prescribing MD</th>
                <th className="w-16 px-3 py-2 text-muted font-medium">Active</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {meds.map(m => (
                <tr key={m.id} className={m.is_active ? '' : 'opacity-50'}>
                  <td className="px-3 py-2 font-medium text-heading">{m.name}</td>
                  <td className="px-3 py-2 text-muted">{m.route || '—'}</td>
                  <td className="px-3 py-2 text-muted">{m.dosage || '—'}</td>
                  <td className="px-3 py-2 text-muted">{m.frequency || '—'}</td>
                  <td className="px-3 py-2 text-muted">{m.indication || '—'}</td>
                  <td className="px-3 py-2 text-muted">{m.prescribing_md || '—'}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleToggleActive(m)}
                      className={`w-8 h-4 rounded-full transition-colors ${m.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${m.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => handleDelete(m)} className="text-muted hover:text-red-500 transition-colors">
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

// ─── Treatment Plans sub-component ──────────────────────────────────────────
function TreatmentPlansPanel({ clientId }) {
  const [plans, setPlans] = useState([null, null, null, null])
  const [saving, setSaving] = useState({})

  useEffect(() => {
    api.get(`/clients/${clientId}/treatment-plans`).then(r => {
      const arr = [null, null, null, null]
      r.data.forEach(p => { arr[p.plan_number - 1] = p })
      setPlans(arr)
    }).catch(() => {})
  }, [clientId])

  const update = (idx, field, val) => {
    setPlans(prev => {
      const next = [...prev]
      next[idx] = { ...(next[idx] || { plan_number: idx + 1 }), [field]: val }
      return next
    })
  }

  const save = async (idx) => {
    const plan = plans[idx]
    if (!plan) return
    setSaving(s => ({ ...s, [idx]: true }))
    try {
      const r = await api.put(`/clients/${clientId}/treatment-plans/${idx + 1}`, plan)
      setPlans(prev => {
        const next = [...prev]; next[idx] = r.data; return next
      })
    } catch {}
    setSaving(s => ({ ...s, [idx]: false }))
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {plans.map((plan, idx) => (
        <div key={idx} className="bg-card border border-border rounded-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-heading">Treatment Plan — Problem {idx + 1}</h3>
            <button onClick={() => save(idx)} disabled={saving[idx]} className="btn-primary text-xs px-2.5 py-1 flex items-center gap-1">
              {saving[idx] ? <IconLoader2 size={11} className="animate-spin" /> : <IconDeviceFloppy size={11} />}
              Save
            </button>
          </div>
          <div className="space-y-2">
            <div>
              <label className="field-label">Problem</label>
              <Textarea value={plan?.problem} onChange={v => update(idx, 'problem', v)} rows={2} />
            </div>
            <div>
              <label className="field-label">Goals</label>
              <Textarea value={plan?.goals} onChange={v => update(idx, 'goals', v)} rows={2} />
            </div>
            <div>
              <label className="field-label">Objective</label>
              <Textarea value={plan?.objective} onChange={v => update(idx, 'objective', v)} rows={2} />
            </div>
            <div>
              <label className="field-label">Interventions</label>
              <Textarea value={plan?.interventions} onChange={v => update(idx, 'interventions', v)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="field-label">Target Date</label>
                <input type="date" value={plan?.target_date || ''} onChange={e => update(idx, 'target_date', e.target.value)} className="field-input text-xs" />
              </div>
              <div>
                <label className="field-label">Status</label>
                <select value={plan?.status || 'active'} onChange={e => update(idx, 'status', e.target.value)} className="field-input text-xs">
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ClientDetail component ─────────────────────────────────────────────
export default function ClientDetail() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const isNew = !clientId || clientId === 'new'

  const [activeTab, setActiveTab] = useState('general')
  const [client, setClient] = useState({})
  const [dropdowns, setDropdowns] = useState({})
  const [medDropdowns, setMedDropdowns] = useState({})
  const [workflowTabs, setWorkflowTabs] = useState(DEFAULT_TABS)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  // Load client + dropdowns — reset state on every navigation
  useEffect(() => {
    setClient({})
    setError(null)
    setSaved(false)

    api.get('/clients/dropdowns/client_general').then(r => setDropdowns(r.data)).catch(() => {})
    api.get('/clients/dropdowns/client_medications').then(r => setMedDropdowns(r.data)).catch(() => {})
    api.get('/workflow/tabs').then(r => setWorkflowTabs(r.data.filter(t => t.is_visible))).catch(() => {})

    if (!isNew) {
      setLoading(true)
      api.get(`/clients/${clientId}`)
        .then(r => setClient(r.data))
        .catch(() => setError('Client not found.'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [clientId, isNew])

  const set = (field, val) => setClient(prev => ({ ...prev, [field]: val }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      if (isNew) {
        const r = await api.post('/clients', client)
        navigate(`/clients/${r.data.id}`, { replace: true })
      } else {
        const r = await api.put(`/clients/${clientId}`, client)
        setClient(r.data)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-muted py-20">
        <IconLoader2 size={20} className="animate-spin" />
        Loading client…
      </div>
    )
  }

  return (
    <div className="flex gap-0 h-full">
      {/* Left sidebar — tab navigation */}
      <div className="w-40 shrink-0 bg-card border-r border-border flex flex-col">
        {/* Client photo / avatar */}
        <div className="p-3 border-b border-border flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border">
            {client.photo_s3_key ? (
              <img src={`/api/clients/${clientId}/photo`} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <IconUser size={28} className="text-primary/60" />
            )}
          </div>
          {!isNew && (
            <div className="text-center">
              <div className="text-xs font-semibold text-heading leading-tight">{client.display_name || '—'}</div>
              <div className="text-xs text-muted mt-0.5">{client.chart_id || 'No chart ID'}</div>
            </div>
          )}
        </div>

        {/* Tabs — loaded from workflow config */}
        <nav className="flex-1 overflow-y-auto py-1">
          {workflowTabs.map(t => (
            <button
              key={t.tab_key}
              onClick={() => setActiveTab(t.tab_key)}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                activeTab === t.tab_key
                  ? 'bg-primary text-white font-medium'
                  : 'text-muted hover:text-heading hover:bg-page'
              }`}
            >
              {t.label}
              {t.tab_type === 'custom' && (
                <span className="ml-1 text-xs opacity-60">✨</span>
              )}
            </button>
          ))}
        </nav>

        {/* Workflow settings link */}
        <div className="p-2 border-t border-border">
          <button
            onClick={() => navigate('/settings/workflow')}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted hover:text-heading hover:bg-page rounded transition-colors"
          >
            <IconSettings size={12} />
            Manage tabs
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {/* Topbar */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/clients')} className="text-muted hover:text-heading transition-colors">
              <IconArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-base font-semibold text-heading">
                {isNew ? 'New Client' : (client.full_name || 'Client Record')}
              </h1>
              {!isNew && client.pt_status && (
                <span className="text-xs text-muted capitalize">{client.pt_status}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-500">{error}</span>}
            {saved && <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconDeviceFloppy size={14} />}
              {isNew ? 'Create Client' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="p-5">
          {activeTab === 'general' && (
            <GeneralInfoTab client={client} set={set} dropdowns={dropdowns} isNew={isNew} clientId={clientId} medDropdowns={medDropdowns} />
          )}
          {activeTab === 'treatment' && !isNew && (
            <TreatmentPlansPanel clientId={clientId} />
          )}
          {/* Custom form tabs */}
          {!isNew && (() => {
            const tab = workflowTabs.find(t => t.tab_key === activeTab)
            if (tab?.tab_type === 'custom' && tab?.form_schema_id) {
              return <DynamicForm clientId={clientId} formSchemaId={tab.form_schema_id} />
            }
            return null
          })()}
          {/* Built-in placeholder tabs */}
          {activeTab !== 'general' && activeTab !== 'treatment' && (() => {
            const tab = workflowTabs.find(t => t.tab_key === activeTab)
            if (!tab || tab.tab_type !== 'custom') {
              return (
                <div className="text-center py-16 text-muted">
                  <p className="text-sm font-medium text-heading mb-1">{tab?.label || activeTab}</p>
                  <p className="text-sm">This module is coming soon.</p>
                </div>
              )
            }
            return null
          })()}
        </div>
      </div>
    </div>
  )
}

// ─── General Info tab ─────────────────────────────────────────────────────────
function GeneralInfoTab({ client, set, dropdowns, isNew, clientId, medDropdowns }) {
  const c = client
  const dd = dropdowns

  return (
    <div className="space-y-6">

      {/* HIT List warning */}
      {c.hit_list && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-card px-4 py-2.5 text-red-700 text-sm font-medium">
          <IconAlertTriangle size={16} />
          This client is on the HIT List
        </div>
      )}

      {/* ── ANSA / BIO / TP / PN tracking ─────────────────────────────── */}
      <div className="bg-card border border-border rounded-card p-4">
        <div className="grid grid-cols-6 gap-3">
          <SectionHeader title="Assessment & Authorization Dates" />
          <Field label="Last ANSA"><Input value={c.last_ansa_date} onChange={v => set('last_ansa_date', v)} type="date" /></Field>
          <Field label="Exp. ANSA"><Input value={c.exp_ansa_date} onChange={v => set('exp_ansa_date', v)} type="date" /></Field>
          <Field label="Last BIOS"><Input value={c.last_bios_date} onChange={v => set('last_bios_date', v)} type="date" /></Field>
          <Field label="Exp. BIOS"><Input value={c.exp_bios_date} onChange={v => set('exp_bios_date', v)} type="date" /></Field>
          <Field label="Last TP"><Input value={c.last_tp_date} onChange={v => set('last_tp_date', v)} type="date" /></Field>
          <Field label="Exp. TP"><Input value={c.exp_tp_date} onChange={v => set('exp_tp_date', v)} type="date" /></Field>
          <Field label="Last PN"><Input value={c.last_pn_date} onChange={v => set('last_pn_date', v)} type="date" /></Field>
          <Field label="Auth Start"><Input value={c.last_auth_start_date} onChange={v => set('last_auth_start_date', v)} type="date" /></Field>
          <Field label="Auth End"><Input value={c.last_auth_end_date} onChange={v => set('last_auth_end_date', v)} type="date" /></Field>
          <Field label="Auth Hrs/Units"><Input value={c.auth_hrs_units} onChange={v => set('auth_hrs_units', v)} placeholder="0.00" /></Field>
          <Field label="Avail Hrs/Units"><Input value={c.avail_hrs_units} onChange={v => set('avail_hrs_units', v)} placeholder="0.00" /></Field>
          <Field label="Last Visit"><Input value={c.last_visit_date} onChange={v => set('last_visit_date', v)} type="date" /></Field>
        </div>
      </div>

      {/* ── Name & Status ──────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-card p-4">
        <div className="grid grid-cols-6 gap-3">
          <SectionHeader title="Client Name & Status" />
          <Field label="Salutation">
            <Select value={c.salutation} onChange={v => set('salutation', v)} options={dd.salutation || []} />
          </Field>
          <Field label="First Name *" className="col-span-2">
            <Input value={c.first_name} onChange={v => set('first_name', v)} placeholder="First name" />
          </Field>
          <Field label="Middle Name">
            <Input value={c.middle_name} onChange={v => set('middle_name', v)} placeholder="Middle" />
          </Field>
          <Field label="Last Name *" className="col-span-2">
            <Input value={c.last_name} onChange={v => set('last_name', v)} placeholder="Last name" />
          </Field>
          <Field label="Suffix">
            <Input value={c.suffix} onChange={v => set('suffix', v)} placeholder="Jr., III…" />
          </Field>
          <Field label="LOC">
            <Select value={c.loc} onChange={v => set('loc', v)} options={dd.loc || []} />
          </Field>
          <Field label="Pt. Status">
            <Select value={c.pt_status} onChange={v => set('pt_status', v)} options={dd.pt_status || [
              { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' },
              { value: 'pending', label: 'Pending' }, { value: 'on_hold', label: 'On Hold' },
              { value: 'discharged', label: 'Discharged' },
            ]} />
          </Field>
          <Field label="Chart ID">
            <Input value={c.chart_id} onChange={v => set('chart_id', v)} placeholder="Chart #" />
          </Field>
          <Field label="Intake Date">
            <Input value={c.intake_date} onChange={v => set('intake_date', v)} type="date" />
          </Field>
          <Field label="HIT List" className="flex flex-col justify-end">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={!!c.hit_list} onChange={e => set('hit_list', e.target.checked)} className="w-4 h-4 accent-red-500" />
              <span className="text-sm text-heading">Yes</span>
            </label>
          </Field>
        </div>
      </div>

      {/* ── Demographics ───────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-card p-4">
        <div className="grid grid-cols-6 gap-3">
          <SectionHeader title="Demographics" />
          <Field label="Date of Birth">
            <Input value={c.date_of_birth} onChange={v => set('date_of_birth', v)} type="date" />
          </Field>
          <Field label="Birth Year">
            <Input value={c.birth_year} onChange={v => set('birth_year', v)} placeholder="YYYY" />
          </Field>
          <Field label="SSN">
            <Input value={c.ssn} onChange={v => set('ssn', v)} placeholder="XXX-XX-XXXX" />
          </Field>
          <Field label="Gender">
            <Select value={c.gender} onChange={v => set('gender', v)} options={dd.gender || []} />
          </Field>
          <Field label="Gender Expression">
            <Input value={c.gender_expression} onChange={v => set('gender_expression', v)} />
          </Field>
          <Field label="Gender Identifier">
            <Input value={c.gender_identifier} onChange={v => set('gender_identifier', v)} />
          </Field>
          <Field label="Gender Orientation">
            <Input value={c.gender_orientation} onChange={v => set('gender_orientation', v)} />
          </Field>
          <Field label="Marital Status">
            <Select value={c.marital_status} onChange={v => set('marital_status', v)} options={dd.marital_status || []} />
          </Field>
          <Field label="Race">
            <Select value={c.race} onChange={v => set('race', v)} options={dd.race || []} />
          </Field>
          <Field label="Ethnicity">
            <Input value={c.ethnicity} onChange={v => set('ethnicity', v)} />
          </Field>
          <Field label="65th Birthday">
            <Input value={c.birthday_65th} onChange={v => set('birthday_65th', v)} type="date" />
          </Field>
        </div>
      </div>

      {/* ── Insurance & Providers ──────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-card p-4">
        <div className="grid grid-cols-6 gap-3">
          <SectionHeader title="Insurance & Providers" />
          <Field label="Medicaid ID" className="col-span-2">
            <Input value={c.medicaid_id} onChange={v => set('medicaid_id', v)} />
          </Field>
          <Field label="Medicare ID" className="col-span-2">
            <Input value={c.medicare_id} onChange={v => set('medicare_id', v)} />
          </Field>
          <Field label="Subscriber ID" className="col-span-2">
            <Input value={c.subscriber_id} onChange={v => set('subscriber_id', v)} />
          </Field>
          <Field label="Ins. Vendor" className="col-span-2">
            <Input value={c.ins_vendor} onChange={v => set('ins_vendor', v)} />
          </Field>
          <Field label="Psych" className="col-span-2">
            <Input value={c.psych_name} onChange={v => set('psych_name', v)} placeholder="Psychiatrist name" />
          </Field>
          <Field label="PCP" className="col-span-2">
            <Input value={c.pcp_name} onChange={v => set('pcp_name', v)} placeholder="Primary care physician" />
          </Field>
          <Field label="Primary Care Physician" className="col-span-3">
            <Input value={c.primary_care_physician} onChange={v => set('primary_care_physician', v)} />
          </Field>
          <Field label="Psychiatric Medical Provider" className="col-span-3">
            <Input value={c.psychiatric_provider} onChange={v => set('psychiatric_provider', v)} />
          </Field>
        </div>
      </div>

      {/* ── LAI ────────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-card p-4">
        <div className="grid grid-cols-6 gap-3">
          <SectionHeader title="Long-Acting Injectable (LAI)" />
          <Field label="On a LAI?" className="flex flex-col justify-end">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={!!c.on_a_lai} onChange={e => set('on_a_lai', e.target.checked)} className="w-4 h-4 accent-blue-600" />
              <span className="text-sm text-heading">Yes</span>
            </label>
          </Field>
          {c.on_a_lai && (
            <>
              <Field label="If Yes, Which Medication" className="col-span-2">
                <Input value={c.lai_medication} onChange={v => set('lai_medication', v)} />
              </Field>
              <Field label="Injection Dates" className="col-span-3">
                <Input value={c.injection_dates} onChange={v => set('injection_dates', v)} placeholder="e.g. 1st of month, every 4 weeks…" />
              </Field>
            </>
          )}
        </div>
      </div>

      {/* ── Address ────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-card p-4">
        <div className="grid grid-cols-6 gap-3">
          <SectionHeader title="Address" />
          <Field label="Street" className="col-span-4">
            <Input value={c.address_line1} onChange={v => set('address_line1', v)} placeholder="Street address" />
          </Field>
          <Field label="Apt / Unit" className="col-span-2">
            <Input value={c.address_line2} onChange={v => set('address_line2', v)} placeholder="Apt, Suite…" />
          </Field>
          <Field label="City" className="col-span-2">
            <Input value={c.city} onChange={v => set('city', v)} />
          </Field>
          <Field label="State">
            <Input value={c.state} onChange={v => set('state', v)} placeholder="TX" />
          </Field>
          <Field label="Zip">
            <Input value={c.zip_code} onChange={v => set('zip_code', v)} placeholder="12345" />
          </Field>
          <Field label="County">
            <Input value={c.county} onChange={v => set('county', v)} />
          </Field>
          <Field label="SDA">
            <Input value={c.sda} onChange={v => set('sda', v)} />
          </Field>
        </div>
      </div>

      {/* ── Contact ────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-card p-4">
        <div className="grid grid-cols-6 gap-3">
          <SectionHeader title="Contact" />
          <Field label="Phone" className="col-span-2">
            <Input value={c.phone} onChange={v => set('phone', v)} placeholder="(555) 555-5555" type="tel" />
          </Field>
          <Field label="Email" className="col-span-3">
            <Input value={c.email} onChange={v => set('email', v)} placeholder="email@example.com" type="email" />
          </Field>
          <Field label="Case Manager" className="col-span-2">
            <Input value={c.assigned_cm_id} onChange={v => set('assigned_cm_id', v)} placeholder="Select CM…" />
          </Field>
          <Field label="Emergency Contact" className="col-span-3">
            <Input
              value={typeof c.emergency_contact === 'object' ? (c.emergency_contact?.name || '') : ''}
              onChange={v => set('emergency_contact', { ...(c.emergency_contact || {}), name: v })}
              placeholder="Name and phone"
            />
          </Field>
          <Field label="Legal Guardian" className="col-span-3">
            <Input value={c.legal_guardian} onChange={v => set('legal_guardian', v)} />
          </Field>
        </div>
      </div>

      {/* ── Diagnoses ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-card p-4">
        <div className="grid grid-cols-4 gap-3">
          <SectionHeader title="Diagnoses" />
          {['I', 'II', 'III', 'IV'].map((num, idx) => (
            <Field key={num} label={`DX ${num}`}>
              <Input
                value={Array.isArray(c.diagnosis_codes) ? (c.diagnosis_codes[idx]?.code || '') : ''}
                onChange={v => {
                  const arr = Array.isArray(c.diagnosis_codes) ? [...c.diagnosis_codes] : []
                  arr[idx] = { ...(arr[idx] || {}), code: v }
                  set('diagnosis_codes', arr)
                }}
                placeholder="F32.1"
              />
            </Field>
          ))}
        </div>
      </div>

      {/* ── Pre-Auth ───────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-card p-4">
        <div className="grid grid-cols-4 gap-3">
          <SectionHeader title="Pre-Auth Cross Reference" />
          <Field label="Pre Auth Status">
            <Input value={c.pre_auth_status} onChange={v => set('pre_auth_status', v)} />
          </Field>
          <Field label="Pre Auth CM 1">
            <Input value={c.pre_auth_cm1} onChange={v => set('pre_auth_cm1', v)} />
          </Field>
          <Field label="Pre Auth CM 2">
            <Input value={c.pre_auth_cm2} onChange={v => set('pre_auth_cm2', v)} />
          </Field>
          <Field label="Pre Auth ANSA">
            <Input value={c.pre_auth_ansa} onChange={v => set('pre_auth_ansa', v)} />
          </Field>
        </div>
      </div>

      {/* ── MC Note 2 ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-card p-4">
        <Field label="MC Note 2">
          <Textarea value={c.mc_note2} onChange={v => set('mc_note2', v)} rows={3} />
        </Field>
      </div>

      {/* ── Medications ───────────────────────────────────────────────── */}
      {!isNew && (
        <div className="bg-card border border-border rounded-card p-4">
          <MedicationsPanel clientId={clientId} dropdowns={medDropdowns} />
        </div>
      )}

    </div>
  )
}
