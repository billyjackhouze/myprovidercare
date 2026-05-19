/**
 * FormEdit — Edit form fields OR configure automation rules.
 * Route: /forms/:id/edit
 * Tabs: Fields | Automation
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  IconArrowLeft, IconPlus, IconTrash, IconCheck,
  IconLoader2, IconChevronDown, IconChevronUp, IconPencil,
  IconDeviceFloppy, IconSettings2, IconSparkles, IconShieldCheck,
} from '@tabler/icons-react'

// Aliases so the rest of the file doesn't need changing
const IconZap  = IconSettings2
const IconBolt = IconSparkles
import api from '@/lib/api'

const FIELD_TYPES = [
  { value: 'text',         label: 'Text' },
  { value: 'textarea',     label: 'Text Area' },
  { value: 'number',       label: 'Number' },
  { value: 'email',        label: 'Email' },
  { value: 'phone',        label: 'Phone' },
  { value: 'date',         label: 'Date' },
  { value: 'time',         label: 'Time' },
  { value: 'dropdown',     label: 'Dropdown' },
  { value: 'radio',        label: 'Radio Buttons' },
  { value: 'boolean',      label: 'Yes / No' },
  { value: 'signature',    label: 'Signature' },
  { value: 'calculated',   label: '🧮 Calculated' },
  { value: 'client_name',  label: '⚡ Client Name' },
  { value: 'cm_name',      label: '⚡ CM Name' },
  { value: 'visit_date',   label: '⚡ Visit Date' },
]

function toSnakeCase(str) {
  return str.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FormEdit() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('fields')

  const [schema, setSchema]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/forms/${id}`)
      .then(r => setSchema(r.data))
      .catch(() => toast.error('Could not load form'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center gap-2 text-muted py-12 justify-center">
      <IconLoader2 size={18} className="animate-spin" /> Loading…
    </div>
  )
  if (!schema) return null

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/forms')} className="text-muted hover:text-heading">
          <IconArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-medium text-heading">Edit — {schema.name}</h1>
          <p className="text-muted text-sm mt-0.5">Manage fields and automation rules for this form</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-page border border-border rounded-card p-1 w-fit">
        <button
          onClick={() => setActiveTab('fields')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            activeTab === 'fields' ? 'bg-white text-heading shadow-sm' : 'text-muted hover:text-heading'
          }`}
        >
          <IconPencil size={13} /> Fields
        </button>
        <button
          onClick={() => setActiveTab('automation')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            activeTab === 'automation' ? 'bg-white text-heading shadow-sm' : 'text-muted hover:text-heading'
          }`}
        >
          <IconZap size={13} /> Automation
        </button>
      </div>

      {activeTab === 'fields'     && <FieldsTab schema={schema} formId={id} onSchemaChange={setSchema} navigate={navigate} />}
      {activeTab === 'automation' && <AutomationTab formId={id} schema={schema} />}
    </div>
  )
}

// ─── Fields Tab ───────────────────────────────────────────────────────────────
function FieldsTab({ schema, formId, onSchemaChange, navigate }) {
  const [newFields, setNewFields]   = useState([])
  const [editedFields, setEditedFields] = useState({})
  const [savingNew, setSavingNew]   = useState(false)
  const [savingEdit, setSavingEdit] = useState({})

  const addField = (sectionKey) => {
    setNewFields(prev => [...prev, {
      _tempId: `tmp_${Date.now()}`,
      field_key: '', label: '', field_type: 'text',
      section_key: sectionKey, order_index: 9999,
      is_required: false, options: [], placeholder: '', validation: null,
    }])
  }

  const updateNewField = (tempId, patch) => {
    setNewFields(prev => prev.map(f => {
      if (f._tempId !== tempId) return f
      const updated = { ...f, ...patch }
      if (patch.label !== undefined && !f._keyTouched) {
        updated.field_key = toSnakeCase(patch.label)
      }
      return updated
    }))
  }

  const touchKey = (tempId, val) => {
    setNewFields(prev => prev.map(f =>
      f._tempId === tempId ? { ...f, field_key: toSnakeCase(val), _keyTouched: true } : f
    ))
  }

  const removeNewField = (tempId) => setNewFields(prev => prev.filter(f => f._tempId !== tempId))

  const handleSaveNew = async () => {
    if (!newFields.length) return toast.error('Add at least one new field')
    const invalid = newFields.find(f => !f.field_key || !f.label)
    if (invalid) return toast.error('All fields need a label')
    setSavingNew(true)
    try {
      await api.post(`/forms/${formId}/fields`, {
        fields: newFields.map(({ _tempId, _keyTouched, ...f }) => f),
        sections: [],
      })
      toast.success(`${newFields.length} field${newFields.length !== 1 ? 's' : ''} added!`)
      const r = await api.get(`/forms/${formId}`)
      onSchemaChange(r.data)
      setNewFields([])
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed')
    } finally { setSavingNew(false) }
  }

  const patchExisting = (fieldId, patch) => {
    setEditedFields(prev => ({ ...prev, [fieldId]: { ...(prev[fieldId] || {}), ...patch } }))
  }

  const saveExisting = async (fieldId) => {
    const patch = editedFields[fieldId]
    if (!patch || !Object.keys(patch).length) return
    setSavingEdit(prev => ({ ...prev, [fieldId]: true }))
    try {
      await api.put(`/forms/${formId}/fields/${fieldId}`, patch)
      toast.success('Field saved')
      const r = await api.get(`/forms/${formId}`)
      onSchemaChange(r.data)
      setEditedFields(prev => { const n = { ...prev }; delete n[fieldId]; return n })
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed')
    } finally {
      setSavingEdit(prev => { const n = { ...prev }; delete n[fieldId]; return n })
    }
  }

  const sections = schema.sections || []
  const allExistingKeys = sections.flatMap(s => (s.fields || []).map(f => f.field_key))

  return (
    <>
      {sections.map(sec => {
        const sectionNewFields = newFields.filter(f => f.section_key === sec.section_key)
        return (
          <div key={sec.section_key} className="bg-card border border-border rounded-card mb-4 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-page">
              <h2 className="text-sm font-semibold text-heading">{sec.title}</h2>
              <button className="text-xs text-primary flex items-center gap-1" onClick={() => addField(sec.section_key)}>
                <IconPlus size={12} /> Add field
              </button>
            </div>
            <div className="p-4 space-y-1.5">
              {(sec.fields || []).map(field => {
                const patch  = editedFields[field.id] || {}
                const merged = { ...field, ...patch }
                return (
                  <ExistingFieldEditor
                    key={field.id}
                    field={merged}
                    isDirty={Object.keys(patch).length > 0}
                    saving={savingEdit[field.id]}
                    onChange={p => patchExisting(field.id, p)}
                    onSave={() => saveExisting(field.id)}
                  />
                )
              })}
              {(sec.fields || []).length === 0 && sectionNewFields.length === 0 && (
                <p className="text-xs text-muted italic">No fields yet — add one below</p>
              )}
              {sectionNewFields.map(field => (
                <NewFieldEditor
                  key={field._tempId}
                  field={field}
                  allExistingKeys={allExistingKeys}
                  onChange={patch => updateNewField(field._tempId, patch)}
                  onKeyChange={val => touchKey(field._tempId, val)}
                  onRemove={() => removeNewField(field._tempId)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {newFields.length > 0 && (
        <div className="sticky bottom-4 bg-card border border-primary rounded-card px-5 py-3 flex items-center justify-between shadow-lg">
          <span className="text-sm text-heading font-medium">
            {newFields.length} new field{newFields.length !== 1 ? 's' : ''} ready to save
          </span>
          <button className="btn-primary flex items-center gap-2 text-sm" onClick={handleSaveNew} disabled={savingNew}>
            {savingNew ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />}
            Save New Fields
          </button>
        </div>
      )}
      <div className="flex justify-start mt-3">
        <button className="btn-secondary text-sm" onClick={() => navigate('/forms')}>← Back to Forms</button>
      </div>
    </>
  )
}

// ─── Automation Tab ───────────────────────────────────────────────────────────
function AutomationTab({ formId, schema }) {
  const [rules, setRules]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingRule, setEditingRule] = useState(null)   // null = creating new

  const allFields = (schema?.sections || []).flatMap(s => s.fields || [])

  const load = useCallback(() => {
    api.get(`/automation/forms/${formId}/rules`)
      .then(r => setRules(r.data))
      .catch(() => toast.error('Could not load automation rules'))
      .finally(() => setLoading(false))
  }, [formId])

  useEffect(() => { load() }, [load])

  const toggleActive = async (rule) => {
    try {
      await api.put(`/automation/forms/${formId}/rules/${rule.id}`, { is_active: !rule.is_active })
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
    } catch { toast.error('Failed to update rule') }
  }

  const deleteRule = async (ruleId) => {
    if (!confirm('Delete this automation rule?')) return
    try {
      await api.delete(`/automation/forms/${formId}/rules/${ruleId}`)
      setRules(prev => prev.filter(r => r.id !== ruleId))
      toast.success('Rule deleted')
    } catch { toast.error('Failed to delete rule') }
  }

  const onSaved = (rule, isNew) => {
    if (isNew) {
      setRules(prev => [...prev, rule])
    } else {
      setRules(prev => prev.map(r => r.id === rule.id ? rule : r))
    }
    setShowBuilder(false)
    setEditingRule(null)
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-muted py-8 justify-center">
      <IconLoader2 size={16} className="animate-spin" /> Loading rules…
    </div>
  )

  return (
    <div>
      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-card px-4 py-3 mb-4 flex gap-3">
        <IconBolt size={16} className="text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800">
          <strong>How automation works:</strong> Rules fire when this form is submitted (or when a field changes).
          Each rule can check conditions, then run steps in order — notify a user, send an email, create a task, call a webhook, and more.
          Multiple rules run in sequence; all are evaluated independently.
        </div>
      </div>

      {/* Rule list */}
      <div className="space-y-3 mb-4">
        {rules.length === 0 && !showBuilder && (
          <div className="bg-card border border-dashed border-border rounded-card px-5 py-10 text-center">
            <IconZap size={24} className="mx-auto text-muted mb-2" />
            <p className="text-sm text-muted">No automation rules yet.</p>
            <p className="text-xs text-muted mt-1">Add a rule to trigger actions when this form is submitted.</p>
          </div>
        )}
        {rules.map(rule => (
          <RuleCard
            key={rule.id}
            rule={rule}
            allFields={allFields}
            onToggle={() => toggleActive(rule)}
            onEdit={() => { setEditingRule(rule); setShowBuilder(true) }}
            onDelete={() => deleteRule(rule.id)}
          />
        ))}
      </div>

      {/* Inline rule builder */}
      {showBuilder && (
        <RuleBuilder
          formId={formId}
          allFields={allFields}
          existing={editingRule}
          onSaved={onSaved}
          onCancel={() => { setShowBuilder(false); setEditingRule(null) }}
        />
      )}

      {!showBuilder && (
        <button
          className="btn-primary flex items-center gap-2 text-sm"
          onClick={() => { setEditingRule(null); setShowBuilder(true) }}
        >
          <IconPlus size={14} /> Add Automation Rule
        </button>
      )}
    </div>
  )
}

