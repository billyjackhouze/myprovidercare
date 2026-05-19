import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  IconPlus, IconSparkles, IconFileDescription, IconLoader2,
  IconTrash, IconSettings, IconX, IconList, IconCheck, IconPencil,
} from '@tabler/icons-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

// ── Settings modal ────────────────────────────────────────────────────────────

function FormSettingsModal({ form, onClose, onSaved }) {
  const [schema, setSchema]           = useState(null)
  const [loadingSchema, setLoadingSchema] = useState(true)
  const [hasListView, setHasListView] = useState(form.has_list_view ?? false)
  const [listColumns, setListColumns] = useState([])
  const [saving, setSaving]           = useState(false)

  // Load full schema to get fields
  useEffect(() => {
    api.get(`/forms/${form.id}`)
      .then(r => {
        setSchema(r.data)
        // Pre-select whatever columns are already saved
        const saved = (r.data.list_columns || []).map(c => c.field_key)
        setListColumns(saved)
        setHasListView(r.data.has_list_view ?? false)
      })
      .catch(() => toast.error('Could not load form fields'))
      .finally(() => setLoadingSchema(false))
  }, [form.id])

  const allFields = schema
    ? schema.sections.flatMap(s => s.fields)
    : []

  const toggleColumn = (field_key) => {
    setListColumns(prev =>
      prev.includes(field_key)
        ? prev.filter(k => k !== field_key)
        : [...prev, field_key]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const cols = allFields
        .filter(f => listColumns.includes(f.field_key))
        .map(f => ({ field_key: f.field_key, label: f.label }))
      const res = await api.put(`/forms/${form.id}`, {
        has_list_view: hasListView,
        list_columns: cols,
      })
      toast.success('Form settings saved')
      onSaved(res.data)
      onClose()
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-card border border-border shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-heading">{form.name}</h2>
            <p className="text-xs text-muted mt-0.5">Form settings</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/forms/${form.id}/edit`}
              className="text-xs text-primary hover:underline flex items-center gap-1"
              onClick={onClose}
            >
              <IconPencil size={12} /> Edit Fields
            </Link>
            <button onClick={onClose} className="text-muted hover:text-heading p-1">
              <IconX size={18} />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* List View toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-heading">List View</p>
              <p className="text-xs text-muted mt-0.5">
                Show a table of all submissions instead of a single form
              </p>
            </div>
            <button
              onClick={() => setHasListView(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                hasListView ? 'bg-primary' : 'bg-border'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  hasListView ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Column picker */}
          {hasListView && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                <IconList size={12} className="inline mr-1" />
                List Columns
              </p>
              {loadingSchema ? (
                <div className="flex items-center gap-2 text-muted text-xs py-3">
                  <IconLoader2 size={14} className="animate-spin" />
                  Loading fields…
                </div>
              ) : allFields.length === 0 ? (
                <p className="text-xs text-muted">No fields found.</p>
              ) : (
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {allFields.map(f => {
                    const checked = listColumns.includes(f.field_key)
                    return (
                      <button
                        key={f.field_key}
                        onClick={() => toggleColumn(f.field_key)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                          checked
                            ? 'bg-primary/10 text-primary'
                            : 'text-body hover:bg-hover'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          checked ? 'bg-primary border-primary' : 'border-border'
                        }`}>
                          {checked && <IconCheck size={10} color="white" strokeWidth={3} />}
                        </span>
                        <span className="truncate">{f.label}</span>
                        <span className="ml-auto text-xs text-muted shrink-0">{f.field_type}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-hover/30">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            {saving && <IconLoader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FormsList() {
  const navigate                      = useNavigate()
  const [forms, setForms]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [editingForm, setEditingForm] = useState(null)

  useEffect(() => {
    api.get('/forms')
      .then((r) => setForms(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/forms/${id}`)
      setForms(prev => prev.filter(f => f.id !== id))
      toast.success('Form deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  const handleSaved = (updated) => {
    setForms(prev => prev.map(f => f.id === updated.id ? { ...f, ...updated } : f))
  }

  return (
    <div>
      {editingForm && (
        <FormSettingsModal
          form={editingForm}
          onClose={() => setEditingForm(null)}
          onSaved={handleSaved}
        />
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-medium text-heading">Forms Engine</h1>
          <p className="text-muted text-sm mt-0.5">AI-powered form ingestion and management</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/forms/build" className="btn-secondary flex items-center gap-1.5 text-sm">
            <IconPlus size={16} />
            Build Form
          </Link>
          <Link to="/forms/ingest" className="btn-primary flex items-center gap-1.5 text-sm">
            <IconPlus size={16} />
            Ingest New Form
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted py-8 justify-center">
          <IconLoader2 size={18} className="animate-spin" />
          <span>Loading forms…</span>
        </div>
      ) : forms.length === 0 ? (
        <div className="bg-card rounded-card border border-border p-12 text-center">
          <IconFileDescription size={40} className="mx-auto text-muted mb-3" strokeWidth={1} />
          <h3 className="text-heading font-medium mb-1">No forms yet</h3>
          <p className="text-muted text-sm mb-4">
            Upload your first paper form and Claude will extract all the fields automatically.
          </p>
          <Link to="/forms/ingest" className="btn-primary inline-flex items-center gap-1.5">
            <IconSparkles size={16} />
            Ingest First Form
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {forms.map((form) => (
            <div
              key={form.id}
              className="bg-card rounded-card border border-border p-4 hover:border-primary/50 transition-colors"
              style={{ borderTopWidth: '3px', borderTopColor: '#0D9488' }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-heading truncate">{form.name}</h3>
                  <span className="text-xs text-muted">{form.form_type || 'Unknown type'}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {form.ai_extracted && (
                    <IconSparkles size={14} style={{ color: '#2563EB' }} title="AI-extracted" />
                  )}
                  {form.has_list_view && (
                    <IconList size={14} style={{ color: '#0D9488' }} title="List view enabled" />
                  )}
                  <button
                    className="text-muted hover:text-heading transition-colors p-0.5"
                    title="Form settings"
                    onClick={() => setEditingForm(form)}
                  >
                    <IconSettings size={14} />
                  </button>
                  <button
                    className="text-muted hover:text-red-500 transition-colors p-0.5"
                    title="Delete form"
                    onClick={() => handleDelete(form.id, form.name)}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span>{form.section_count} section{form.section_count !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{form.field_count} field{form.field_count !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>v{form.version}</span>
                {form.has_list_view && (
                  <>
                    <span>·</span>
                    <span className="text-teal-600">List view</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
