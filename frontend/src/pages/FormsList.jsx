import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconPlus, IconSparkles, IconFileDescription, IconLoader2, IconTrash } from '@tabler/icons-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export default function FormsList() {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-medium text-heading">Forms Engine</h1>
          <p className="text-muted text-sm mt-0.5">AI-powered form ingestion and management</p>
        </div>
        <Link to="/forms/ingest" className="btn-primary flex items-center gap-1.5 text-sm">
          <IconPlus size={16} />
          Ingest New Form
        </Link>
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
              className="bg-card rounded-card border border-border p-4 hover:border-primary/50 transition-colors cursor-pointer"
              style={{ borderTopWidth: '3px', borderTopColor: '#0D9488' }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-heading truncate">{form.name}</h3>
                  <span className="text-xs text-muted">{form.form_type || 'Unknown type'}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {form.ai_extracted && (
                    <IconSparkles size={14} style={{ color: '#2563EB' }} />
                  )}
                  <button
                    className="text-muted hover:text-red-500 transition-colors p-0.5"
                    title="Delete form"
                    onClick={e => { e.stopPropagation(); handleDelete(form.id, form.name) }}
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
