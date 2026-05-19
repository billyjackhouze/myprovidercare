/**
 * FormEdit — add fields to an existing form without rebuilding it.
 * Accessible via the gear icon → "Edit Fields" on the Forms List page,
 * or directly at /forms/:id/edit
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  IconArrowLeft, IconPlus, IconTrash, IconCheck,
  IconLoader2, IconChevronDown, IconChevronUp,
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

export default function FormEdit() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const [schema, setSchema]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [newFields, setNewFields] = useState([])
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    api.get(`/forms/${id}`)
      .then(r => setSchema(r.data))
      .catch(() => toast.error('Could not load form'))
      .finally(() => setLoading(false))
  }, [id])

  const addField = (sectionKey) => {
    setNewFields(prev => [...prev, {
      field_key:  `new_${Date.now()}`,
      label:      'New Field',
      field_type: 'text',
      section_key: sectionKey,
      order_index: 9999,
      is_required: false,
      options:    [],
      placeholder: '',
      validation: null,
    }])
  }

  const updateField = (updated) => {
    setNewFields(prev => prev.map(f => f.field_key === updated.field_key ? updated : f))
  }

  const removeField = (key) => setNewFields(prev => prev.filter(f => f.field_key !== key))

  const handleSave = async () => {
    if (!newFields.length) return toast.error('Add at least one new field')
    setSaving(true)
    try {
      await api.post(`/forms/${id}/fields`, { fields: newFields, sections: [] })
      toast.success(`${newFields.length} field${newFields.length !== 1 ? 's' : ''} added!`)
      navigate('/forms')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-muted py-12 justify-center">
      <IconLoader2 size={18} className="animate-spin" /> Loading…
    </div>
  )
  if (!schema) return null

  const sections = schema.sections || []

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/forms')} className="text-muted hover:text-heading">
          <IconArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-medium text-heading">Edit Fields — {schema.name}</h1>
          <p className="text-muted text-sm mt-0.5">Add new fields to existing sections</p>
        </div>
      </div>

      {/* Existing fields (read-only overview) */}
      <div className="bg-card border border-border rounded-card p-4 mb-5">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Existing Fields</h2>
        {sections.map(sec => (
          <div key={sec.section_key} className="mb-3">
            <p className="text-xs font-semibold text-heading mb-1">{sec.title}</p>
            <div className="flex flex-wrap gap-1.5">
              {(sec.fields || []).map(f => (
                <span key={f.id} className="text-xs bg-page border border-border rounded px-2 py-0.5 text-muted">
                  {f.label}
                  <span className="ml-1 opacity-60 font-mono">{f.field_key}</span>
                </span>
              ))}
              {(sec.fields || []).length === 0 && (
                <span className="text-xs text-muted italic">no fields</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* New fields to add */}
      <div className="bg-card border border-border rounded-card p-4 mb-5">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
          New Fields to Add {newFields.length > 0 && <span className="text-primary">({newFields.length})</span>}
        </h2>

        {sections.map(sec => {
          const sectionNewFields = newFields.filter(f => f.section_key === sec.section_key)
          return (
            <div key={sec.section_key} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-heading">{sec.title}</p>
                <button
                  className="text-xs text-primary flex items-center gap-1"
                  onClick={() => addField(sec.section_key)}
                >
                  <IconPlus size={12} /> Add field to {sec.title}
                </button>
              </div>
              {sectionNewFields.map(field => (
                <NewFieldBuilder
                  key={field.field_key}
                  field={field}
                  allExistingKeys={sections.flatMap(s => (s.fields || []).map(f => f.field_key))}
                  onUpdate={updateField}
                  onRemove={() => removeField(field.field_key)}
                />
              ))}
              {sectionNewFields.length === 0 && (
                <p className="text-xs text-muted italic pl-1">No new fields for this section yet</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-3">
        <button className="btn-secondary text-sm" onClick={() => navigate('/forms')}>Cancel</button>
        <button
          className="btn-primary flex items-center gap-2 text-sm"
          onClick={handleSave}
          disabled={saving || newFields.length === 0}
        >
          {saving ? <IconLoader2 size={15} className="animate-spin" /> : <IconCheck size={15} />}
          Add {newFields.length || ''} Field{newFields.length !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}

function NewFieldBuilder({ field, allExistingKeys, onUpdate, onRemove }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-card mb-1.5">
      <div className="flex items-center gap-3 px-3 py-2 cursor-pointer" onClick={() => setOpen(v => !v)}>
        <span className="flex-1 text-sm font-medium text-heading truncate">{field.label || 'Untitled'}</span>
        <span className="text-xs bg-white border border-border px-1.5 py-0.5 rounded text-muted shrink-0">
          {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
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
              onChange={e => onUpdate({ ...field, label: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label">Field Type</label>
            <select
              className="field-input"
              value={field.field_type}
              onChange={e => onUpdate({ ...field, field_type: e.target.value })}
            >
              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">
              Field Key
              <span className="ml-1 font-normal text-muted">(used in formulas)</span>
            </label>
            <input
              className="field-input font-mono text-xs"
              value={field.field_key}
              onChange={e => {
                const raw = e.target.value.replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '').toLowerCase()
                onUpdate({ ...field, field_key: raw })
              }}
            />
            {allExistingKeys.includes(field.field_key) && (
              <p className="text-xs text-red-500 mt-0.5">This key already exists — choose a different one</p>
            )}
          </div>
          <div className="flex items-center gap-2 pt-4">
            <input
              type="checkbox"
              id={`req-${field.field_key}`}
              checked={field.is_required}
              onChange={e => onUpdate({ ...field, is_required: e.target.checked })}
            />
            <label htmlFor={`req-${field.field_key}`} className="text-sm cursor-pointer">Required</label>
          </div>

          {field.field_type === 'calculated' && (
            <div className="col-span-2">
              <label className="field-label">
                Formula
                <span className="ml-1 font-normal text-muted">— reference other fields by key</span>
              </label>
              <input
                className="field-input font-mono text-xs"
                value={field.validation?.formula || ''}
                placeholder="e.g.  hours * 4   or   total_units / 4"
                onChange={e => onUpdate({ ...field, validation: { ...(field.validation || {}), formula: e.target.value } })}
              />
              <p className="text-xs text-muted mt-1">
                1 unit = 15 min → <code className="bg-white px-0.5 rounded">hours * 4</code> gives units.
                Use +  −  *  /  ( ) and any field key shown in "Existing Fields" above.
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
                    placeholder="Label"
                    value={opt.label}
                    onChange={e => {
                      const opts = [...field.options]
                      opts[i] = { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') }
                      onUpdate({ ...field, options: opts })
                    }}
                  />
                  <button
                    className="text-muted hover:text-red-500"
                    onClick={() => onUpdate({ ...field, options: field.options.filter((_, j) => j !== i) })}
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
              ))}
              <button
                className="text-xs text-primary flex items-center gap-1 mt-1"
                onClick={() => onUpdate({ ...field, options: [...(field.options || []), { label: '', value: '' }] })}
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
