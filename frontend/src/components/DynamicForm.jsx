/**
 * DynamicForm — renders any form schema for a client.
 * If form.has_list_view: shows a list of submissions → click to open detail.
 * Otherwise: shows single form (current behaviour).
 */
import { useEffect, useState, useCallback } from 'react'
import {
  IconDeviceFloppy, IconLoader2, IconCheck, IconPlus,
  IconArrowLeft, IconTrash, IconChevronRight,
} from '@tabler/icons-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export default function DynamicForm({ clientId, formSchemaId, readOnly = false }) {
  const [schema, setSchema]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  // list-view state
  const [submissions, setSubmissions] = useState([])
  const [activeId, setActiveId]   = useState(null) // null = list, string = detail
  // single-record state
  const [response, setResponse]   = useState({})

  const loadSchema = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/forms/${formSchemaId}`)
      setSchema(res.data)
      if (!res.data.has_list_view) {
        const rRes = await api.get(`/workflow/clients/${clientId}/responses/${formSchemaId}`)
        setResponse(rRes.data.response_data || {})
      }
    } catch { setError('Failed to load form.') }
    finally { setLoading(false) }
  }, [clientId, formSchemaId])

  const loadSubmissions = useCallback(async () => {
    const res = await api.get(`/workflow/clients/${clientId}/submissions/${formSchemaId}`)
    setSubmissions(res.data)
  }, [clientId, formSchemaId])

  useEffect(() => {
    loadSchema()
  }, [loadSchema])

  useEffect(() => {
    if (schema?.has_list_view) loadSubmissions()
  }, [schema, loadSubmissions])

  if (loading) return (
    <div className="flex items-center gap-2 text-muted py-12 justify-center">
      <IconLoader2 size={18} className="animate-spin" /> Loading form…
    </div>
  )
  if (error) return <div className="text-red-500 text-sm py-8 text-center">{error}</div>
  if (!schema) return null

  // ── List-view mode ────────────────────────────────────────────────────────
  if (schema.has_list_view) {
    if (activeId === null) {
      return (
        <ListView
          schema={schema}
          submissions={submissions}
          clientId={clientId}
          formSchemaId={formSchemaId}
          onOpen={setActiveId}
          onRefresh={loadSubmissions}
        />
      )
    }
    return (
      <SubmissionDetail
        schema={schema}
        clientId={clientId}
        formSchemaId={formSchemaId}
        submissionId={activeId === 'new' ? null : activeId}
        isNew={activeId === 'new'}
        readOnly={readOnly}
        onBack={() => { setActiveId(null); loadSubmissions() }}
      />
    )
  }

  // ── Single-record mode ────────────────────────────────────────────────────
  return (
    <SingleForm
      schema={schema}
      clientId={clientId}
      formSchemaId={formSchemaId}
      response={response}
      setResponse={setResponse}
      readOnly={readOnly}
    />
  )
}

// ─── List View ────────────────────────────────────────────────────────────────
function ListView({ schema, submissions, clientId, formSchemaId, onOpen, onRefresh }) {
  const listCols = schema.list_columns || []
  const [deleting, setDeleting] = useState(null)

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Delete this record?')) return
    setDeleting(id)
    try {
      await api.delete(`/workflow/clients/${clientId}/submissions/${formSchemaId}/${id}`)
      toast.success('Record deleted')
      onRefresh()
    } catch { toast.error('Delete failed') }
    finally { setDeleting(null) }
  }

  const formatVal = (val) => {
    if (val == null || val === '') return '—'
    if (typeof val === 'boolean') return val ? 'Yes' : 'No'
    return String(val).slice(0, 60)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-heading">{schema.name}</h2>
          <p className="text-sm text-muted">{submissions.length} record{submissions.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => onOpen('new')}>
          <IconPlus size={15} /> New Record
        </button>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-card border border-border rounded-card p-12 text-center">
          <p className="text-muted text-sm mb-3">No records yet</p>
          <button className="btn-primary text-sm" onClick={() => onOpen('new')}>
            <IconPlus size={14} className="inline mr-1" /> Create First Record
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-page">
                <th className="text-left px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide">Date</th>
                {listCols.map(col => (
                  <th key={col.field_key} className="text-left px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide">
                    {col.label}
                  </th>
                ))}
                <th className="text-left px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                <th className="px-4 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {submissions.map(sub => (
                <tr
                  key={sub.id}
                  className="hover:bg-page cursor-pointer transition-colors"
                  onClick={() => onOpen(sub.id)}
                >
                  <td className="px-4 py-2.5 text-muted text-xs">
                    {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : '—'}
                  </td>
                  {listCols.map(col => (
                    <td key={col.field_key} className="px-4 py-2.5 text-heading">
                      {formatVal((sub.response_data || {})[col.field_key])}
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      sub.status === 'complete' ? 'bg-emerald-100 text-emerald-700' :
                      sub.status === 'signed'   ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {sub.status || 'draft'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      className="text-muted hover:text-red-500 p-1"
                      onClick={e => handleDelete(sub.id, e)}
                      disabled={deleting === sub.id}
                    >
                      {deleting === sub.id
                        ? <IconLoader2 size={13} className="animate-spin" />
                        : <IconTrash size={13} />}
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

// ─── Submission Detail (new or existing) ─────────────────────────────────────
function SubmissionDetail({ schema, clientId, formSchemaId, submissionId, isNew, readOnly, onBack }) {
  const [response, setResponse] = useState({})
  const [loading, setLoading]   = useState(!isNew)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    if (!isNew && submissionId) {
      setLoading(true)
      api.get(`/workflow/clients/${clientId}/submissions/${formSchemaId}/${submissionId}`)
        .then(r => setResponse(r.data.response_data || {}))
        .catch(() => toast.error('Failed to load record'))
        .finally(() => setLoading(false))
    }
  }, [submissionId, isNew, clientId, formSchemaId])

  const handleSave = async (status = 'draft') => {
    setSaving(true)
    try {
      if (isNew) {
        await api.post(`/workflow/clients/${clientId}/submissions/${formSchemaId}`, {
          response_data: response, status,
        })
        toast.success('Record created')
        onBack()
      } else {
        await api.put(`/workflow/clients/${clientId}/submissions/${formSchemaId}/${submissionId}`, {
          response_data: response, status,
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
        toast.success('Saved')
      }
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-muted py-12 justify-center">
      <IconLoader2 size={18} className="animate-spin" />
    </div>
  )

  return (
    <FormBody
      schema={schema}
      response={response}
      setResponse={setResponse}
      readOnly={readOnly}
      saving={saving}
      saved={saved}
      onSave={handleSave}
      onBack={onBack}
      isNew={isNew}
    />
  )
}

// ─── Single-record form ───────────────────────────────────────────────────────
function SingleForm({ schema, clientId, formSchemaId, response, setResponse, readOnly }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  const handleSave = async (status = 'draft') => {
    setSaving(true)
    try {
      await api.put(`/workflow/clients/${clientId}/responses/${formSchemaId}`, {
        response_data: response, status,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  return (
    <FormBody
      schema={schema}
      response={response}
      setResponse={setResponse}
      readOnly={readOnly}
      saving={saving}
      saved={saved}
      onSave={handleSave}
    />
  )
}

// ─── Shared form body ─────────────────────────────────────────────────────────
function FormBody({ schema, response, setResponse, readOnly, saving, saved, onSave, onBack, isNew }) {
  const sections = schema.sections || []
  const handleChange = (key, val) => setResponse(prev => ({ ...prev, [key]: val }))

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="text-muted hover:text-heading">
              <IconArrowLeft size={16} />
            </button>
          )}
          <div>
            <h2 className="text-lg font-semibold text-heading">{schema.name}</h2>
            {isNew && <p className="text-xs text-muted">New record</p>}
          </div>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><IconCheck size={13} /> Saved</span>}
            <button onClick={() => onSave('complete')} disabled={saving} className="btn-secondary text-xs px-3 py-1.5">Mark Complete</button>
            <button onClick={() => onSave('draft')} disabled={saving} className="btn-primary text-sm flex items-center gap-1.5">
              {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconDeviceFloppy size={14} />}
              {isNew ? 'Create' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-5">
        {sections.map((section, si) => (
          <div key={si} className="bg-card border border-border rounded-card p-4">
            {section.title && (
              <div className="border-b border-border pb-2 mb-4">
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">{section.title}</h3>
              </div>
            )}
            <div className="grid grid-cols-12 gap-3">
              {(section.fields || []).map((field, fi) => (
                <FieldRenderer
                  key={fi}
                  field={field}
                  value={response[field.field_key || field.key]}
                  onChange={val => handleChange(field.field_key || field.key, val)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Field dispatcher ─────────────────────────────────────────────────────────
function FieldRenderer({ field, value, onChange, readOnly }) {
  const colSpan = field.col_span || 4
  const type = field.field_type || field.type || 'text'

  return (
    <div className={`col-span-${Math.min(colSpan, 12)}`}>
      {!['heading', 'paragraph'].includes(type) && (
        <label className="field-label">
          {field.label}
          {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <FieldInput type={type} field={field} value={value} onChange={onChange} readOnly={readOnly} />
    </div>
  )
}

function FieldInput({ type, field, value, onChange, readOnly }) {
  const base = "field-input disabled:opacity-60 disabled:bg-page"
  const opts = field.options || []

  switch (type) {
    case 'textarea':
      return <textarea value={value ?? ''} onChange={e => onChange(e.target.value)} rows={3} disabled={readOnly} className={`${base} resize-none`} placeholder={field.placeholder || ''} />
    case 'number':
      return <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value)} disabled={readOnly} className={base} />
    case 'date': case 'visit_date':
      return <input type="date" value={value ?? ''} onChange={e => onChange(e.target.value)} disabled={readOnly} className={base} />
    case 'time': case 'visit_time':
      return <input type="time" value={value ?? ''} onChange={e => onChange(e.target.value)} disabled={readOnly} className={base} />
    case 'email':
      return <input type="email" value={value ?? ''} onChange={e => onChange(e.target.value)} disabled={readOnly} className={base} placeholder={field.placeholder || ''} />
    case 'phone':
      return <input type="tel" value={value ?? ''} onChange={e => onChange(e.target.value)} disabled={readOnly} className={base} placeholder={field.placeholder || ''} />
    case 'dropdown': case 'select':
      return (
        <select value={value ?? ''} onChange={e => onChange(e.target.value)} disabled={readOnly} className={base}>
          <option value="">Select…</option>
          {opts.map((o, i) => <option key={i} value={typeof o === 'string' ? o : o.value}>{typeof o === 'string' ? o : o.label}</option>)}
        </select>
      )
    case 'radio':
      return (
        <div className="flex flex-wrap gap-3 mt-1">
          {opts.map((o, i) => {
            const v = typeof o === 'string' ? o : o.value
            return (
              <label key={i} className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" value={v} checked={value === v} onChange={() => onChange(v)} disabled={readOnly} className="accent-blue-600" />
                <span className="text-sm">{typeof o === 'string' ? o : o.label}</span>
              </label>
            )
          })}
        </div>
      )
    case 'boolean': case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-pointer mt-1">
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} disabled={readOnly} className="w-4 h-4 accent-blue-600" />
          <span className="text-sm">{field.checkbox_label || 'Yes'}</span>
        </label>
      )
    case 'signature':
      return (
        <div>
          <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder="Type full name to sign" disabled={readOnly} className={`${base} italic`} style={{ fontFamily: 'cursive' }} />
          {value && <p className="text-xs text-muted mt-1">Electronically signed</p>}
        </div>
      )
    case 'heading':
      return <div className="col-span-12 border-b border-border pb-1"><h3 className="text-sm font-semibold text-heading">{field.label}</h3></div>
    case 'paragraph':
      return <p className="text-sm text-muted">{field.label}</p>
    default:
      return <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || ''} disabled={readOnly} className={base} />
  }
}
