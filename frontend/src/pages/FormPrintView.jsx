/**
 * FormPrintView — standalone page for printing / saving a filled form as PDF.
 *
 * URL patterns:
 *   /print/client/:clientId/form/:formSchemaId                      (single-record form)
 *   /print/client/:clientId/form/:formSchemaId/submission/:submissionId  (list-view submission)
 *
 * Opened in a new tab by DynamicForm's "Print / PDF" button.
 * The page loads the form schema, the client name, and the filled response,
 * then renders a clean print layout. window.print() saves it as a PDF.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '@/lib/api'

/* ── Field value formatter ─────────────────────────────────────────────────── */
function formatValue(value, fieldType) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (fieldType === 'date' || fieldType === 'visit_date') {
    try { return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }
    catch { return value }
  }
  if (fieldType === 'boolean' || fieldType === 'checkbox') return value ? 'Yes' : 'No'
  return String(value)
}

/* ── Single print field ────────────────────────────────────────────────────── */
function PrintField({ field, value }) {
  const type   = field.field_type || field.type || 'text'
  const fmtVal = formatValue(value, type)

  if (type === 'heading') {
    return (
      <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginTop: '8px' }}>
        <span style={{ fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
          {field.label}
        </span>
      </div>
    )
  }
  if (type === 'paragraph') {
    return (
      <div style={{ gridColumn: '1 / -1', fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
        {field.label}
      </div>
    )
  }

  const colSpan = Math.min(field.col_span || 4, 12)

  return (
    <div style={{ gridColumn: `span ${colSpan}` }}>
      <div style={{ fontSize: '9px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', marginBottom: '2px' }}>
        {field.label}{field.is_required ? ' *' : ''}
      </div>
      {type === 'signature' ? (
        <div style={{ borderBottom: '1px solid #374151', minHeight: '22px', fontFamily: 'cursive', fontSize: '13px', color: '#111827', paddingBottom: '2px' }}>
          {fmtVal}
        </div>
      ) : type === 'textarea' ? (
        <div style={{ border: '1px solid #d1d5db', borderRadius: '3px', padding: '4px 6px', minHeight: '44px', fontSize: '11px', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {fmtVal}
        </div>
      ) : type === 'checkbox' || type === 'boolean' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#111827', paddingTop: '2px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '14px', height: '14px', border: '1.5px solid #374151', borderRadius: '2px',
            fontSize: '9px', fontWeight: '700',
          }}>
            {value ? '✓' : ''}
          </span>
          {field.checkbox_label || 'Yes'}
        </div>
      ) : type === 'radio' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '2px' }}>
          {(field.options || []).map((o, i) => {
            const v = typeof o === 'string' ? o : o.value
            const l = typeof o === 'string' ? o : o.label
            return (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#111827' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '12px', height: '12px', border: '1.5px solid #374151', borderRadius: '50%',
                }}>
                  {value === v ? <span style={{ width: '6px', height: '6px', background: '#111827', borderRadius: '50%', display: 'block' }} /> : null}
                </span>
                {l}
              </span>
            )
          })}
        </div>
      ) : type === 'calculated' ? (
        <div style={{ border: '1px solid #99f6e4', borderRadius: '3px', padding: '3px 6px', fontSize: '11px', fontWeight: '600', color: '#0f766e', background: '#f0fdfa' }}>
          {fmtVal || '—'}
        </div>
      ) : (
        <div style={{ border: '1px solid #d1d5db', borderRadius: '3px', padding: '3px 6px', fontSize: '11px', color: '#111827', minHeight: '22px' }}>
          {fmtVal}
        </div>
      )}
    </div>
  )
}

/* ── Main print view ───────────────────────────────────────────────────────── */
export default function FormPrintView() {
  const { clientId, formSchemaId, submissionId } = useParams()
  const [schema,   setSchema]   = useState(null)
  const [client,   setClient]   = useState(null)
  const [response, setResponse] = useState({})
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [schemaRes, clientRes] = await Promise.all([
          api.get(`/forms/${formSchemaId}`),
          api.get(`/clients/${clientId}`),
        ])
        setSchema(schemaRes.data)
        setClient(clientRes.data)

        let data = {}
        if (submissionId) {
          const subRes = await api.get(
            `/workflow/clients/${clientId}/submissions/${formSchemaId}/${submissionId}`
          )
          data = subRes.data.response_data || {}
        } else {
          const respRes = await api.get(
            `/workflow/clients/${clientId}/responses/${formSchemaId}`
          )
          data = respRes.data.response_data || {}
        }
        setResponse(data)
      } catch (e) {
        setError('Failed to load form data.')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [clientId, formSchemaId, submissionId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#6b7280' }}>
        Loading…
      </div>
    )
  }

  if (error || !schema) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#ef4444' }}>
        {error || 'Form not found.'}
      </div>
    )
  }

  const clientName = client
    ? [client.salutation, client.first_name, client.middle_name, client.last_name, client.suffix]
        .filter(Boolean).join(' ')
    : '—'
  const chartId    = client?.chart_id || ''
  const printDate  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <>
      {/* Print-specific global styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 0.65in; size: letter; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { margin: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      `}</style>

      {/* Toolbar — hidden on print */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#1e293b', padding: '10px 20px',
      }}>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>
          {schema.name} — {clientName}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => window.print()}
            style={{
              background: '#0d9488', color: '#fff', border: 'none', borderRadius: '6px',
              padding: '7px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            🖨️ Print / Save as PDF
          </button>
          <button
            onClick={() => window.close()}
            style={{
              background: '#334155', color: '#94a3b8', border: 'none', borderRadius: '6px',
              padding: '7px 14px', fontSize: '13px', cursor: 'pointer',
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Page wrapper — centers the paper on screen, invisible on print */}
      <div style={{ paddingTop: '56px', paddingBottom: '40px', background: '#f3f4f6', minHeight: '100vh' }} className="no-print-bg">
        <div style={{
          maxWidth: '816px',   // 8.5" @ 96dpi
          margin: '24px auto',
          background: '#ffffff',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          borderRadius: '4px',
          padding: '56px 64px',
        }}>
          {/* ── Form header ───────────────────────────────────────────────── */}
          <div style={{ borderBottom: '2px solid #0d9488', paddingBottom: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#111827', lineHeight: 1.2 }}>
                  {schema.name}
                </h1>
                {schema.form_type && (
                  <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {schema.form_type}
                  </span>
                )}
              </div>
              <div style={{ textAlign: 'right', fontSize: '11px', color: '#6b7280' }}>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{clientName}</div>
                {chartId && <div>Chart #{chartId}</div>}
                <div style={{ marginTop: '4px' }}>Printed: {printDate}</div>
              </div>
            </div>
          </div>

          {/* ── Sections ──────────────────────────────────────────────────── */}
          {(schema.sections || []).map((section, si) => (
            <div key={si} style={{ marginBottom: '24px' }}>
              {section.title && (
                <div style={{
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px',
                  padding: '6px 12px', marginBottom: '12px',
                }}>
                  <span style={{ fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#475569' }}>
                    {section.title}
                  </span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '8px 12px' }}>
                {(section.fields || []).map((field, fi) => (
                  <PrintField
                    key={fi}
                    field={field}
                    value={response[field.field_key || field.key]}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '32px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9ca3af' }}>
            <span>National SmartHealthCare Services</span>
            <span>{schema.name} · {clientName} · {printDate}</span>
            <span>v{schema.version}</span>
          </div>
        </div>
      </div>
    </>
  )
}
