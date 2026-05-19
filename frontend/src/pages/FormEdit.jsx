/**
 * FormEdit — add new fields OR edit existing fields on any saved form.
 * Route: /forms/:id/edit
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  IconArrowLeft, IconPlus, IconTrash, IconCheck,
  IconLoader2, IconChevronDown, IconChevronUp, IconPencil, IconDeviceFloppy,
} from '@tabler/icons-react'
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

export default function FormEdit() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [schema, setSchema]         = useState(null)
  const [loading, setLoading]       = useState(true)
  const [newFields, setNewFields]   = useState([])
  const [editedFields, setEditedFields] = useState({}) // id → patch object
  const [savingNew, setSavingNew]   = useState(false)
  const [savingEdit, setSavingEdit] = useState({}) // id → bool

  useEffect(() => {
    api.get(`/forms/${id}`)
      .then(r => setSchema(r.data))
      .catch(() => toast.error('Could not load form'))
      .finally(() => setLoading(false))
  }, [id])

  // ── New fields ──────────────────────────────────────────────────────────────
  const addField = (sectionKey) => {
    setNewFields(prev => [...prev, {
      _tempId:     `tmp_${Date.now()}`,
      field_key:   '',
      label:       '',
      field_type:  'text',
      section_key: sectionKey,
      order_index: 9999,
      is_required: false,
      options:     [],
      placeholder: '',
      validation:  null,
    }])
  }

  const updateNewField = (tempId, patch) => {
    setNewFields(prev => prev.map(f => {
      if (f._tempId !== tempId) return f
      const updated = { ...f, ...patch }
      // Auto-derive field_key from label unless manually overridden
      if (patch.label !== undefined && !f._keyTouched) {
        updated.field_key = toSnakeCase(patch.label)
      }
      return updated
    }))
  }

  const touchKey = (tempId, val) => {
    setNewFields(prev => prev.map(f =>
      f._tempId === tempId
        ? { ...f, field_key: toSnakeCase(val), _keyTouched: true }
        : f
    ))
  }

  const removeNewField = (tempId) => setNewFields(prev => prev.filter(f => f._tempId !== tempId))

  const handleSaveNew = async () => {
    if (!newFields.length) return toast.error('Add at least one new field')
    const invalid = newFields.find(f => !f.field_key || !f.label)
    if (invalid) return toast.error('All fields need a label')
    setSavingNew(true)
    try {
      await api.post(`/forms/${id}/fields`, {
        fields: newFields.map(({ _tempId, _keyTouched, ...f }) => f),
        sections: [],
      })
      toast.success(`${newFields.length} field${newFields.length !== 1 ? 's' : ''} added!`)
      // Reload schema and clear new fields
      const r = await api.get(`/forms/${id}`)
      setSchema(r.data)
      setNewFields([])
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed')
    } finally { setSavingNew(false) }
  }

  // ── Existing field edits ────────────────────────────────────────────────────
  const patchExisting = (fieldId, patch) => {
    setEditedFields(prev => ({
      ...prev,
      [fieldId]: { ...(prev[fieldId] || {}), ...patch },
    }))
  }

  const saveExisting = async (fieldId) => {
    const patch = editedFields[fieldId]
    if (!patch || Object.keys(patch).length === 0) return
    setSavingEdit(prev => ({ ...prev, [fieldId]: true }))
    try {
      await api.put(`/forms/${id}/fields/${fieldId}`, patch)
      toast.success('Field saved')
      // Refresh schema
      const r = await api.get(`/forms/${id}`)
      setSchema(r.data)
      setEditedFields(prev => { const n = { ...prev }; delete n[fieldId]; return n })
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed')
    } finally {
      setSavingEdit(prev => { const n = { ...prev }; delete n[fieldId]; return n })
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center gap-2 text-muted py-12 justify-center">
      <IconLoader2 size={18} className="animate-spin" /> Loading…
    </div>
  )
  if (!schema) return null

  const sections = schema.sections || []
  const allExistingKeys = sections.flatMap(s => (s.fields || []).map(f => f.field_key))

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/forms')} className="text-muted hover:text-heading">
          <IconArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-medium text-heading">Edit — {schema.name}</h1>
          <p className="text-muted text-sm mt-0.5">Edit existing fields or add new ones</p>
        </div>
      </div>

      {sections.map(sec => {
        const sectionNewFields = newFields.filter(f => f.section_key === sec.section_key)
        return (
          <div key={sec.section_key} className="bg-card border border-border rounded-card mb-4 overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-page">
              <h2 className="text-sm font-semibold text-heading">{sec.title}</h2>
              <button
                className="text-xs text-primary flex items-center gap-1"
                onClick={() => addField(sec.section_key)}
              >
                <IconPlus size={12} /> Add field
              </button>
            </div>

            <div className="p-4 space-y-1.5">
              {/* Existing fields — editable */}
              {(sec.fields || []).map(field => {
                const patch   = editedFields[field.id] || {}
                const merged  = { ...field, ...patch }
                const isDirty = Object.keys(patch).length > 0
                const saving  = savingEdit[field.id]

                return (
                  <ExistingFieldEditor
                    key={field.id}
                    field={merged}
                    isDirty={isDirty}
                    saving={saving}
                    onChange={p => patchExisting(field.id, p)}
                    onSave={() => saveExisting(field.id)}
                  />
                )
              })}

              {(sec.fields || []).length === 0 && sectionNewFields.length === 0 && (
                <p className="text-xs text-muted italic">No fields yet — add one below</p>
              )}

              {/* New fields being built */}
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

      {/* Save new fields bar */}
      {newFields.length > 0 && (
        <div className="sticky bottom-4 bg-card border border-primary rounded-card px-5 py-3 flex items-center justify-between shadow-lg">
          <span className="text-sm text-heading font-medium">
            {newFields.length} new field{newFields.length !== 1 ? 's' : ''} ready to save
          </span>
          <button
            className="btn-primary flex items-center gap-2 text-sm"
            onClick={handleSaveNew}
            disabled={savingNew}
          >
            {savingNew ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />}
            Save New Fields
          </button>
        </div>
      )}

      <div className="flex justify-start mt-3">
        <button className="btn-secondary text-sm" onClick={() => navigate('/forms')}>← Back to Forms</button>
      </div>
    </div>
  )
}