// ── Rule summary card ──────────────────────────────────────────────────────────
function RuleCard({ rule, allFields, onToggle, onEdit, onDelete }) {
  const triggerLabel = rule.trigger_type === 'on_submit' ? 'On form submit' : `When field "${rule.trigger_field_key}" changes`
  const condCount    = (rule.conditions || []).length
  const actCount     = (rule.actions || []).length

  return (
    <div className={`bg-card border rounded-card overflow-hidden ${rule.is_active ? 'border-border' : 'border-border opacity-60'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Toggle */}
        <button
          onClick={onToggle}
          title={rule.is_active ? 'Disable rule' : 'Enable rule'}
          className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${rule.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}
        >
          <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${rule.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-heading truncate">{rule.name}</span>
            {!rule.is_active && <span className="text-xs text-muted bg-page border border-border px-1.5 py-0.5 rounded">Disabled</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted">
            <span className="flex items-center gap-1"><IconZap size={11} />{triggerLabel}</span>
            {condCount > 0 && <span>{condCount} condition{condCount !== 1 ? 's' : ''}</span>}
            <span className="flex items-center gap-1"><IconBolt size={11} />{actCount} action{actCount !== 1 ? 's' : ''}</span>
          </div>
          {rule.description && <p className="text-xs text-muted mt-0.5 truncate">{rule.description}</p>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onEdit} className="text-xs px-2.5 py-1 rounded border border-border text-muted hover:text-heading hover:bg-page transition-colors flex items-center gap-1">
            <IconPencil size={11} /> Edit
          </button>
          <button onClick={onDelete} className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
            <IconTrash size={11} />
          </button>
        </div>
      </div>

      {/* Step preview */}
      {(rule.actions || []).length > 0 && (
        <div className="border-t border-border px-4 py-2 bg-page flex items-center gap-2 flex-wrap">
          {rule.actions.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs bg-white border border-border rounded px-2 py-0.5 text-muted">
              <span className="text-primary font-semibold">{i + 1}.</span>
              {ACTION_TYPE_LABELS[a.type] || a.type}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Rule Builder ──────────────────────────────────────────────────────────────
const ACTION_TYPE_LABELS = {
  notify_user:     'Notify User',
  send_email:      'Send Email',
  create_task:     'Create Task',
  set_field_value: 'Set Field Value',
  webhook:         'Call Webhook',
}

const CONDITION_OPERATORS = [
  { value: 'is_filled',  label: 'is filled' },
  { value: 'is_empty',   label: 'is empty' },
  { value: 'eq',         label: 'equals' },
  { value: 'neq',        label: 'does not equal' },
  { value: 'contains',   label: 'contains' },
  { value: 'gt',         label: 'is greater than' },
  { value: 'lt',         label: 'is less than' },
]

function RuleBuilder({ formId, allFields, existing, onSaved, onCancel }) {
  const isEdit = !!existing
  const [saving, setSaving] = useState(false)

  const [name, setName]           = useState(existing?.name || '')
  const [description, setDesc]    = useState(existing?.description || '')
  const [triggerType, setTrigger] = useState(existing?.trigger_type || 'on_submit')
  const [triggerField, setTField] = useState(existing?.trigger_field_key || '')
  const [conditions, setConds]    = useState(existing?.conditions || [])
  const [actions, setActions]     = useState(existing?.actions || [])

  const addCondition = () => setConds(prev => [...prev, { field_key: allFields[0]?.field_key || '', operator: 'is_filled', value: '' }])
  const updateCondition = (i, patch) => setConds(prev => prev.map((c, j) => j === i ? { ...c, ...patch } : c))
  const removeCondition = (i) => setConds(prev => prev.filter((_, j) => j !== i))

  const addAction = () => setActions(prev => [...prev, { type: 'notify_user', config: {} }])
  const updateAction = (i, patch) => setActions(prev => prev.map((a, j) => j === i ? { ...a, ...patch } : a))
  const removeAction = (i) => setActions(prev => prev.filter((_, j) => j !== i))
  const moveAction = (i, dir) => {
    setActions(prev => {
      const a = [...prev]
      const j = i + dir
      if (j < 0 || j >= a.length) return a
      ;[a[i], a[j]] = [a[j], a[i]]
      return a
    })
  }

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Rule name is required')
    if (actions.length === 0) return toast.error('Add at least one action')
    setSaving(true)
    const payload = {
      name, description,
      trigger_type: triggerType,
      trigger_field_key: triggerType === 'field_change' ? triggerField : null,
      conditions, actions,
    }
    try {
      let result
      if (isEdit) {
        result = (await api.put(`/automation/forms/${formId}/rules/${existing.id}`, payload)).data
      } else {
        result = (await api.post(`/automation/forms/${formId}/rules`, payload)).data
      }
      toast.success(isEdit ? 'Rule updated' : 'Automation rule created')
      onSaved(result, !isEdit)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-card border border-primary/30 rounded-card overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-border bg-page flex items-center justify-between">
        <h3 className="text-sm font-semibold text-heading flex items-center gap-1.5">
          <IconZap size={14} className="text-amber-500" />
          {isEdit ? 'Edit Rule' : 'New Automation Rule'}
        </h3>
        <button onClick={onCancel} className="text-muted hover:text-heading text-xs">Cancel</button>
      </div>

      <div className="p-5 space-y-5">
        {/* Name & description */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="field-label">Rule Name <span className="text-red-400">*</span></label>
            <input
              className="field-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='e.g. "Notify Music Director on Submit"'
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="field-label">Description (optional)</label>
            <input className="field-input" value={description} onChange={e => setDesc(e.target.value)} placeholder="What does this rule do?" />
          </div>
        </div>

        {/* Trigger */}
        <div className="border border-border rounded-card p-4 bg-page">
          <p className="text-xs font-semibold text-heading mb-3 uppercase tracking-wide">⚡ Trigger — When does this rule fire?</p>
          <div className="flex gap-3">
            <label className={`flex-1 flex items-center gap-2 cursor-pointer border rounded-card px-3 py-2 text-sm transition-colors ${triggerType === 'on_submit' ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border bg-white text-muted hover:border-gray-300'}`}>
              <input type="radio" name="trigger" value="on_submit" checked={triggerType === 'on_submit'} onChange={() => setTrigger('on_submit')} className="sr-only" />
              When form is submitted
            </label>
            <label className={`flex-1 flex items-center gap-2 cursor-pointer border rounded-card px-3 py-2 text-sm transition-colors ${triggerType === 'field_change' ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border bg-white text-muted hover:border-gray-300'}`}>
              <input type="radio" name="trigger" value="field_change" checked={triggerType === 'field_change'} onChange={() => setTrigger('field_change')} className="sr-only" />
              When a specific field changes
            </label>
          </div>
          {triggerType === 'field_change' && (
            <div className="mt-3">
              <label className="field-label">Which field?</label>
              <select className="field-input" value={triggerField} onChange={e => setTField(e.target.value)}>
                <option value="">— Select a field —</option>
                {allFields.map(f => <option key={f.field_key} value={f.field_key}>{f.label} ({f.field_key})</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Conditions */}
        <div className="border border-border rounded-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-heading uppercase tracking-wide">🔍 Conditions (optional — all must match)</p>
            <button onClick={addCondition} className="text-xs text-primary flex items-center gap-1">
              <IconPlus size={11} /> Add condition
            </button>
          </div>
          {conditions.length === 0 && (
            <p className="text-xs text-muted italic">No conditions — rule always runs on trigger</p>
          )}
          {conditions.map((cond, i) => (
            <div key={i} className="flex gap-2 items-center mb-2">
              <select
                className="field-input flex-1"
                value={cond.field_key}
                onChange={e => updateCondition(i, { field_key: e.target.value })}
              >
                <option value="">Field…</option>
                {allFields.map(f => <option key={f.field_key} value={f.field_key}>{f.label}</option>)}
              </select>
              <select
                className="field-input w-40"
                value={cond.operator}
                onChange={e => updateCondition(i, { operator: e.target.value })}
              >
                {CONDITION_OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {!['is_filled', 'is_empty'].includes(cond.operator) && (
                <input
                  className="field-input w-32"
                  placeholder="Value"
                  value={cond.value || ''}
                  onChange={e => updateCondition(i, { value: e.target.value })}
                />
              )}
              <button onClick={() => removeCondition(i)} className="text-muted hover:text-red-500 shrink-0">
                <IconTrash size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="border border-border rounded-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-heading uppercase tracking-wide">⚙️ Actions — Run these steps in order</p>
            <button onClick={addAction} className="text-xs text-primary flex items-center gap-1">
              <IconPlus size={11} /> Add step
            </button>
          </div>
          {actions.length === 0 && (
            <p className="text-xs text-muted italic">No actions yet — add at least one step</p>
          )}
          {actions.map((action, i) => (
            <ActionEditor
              key={i}
              index={i}
              total={actions.length}
              action={action}
              allFields={allFields}
              onChange={patch => updateAction(i, patch)}
              onRemove={() => removeAction(i)}
              onMove={dir => moveAction(i, dir)}
            />
          ))}
        </div>

        {/* Save */}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-1.5">
            {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />}
            {isEdit ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Action row editor ─────────────────────────────────────────────────────────
function ActionEditor({ index, total, action, allFields, onChange, onRemove, onMove }) {
  const updateConfig = (patch) => onChange({ config: { ...action.config, ...patch } })

  return (
    <div className="border border-border rounded-card bg-white mb-2 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-page border-b border-border">
        {/* Step number */}
        <span className="w-5 h-5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>

        {/* Type selector */}
        <select
          className="flex-1 text-sm border-0 bg-transparent font-medium text-heading focus:outline-none focus:ring-0 cursor-pointer"
          value={action.type}
          onChange={e => onChange({ type: e.target.value, config: {} })}
        >
          {Object.entries(ACTION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        {/* Move up/down */}
        <button disabled={index === 0} onClick={() => onMove(-1)} className="text-muted hover:text-heading disabled:opacity-30 p-0.5">▲</button>
        <button disabled={index === total - 1} onClick={() => onMove(1)} className="text-muted hover:text-heading disabled:opacity-30 p-0.5">▼</button>
        <button onClick={onRemove} className="text-muted hover:text-red-500 p-0.5">
          <IconTrash size={13} />
        </button>
      </div>

      {/* Config fields per action type */}
      <div className="p-3 grid grid-cols-2 gap-3">
        {action.type === 'notify_user' && (
          <>
            <div className="col-span-2">
              <label className="field-label">Message</label>
              <input
                className="field-input"
                placeholder="e.g. A new referral form has been submitted."
                value={action.config.message || ''}
                onChange={e => updateConfig({ message: e.target.value })}
              />
              <p className="text-xs text-muted mt-0.5">Use <code className="bg-page px-0.5 rounded">{'{client_name}'}</code> and <code className="bg-page px-0.5 rounded">{'{submitted_by}'}</code> as placeholders.</p>
            </div>
            <div className="col-span-2">
              <label className="field-label">Notify User (user ID or email)</label>
              <input
                className="field-input"
                placeholder="User email or leave blank for all supervisors"
                value={action.config.user_id || ''}
                onChange={e => updateConfig({ user_id: e.target.value })}
              />
            </div>
          </>
        )}

        {action.type === 'send_email' && (
          <>
            <div>
              <label className="field-label">To (email address)</label>
              <input className="field-input" placeholder="director@example.com" value={action.config.to || ''} onChange={e => updateConfig({ to: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Subject</label>
              <input className="field-input" placeholder="Form submitted" value={action.config.subject || ''} onChange={e => updateConfig({ subject: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="field-label">Email Body</label>
              <textarea className="field-input h-20 resize-none" placeholder="A form was submitted. Client: {client_name}..." value={action.config.body || ''} onChange={e => updateConfig({ body: e.target.value })} />
            </div>
          </>
        )}

        {action.type === 'create_task' && (
          <>
            <div className="col-span-2">
              <label className="field-label">Task Title</label>
              <input className="field-input" placeholder="e.g. Review submitted form for {client_name}" value={action.config.title || ''} onChange={e => updateConfig({ title: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Assign To (user email)</label>
              <input className="field-input" placeholder="manager@example.com" value={action.config.assigned_to || ''} onChange={e => updateConfig({ assigned_to: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Priority</label>
              <select className="field-input" value={action.config.priority || 'normal'} onChange={e => updateConfig({ priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </>
        )}

        {action.type === 'set_field_value' && (
          <>
            <div>
              <label className="field-label">Field to set</label>
              <select className="field-input" value={action.config.field_key || ''} onChange={e => updateConfig({ field_key: e.target.value })}>
                <option value="">— Select field —</option>
                {allFields.map(f => <option key={f.field_key} value={f.field_key}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Value</label>
              <input className="field-input" placeholder="Value to set" value={action.config.value || ''} onChange={e => updateConfig({ value: e.target.value })} />
            </div>
          </>
        )}

        {action.type === 'webhook' && (
          <>
            <div className="col-span-2">
              <label className="field-label">Webhook URL (POST)</label>
              <input className="field-input font-mono text-xs" placeholder="https://hooks.example.com/…" value={action.config.url || ''} onChange={e => updateConfig({ url: e.target.value })} />
              <p className="text-xs text-muted mt-0.5">NationalCM will POST a JSON payload with the form data to this URL.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Existing field editor ────────────────────────────────────────────────────
function ExistingFieldEditor({ field, isDirty, saving, onChange, onSave }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`border rounded-card ${isDirty ? 'border-amber-300 bg-amber-50/40' : 'border-border bg-white'}`}>
      <div className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50/50 rounded-card" onClick={() => setOpen(v => !v)}>
        <IconPencil size={12} className="text-muted shrink-0" />
        <span className="flex-1 text-sm font-medium text-heading truncate">{field.label}</span>
        <span className="text-xs bg-page border border-border px-1.5 py-0.5 rounded text-muted font-mono shrink-0">{field.field_key}</span>
        <span className="text-xs text-muted shrink-0">{FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}</span>
        {isDirty && (
          <button className="btn-primary text-xs px-2 py-1 flex items-center gap-1 shrink-0" onClick={e => { e.stopPropagation(); onSave() }} disabled={saving}>
            {saving ? <IconLoader2 size={11} className="animate-spin" /> : <IconDeviceFloppy size={11} />} Save
          </button>
        )}
        {open ? <IconChevronUp size={14} className="text-muted shrink-0" /> : <IconChevronDown size={14} className="text-muted shrink-0" />}
      </div>

      {open && (
        <div className="px-3 pb-3 border-t border-border grid grid-cols-2 gap-3 pt-3">
          <div>
            <label className="field-label">Label</label>
            <input className="field-input" value={field.label} onChange={e => onChange({ label: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Field Type</label>
            <select className="field-input" value={field.field_type} onChange={e => onChange({ field_type: e.target.value })}>
              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Placeholder</label>
            <input className="field-input" value={field.placeholder || ''} onChange={e => onChange({ placeholder: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 pt-4">
            <input type="checkbox" id={`req-${field.id}`} checked={!!field.is_required} onChange={e => onChange({ is_required: e.target.checked })} />
            <label htmlFor={`req-${field.id}`} className="text-sm cursor-pointer">Required</label>
          </div>
          {field.field_type === 'calculated' && (
            <div className="col-span-2">
              <label className="field-label">Formula <span className="ml-1 font-normal text-muted">— e.g. <code className="bg-page px-1 rounded text-xs">hours * 4</code></span></label>
              <input className="field-input font-mono text-xs" value={field.validation?.formula || ''} placeholder="hours * 4" onChange={e => onChange({ validation: { ...(field.validation || {}), formula: e.target.value } })} />
            </div>
          )}
          {['dropdown', 'radio'].includes(field.field_type) && (
            <div className="col-span-2">
              <label className="field-label">Options</label>
              {(field.options || []).map((opt, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <input className="field-input" placeholder="Label" value={opt.label || opt} onChange={e => {
                    const opts = [...(field.options || [])]
                    opts[i] = { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') }
                    onChange({ options: opts })
                  }} />
                  <button className="text-muted hover:text-red-500" onClick={() => onChange({ options: (field.options || []).filter((_, j) => j !== i) })}><IconTrash size={13} /></button>
                </div>
              ))}
              <button className="text-xs text-primary flex items-center gap-1 mt-1" onClick={() => onChange({ options: [...(field.options || []), { label: '', value: '' }] })}>
                <IconPlus size={11} /> Add option
              </button>
            </div>
          )}
          {isDirty && (
            <div className="col-span-2 flex justify-end">
              <button className="btn-primary text-sm flex items-center gap-1.5" onClick={onSave} disabled={saving}>
                {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconDeviceFloppy size={14} />} Save Changes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── New field editor ─────────────────────────────────────────────────────────
function NewFieldEditor({ field, allExistingKeys, onChange, onKeyChange, onRemove }) {
  const [open, setOpen] = useState(true)
  const keyConflict = allExistingKeys.includes(field.field_key) && field.field_key !== ''

  return (
    <div className="border border-primary/40 bg-primary/5 rounded-card">
      <div className="flex items-center gap-3 px-3 py-2 cursor-pointer" onClick={() => setOpen(v => !v)}>
        <IconPlus size={12} className="text-primary shrink-0" />
        <span className="flex-1 text-sm font-medium text-heading truncate">{field.label || <span className="text-muted italic">New field…</span>}</span>
        <span className="text-xs bg-white border border-border px-1.5 py-0.5 rounded text-muted font-mono shrink-0">{field.field_key || '—'}</span>
        {open ? <IconChevronUp size={14} className="text-muted shrink-0" /> : <IconChevronDown size={14} className="text-muted shrink-0" />}
        <button className="text-muted hover:text-red-500 p-0.5 shrink-0" onClick={e => { e.stopPropagation(); onRemove() }}><IconTrash size={14} /></button>
      </div>

      {open && (
        <div className="px-3 pb-3 border-t border-primary/20 grid grid-cols-2 gap-3 pt-3">
          <div>
            <label className="field-label">Label</label>
            <input className="field-input" value={field.label} autoFocus onChange={e => onChange({ label: e.target.value })} placeholder="e.g. Hours Authorized" />
          </div>
          <div>
            <label className="field-label">Field Type</label>
            <select className="field-input" value={field.field_type} onChange={e => onChange({ field_type: e.target.value })}>
              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="field-label">Field Key <span className="ml-1 font-normal text-muted">(auto-filled — edit if needed)</span></label>
            <input className={`field-input font-mono text-xs ${keyConflict ? 'border-red-400' : ''}`} value={field.field_key} onChange={e => onKeyChange(e.target.value)} placeholder="hours_authorized" />
            {keyConflict && <p className="text-xs text-red-500 mt-0.5">This key already exists</p>}
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id={`req-${field._tempId}`} checked={field.is_required} onChange={e => onChange({ is_required: e.target.checked })} />
            <label htmlFor={`req-${field._tempId}`} className="text-sm cursor-pointer">Required</label>
          </div>
          <div>
            <label className="field-label">Placeholder</label>
            <input className="field-input" value={field.placeholder || ''} onChange={e => onChange({ placeholder: e.target.value })} />
          </div>
          {field.field_type === 'calculated' && (
            <div className="col-span-2">
              <label className="field-label">Formula</label>
              <input className="field-input font-mono text-xs" value={field.validation?.formula || ''} placeholder="hours * 4" onChange={e => onChange({ validation: { ...(field.validation || {}), formula: e.target.value } })} />
              <p className="text-xs text-muted mt-1">1 unit = 15 min → <code>hours * 4</code> gives units.</p>
            </div>
          )}
          {['dropdown', 'radio'].includes(field.field_type) && (
            <div className="col-span-2">
              <label className="field-label">Options</label>
              {(field.options || []).map((opt, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <input className="field-input" placeholder="Option label" value={opt.label} onChange={e => {
                    const opts = [...field.options]
                    opts[i] = { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') }
                    onChange({ options: opts })
                  }} />
                  <button className="text-muted hover:text-red-500" onClick={() => onChange({ options: field.options.filter((_, j) => j !== i) })}><IconTrash size={13} /></button>
                </div>
              ))}
              <button className="text-xs text-primary flex items-center gap-1 mt-1" onClick={() => onChange({ options: [...(field.options || []), { label: '', value: '' }] })}>
                <IconPlus size={11} /> Add option
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
