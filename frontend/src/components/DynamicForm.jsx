/**
 * DynamicForm — renders any form_schema as a fillable form for a client.
 * Used by the workflow engine to render custom org-created forms.
 */
import { useEffect, useState, useCallback } from 'react'
import { IconDeviceFloppy, IconLoader2, IconCheck } from '@tabler/icons-react'
import api from '@/lib/api'

const FIELD_TYPES = {
  text:      TextInput,
  textarea:  TextareaInput,
  number:    NumberInput,
  date:      DateInput,
  select:    SelectInput,
  checkbox:  CheckboxInput,
  radio:     RadioInput,
  signature: SignatureInput,
  heading:   HeadingDisplay,
  paragraph: ParagraphDisplay,
}

export default function DynamicForm({ clientId, formSchemaId, readOnly = false }) {
  const [schema, setSchema] = useState(null)
  const [response, setResponse] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [schemaRes, responseRes] = await Promise.all([
        api.get(`/forms/${formSchemaId}`),
        api.get(`/workflow/clients/${clientId}/responses/${formSchemaId}`),
      ])
      setSchema(schemaRes.data)
      setResponse(responseRes.data.response_data || {})
    } catch (e) {
      setError('Failed to load form.')
    } finally {
      setLoading(false)
    }
  }, [clientId, formSchemaId])

  useEffect(() => { load() }, [load])

  const handleChange = (fieldKey, value) => {
    setResponse(prev => ({ ...prev, [fieldKey]: value }))
  }

  const handleSave = async (saveStatus = 'draft') => {
    setSaving(true)
    try {
      await api.put(`/workflow/clients/${clientId}/responses/${formSchemaId}`, {
        response_data: response,
        status: saveStatus,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-muted py-12 justify-center">
      <IconLoader2 size={18} className="animate-spin" />
      Loading form…
    </div>
  )

  if (error) return (
    <div className="text-red-500 text-sm py-8 text-center">{error}</div>
  )

  if (!schema) return null

  const sections = schema.sections || []
  const allFields = sections.flatMap(s => s.fields || [])

  return (
    <div>
      {/* Form header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-heading">{schema.name}</h2>
          {schema.description && (
            <p className="text-sm text-muted mt-0.5">{schema.description}</p>
          )}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <IconCheck size={13} /> Saved
              </span>
            )}
            {error && <span className="text-xs text-red-500">{error}</span>}
            <button
              onClick={() => handleSave('complete')}
              disabled={saving}
              className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
            >
              Mark Complete
            </button>
            <button
              onClick={() => handleSave('draft')}
              disabled={saving}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              {saving
                ? <IconLoader2 size={14} className="animate-spin" />
                : <IconDeviceFloppy size={14} />
              }
              Save
            </button>
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-5">
        {sections.length > 0 ? (
          sections.map((section, si) => (
            <div key={si} className="bg-card border border-border rounded-card p-4">
              {section.title && (
                <div className="border-b border-border pb-2 mb-4">
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
                    {section.title}
                  </h3>
                </div>
              )}
              <div className="grid grid-cols-12 gap-3">
                {(section.fields || []).map((field, fi) => (
                  <FieldRenderer
                    key={fi}
                    field={field}
                    value={response[field.key]}
                    onChange={val => handleChange(field.key, val)}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          /* Flat field list (no sections) */
          <div className="bg-card border border-border rounded-card p-4">
            <div className="grid grid-cols-12 gap-3">
              {allFields.map((field, fi) => (
                <FieldRenderer
                  key={fi}
                  field={field}
                  value={response[field.key]}
                  onChange={val => handleChange(field.key, val)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Field dispatcher ─────────────────────────────────────────────────────────
function FieldRenderer({ field, value, onChange, readOnly }) {
  const colSpan = field.col_span || 4  // default 4/12 cols
  const Component = FIELD_TYPES[field.field_type] || TextInput

  return (
    <div className={`col-span-${Math.min(colSpan, 12)}`}>
      {!['heading', 'paragraph'].includes(field.field_type) && (
        <label className="field-label">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <Component field={field} value={value} onChange={onChange} readOnly={readOnly} />
    </div>
  )
}

// ─── Individual field components ──────────────────────────────────────────────
function TextInput({ field, value, onChange, readOnly }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder || ''}
      disabled={readOnly}
      className="field-input disabled:opacity-60 disabled:bg-page"
    />
  )
}

function TextareaInput({ field, value, onChange, readOnly }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder || ''}
      rows={field.rows || 3}
      disabled={readOnly}
      className="field-input resize-none disabled:opacity-60 disabled:bg-page"
    />
  )
}

function NumberInput({ field, value, onChange, readOnly }) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder || ''}
      disabled={readOnly}
      className="field-input disabled:opacity-60 disabled:bg-page"
    />
  )
}

function DateInput({ field, value, onChange, readOnly }) {
  return (
    <input
      type="date"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      disabled={readOnly}
      className="field-input disabled:opacity-60 disabled:bg-page"
    />
  )
}

function SelectInput({ field, value, onChange, readOnly }) {
  const options = field.options || []
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      disabled={readOnly}
      className="field-input disabled:opacity-60 disabled:bg-page"
    >
      <option value="">Select…</option>
      {options.map((o, i) => (
        <option key={i} value={typeof o === 'string' ? o : o.value}>
          {typeof o === 'string' ? o : o.label}
        </option>
      ))}
    </select>
  )
}

function CheckboxInput({ field, value, onChange, readOnly }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer mt-1">
      <input
        type="checkbox"
        checked={!!value}
        onChange={e => onChange(e.target.checked)}
        disabled={readOnly}
        className="w-4 h-4 accent-blue-600"
      />
      <span className="text-sm text-heading">{field.checkbox_label || 'Yes'}</span>
    </label>
  )
}

function RadioInput({ field, value, onChange, readOnly }) {
  const options = field.options || []
  return (
    <div className="flex flex-wrap gap-3 mt-1">
      {options.map((o, i) => {
        const val = typeof o === 'string' ? o : o.value
        const label = typeof o === 'string' ? o : o.label
        return (
          <label key={i} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={field.key}
              value={val}
              checked={value === val}
              onChange={() => onChange(val)}
              disabled={readOnly}
              className="accent-blue-600"
            />
            <span className="text-sm text-heading">{label}</span>
          </label>
        )
      })}
    </div>
  )
}

function SignatureInput({ field, value, onChange, readOnly }) {
  // Simple text signature for now — can be enhanced with canvas later
  return (
    <div>
      <input
        type="text"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder="Type full name to sign"
        disabled={readOnly}
        className="field-input italic disabled:opacity-60 disabled:bg-page"
        style={{ fontFamily: 'cursive' }}
      />
      {value && (
        <p className="text-xs text-muted mt-1">
          Electronically signed
        </p>
      )}
    </div>
  )
}

function HeadingDisplay({ field }) {
  return (
    <div className="col-span-12 border-b border-border pb-1 mb-1">
      <h3 className="text-sm font-semibold text-heading">{field.label}</h3>
    </div>
  )
}

function ParagraphDisplay({ field }) {
  return (
    <p className="text-sm text-muted col-span-12">{field.label}</p>
  )
}