// ── Existing field editor (inline expand) ────────────────────────────────────
function ExistingFieldEditor({ field, isDirty, saving, onChange, onSave }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`border rounded-card ${isDirty ? 'border-amber-300 bg-amber-50/40' : 'border-border bg-white'}`}>
      <div
        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50/50 rounded-card"
        onClick={() => setOpen(v => !v)}
      >
        <IconPencil size={12} className="text-muted shrink-0" />
        <span className="flex-1 text-sm font-medium text-heading truncate">{field.label}</span>
        <span className="text-xs bg-page border border-border px-1.5 py-0.5 rounded text-muted font-mono shrink-0">
          {field.field_key}
        </span>
        <span className="text-xs text-muted shrink-0">
          {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
        </span>
        {isDirty && (
          <button
            className="btn-primary text-xs px-2 py-1 flex items-center gap-1 shrink-0"
            onClick={e => { e.stopPropagation(); onSave() }}
            disabled={saving}
          >
            {saving ? <IconLoader2 size={11} className="animate-spin" /> : <IconDeviceFloppy size={11} />}
            Save
          </button>
        )}
        {open ? <IconChevronUp size={14} className="text-muted shrink-0" /> : <IconChevronDown size={14} className="text-muted shrink-0" />}
      </div>

      {open && (
        <div className="px-3 pb-3 border-t border-border grid grid-cols-2 gap-3 pt-3">
          <div>
            <label className="field-label">Label</label>
            <input
              className="field-input"
              value={field.label}
              onChange={e => onChange({ label: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label">Field Type</label>
            <select
              className="field-input"
              value={field.field_type}
              onChange={e => onChange({ field_type: e.target.value })}
            >
              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Placeholder</label>
            <input
              className="field-input"
              value={field.placeholder || ''}
              onChange={e => onChange({ placeholder: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2 pt-4">
            <input
              type="checkbox"
              id={`req-${field.id}`}
              checked={!!field.is_required}
              onChange={e => onChange({ is_required: e.target.checked })}
            />
            <label htmlFor={`req-${field.id}`} className="text-sm cursor-pointer">Required</label>
          </div>

          {field.field_type === 'calculated' && (
            <div className="col-span-2">
              <label className="field-label">
                Formula
                <span className="ml-1 font-normal text-muted">— reference field keys, e.g. <code className="bg-page px-1 rounded text-xs">hours * 4</code></span>
              </label>
              <input
                className="field-input font-mono text-xs"
                value={field.validation?.formula || ''}
                placeholder="e.g.  hours * 4   or   total_units - units_used"
                onChange={e => onChange({ validation: { ...(field.validation || {}), formula: e.target.value } })}
              />
            </div>
          )}

          {['dropdown', 'radio'].includes(field.field_type) && (
            <div className="col-span-2">
              <label className="field-label">Options</label>
              {(field.options || []).map((opt, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <input
                    className="field-input"
                    placeholder="Label"
                    value={opt.label || opt}
                    onChange={e => {
                      const opts = [...(field.options || [])]
                      opts[i] = { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') }
                      onChange({ options: opts })
                    }}
                  />
                  <button
                    className="text-muted hover:text-red-500"
                    onClick={() => onChange({ options: (field.options || []).filter((_, j) => j !== i) })}
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
              ))}
              <button
                className="text-xs text-primary flex items-center gap-1 mt-1"
                onClick={() => onChange({ options: [...(field.options || []), { label: '', value: '' }] })}
              >
                <IconPlus size={11} /> Add option
              </button>
            </div>
          )}

          {isDirty && (
            <div className="col-span-2 flex justify-end">
              <button
                className="btn-primary text-sm flex items-center gap-1.5"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconDeviceFloppy size={14} />}
                Save Changes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── New field editor ──────────────────────────────────────────────────────────
function NewFieldEditor({ field, allExistingKeys, onChange, onKeyChange, onRemove }) {
  const [open, setOpen] = useState(true)
  const keyConflict = allExistingKeys.includes(field.field_key) && field.field_key !== ''

  return (
    <div className="border border-primary/40 bg-primary/5 rounded-card">
      <div className="flex items-center gap-3 px-3 py-2 cursor-pointer" onClick={() => setOpen(v => !v)}>
        <IconPlus size={12} className="text-primary shrink-0" />
        <span className="flex-1 text-sm font-medium text-heading truncate">
          {field.label || <span className="text-muted italic">New field…</span>}
        </span>
        <span className="text-xs bg-white border border-border px-1.5 py-0.5 rounded text-muted font-mono shrink-0">
          {field.field_key || '—'}
        </span>
        {open ? <IconChevronUp size={14} className="text-muted shrink-0" /> : <IconChevronDown size={14} className="text-muted shrink-0" />}
        <button className="text-muted hover:text-red-500 p-0.5 shrink-0" onClick={e => { e.stopPropagation(); onRemove() }}>
          <IconTrash size={14} />
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3 border-t border-primary/20 grid grid-cols-2 gap-3 pt-3">
          <div>
            <label className="field-label">Label</label>
            <input
              className="field-input"
              value={field.label}
              autoFocus
              onChange={e => onChange({ label: e.target.value })}
              placeholder="e.g. Hours Authorized"
            />
          </div>
          <div>
            <label className="field-label">Field Type</label>
            <select
              className="field-input"
              value={field.field_type}
              onChange={e => onChange({ field_type: e.target.value })}
            >
              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="field-label">
              Field Key
              <span className="ml-1 font-normal text-muted">(auto-filled from label — edit if needed)</span>
            </label>
            <input
              className={`field-input font-mono text-xs ${keyConflict ? 'border-red-400' : ''}`}
              value={field.field_key}
              onChange={e => onKeyChange(e.target.value)}
              placeholder="e.g. hours_authorized"
            />
            {keyConflict && (
              <p className="text-xs text-red-500 mt-0.5">This key already exists — choose a different one</p>
            )}
            {!keyConflict && field.field_key && (
              <p className="text-xs text-muted mt-0.5">Used in formulas as: <code className="bg-page px-0.5 rounded">{field.field_key}</code></p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`req-${field._tempId}`}
              checked={field.is_required}
              onChange={e => onChange({ is_required: e.target.checked })}
            />
            <label htmlFor={`req-${field._tempId}`} className="text-sm cursor-pointer">Required</label>
          </div>
          <div>
            <label className="field-label">Placeholder</label>
            <input
              className="field-input"
              value={field.placeholder || ''}
              onChange={e => onChange({ placeholder: e.target.value })}
            />
          </div>

          {field.field_type === 'calculated' && (
            <div className="col-span-2">
              <label className="field-label">
                Formula
                <span className="ml-1 font-normal text-muted">— reference field keys, e.g. <code className="bg-page px-1 rounded text-xs">hours * 4</code></span>
              </label>
              <input
                className="field-input font-mono text-xs"
                value={field.validation?.formula || ''}
                placeholder="e.g.  hours * 4   or   total_units - units_used"
                onChange={e => onChange({ validation: { ...(field.validation || {}), formula: e.target.value } })}
              />
              <p className="text-xs text-muted mt-1">
                1 unit = 15 min → <code className="bg-white px-0.5 rounded">hours * 4</code> gives units.
                Use + − * / ( ) and any field key from this form.
              </p>
            </div>
          )}

          {['dropdown', 'radio'].includes(field.field_type) && (
            <div className="col-span-2">
              <label className="field-label">Options</label>
              {(field.options || []).map((opt, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <input
                    className="field-input"
                    placeholder="Option label"
                    value={opt.label}
                    onChange={e => {
                      const opts = [...field.options]
                      opts[i] = { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') }
                      onChange({ options: opts })
                    }}
                  />
                  <button
                    className="text-muted hover:text-red-500"
                    onClick={() => onChange({ options: field.options.filter((_, j) => j !== i) })}
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
              ))}
              <button
                className="text-xs text-primary flex items-center gap-1 mt-1"
                onClick={() => onChange({ options: [...(field.options || []), { label: '', value: '' }] })}
              >
                <IconPlus size={11} /> Add option
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
