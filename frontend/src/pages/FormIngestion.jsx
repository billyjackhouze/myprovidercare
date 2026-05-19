/**
 * FormIngestion.jsx
 * -----------------
 * Step 1 — Upload: drag-and-drop a form image or PDF
 * Step 2 — Review: see Claude's extracted sections + fields, edit inline
 * Step 3 — Save: persist the approved schema, choose a workflow trigger
 *
 * Design matches PreAuthPro exactly: #1B2D4E sidebar, #2563EB primary,
 * stat-card pattern, Inter font, #F1F5F9 page background.
 */
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  IconUpload, IconLoader2, IconSparkles, IconCheck, IconTrash,
  IconChevronDown, IconChevronUp, IconPlus, IconAlertTriangle,
  IconArrowLeft, IconCircleCheck,
} from '@tabler/icons-react'
import api from '@/lib/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: 'text',          label: 'Text (single line)' },
  { value: 'textarea',      label: 'Text Area (multi-line)' },
  { value: 'number',        label: 'Number' },
  { value: 'email',         label: 'Email' },
  { value: 'phone',         label: 'Phone' },
  { value: 'date',          label: 'Date' },
  { value: 'time',          label: 'Time' },
  { value: 'datetime',      label: 'Date & Time' },
  { value: 'dropdown',      label: 'Dropdown' },
  { value: 'radio',         label: 'Radio Buttons' },
  { value: 'checkbox',      label: 'Checkbox' },
  { value: 'multi_select',  label: 'Multi-Select' },
  { value: 'boolean',       label: 'Yes / No' },
  { value: 'signature',     label: 'Signature Capture' },
  { value: 'photo',         label: 'Photo Capture' },
  { value: 'gps_capture',   label: 'GPS Location' },
  { value: 'file_upload',   label: 'File Upload' },
  { value: 'client_name',   label: '⚡ System — Client Name' },
  { value: 'cm_name',       label: '⚡ System — CM Name' },
  { value: 'visit_date',    label: '⚡ System — Visit Date' },
  { value: 'visit_time',    label: '⚡ System — Visit Start Time' },
  { value: 'visit_duration',label: '⚡ System — Visit Duration' },
  { value: 'auth_number',   label: '⚡ System — Auth Number' },
  { value: 'service_code',  label: '⚡ System — Service Code' },
  { value: 'calculated',    label: 'Calculated (formula)' },
  { value: 'hidden',        label: 'Hidden (system-populated)' },
]

const WORKFLOW_TRIGGERS = [
  { value: '',               label: 'No automatic trigger' },
  { value: 'visit_arrival',  label: 'On visit arrival (geofence entry)' },
  { value: 'visit_start',    label: 'On visit start (HIPAA signature)' },
  { value: 'visit_end',      label: 'On visit end (photo capture)' },
  { value: 'manual',         label: 'Manual — staff initiates' },
  { value: 'intake',         label: 'Client intake' },
  { value: 'discharge',      label: 'Client discharge' },
  { value: 'supervisor_action', label: 'Supervisor action' },
]

const CONFIDENCE_COLOR = (c) => {
  if (!c) return '#94A3B8'
  if (c >= 0.9) return '#10B981'
  if (c >= 0.7) return '#F59E0B'
  return '#EF4444'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldRow({ field, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-border rounded-card mb-1.5 bg-white">
      {/* Summary row */}
      <div
        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
        onClick={() => setOpen(!open)}
      >
        {/* Confidence dot */}
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: CONFIDENCE_COLOR(field.ai_confidence) }}
          title={field.ai_confidence ? `${Math.round(field.ai_confidence * 100)}% confidence` : 'No confidence score'}
        />
        {/* Label */}
        <span className="flex-1 text-sm font-medium text-heading truncate">{field.label}</span>
        {/* Type badge */}
        <span className="text-xs bg-page border border-border px-1.5 py-0.5 rounded text-muted shrink-0">
          {FIELD_TYPES.find((t) => t.value === field.field_type)?.label?.replace('⚡ System — ', '⚡ ') || field.field_type}
        </span>
        {field.is_required && (
          <span className="text-xs text-danger font-medium shrink-0">Required</span>
        )}
        {/* Toggle */}
        {open ? <IconChevronUp size={14} className="text-muted shrink-0" /> : <IconChevronDown size={14} className="text-muted shrink-0" />}
        {/* Delete */}
        <button
          className="text-muted hover:text-danger p-0.5 shrink-0"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
        >
          <IconTrash size={14} />
        </button>
      </div>

      {/* Expanded edit panel */}
      {open && (
        <div className="px-3 pb-3 border-t border-border grid grid-cols-2 gap-3 pt-3">
          <div>
            <label className="field-label">Label</label>
            <input
              className="field-input"
              value={field.label}
              onChange={(e) => onUpdate({ ...field, label: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label">Field Key <span className="text-muted font-normal">(snake_case, unique)</span></label>
            <input
              className="field-input font-mono text-xs"
              value={field.field_key}
              onChange={(e) => onUpdate({ ...field, field_key: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label">Field Type</label>
            <select
              className="field-input"
              value={field.field_type}
              onChange={(e) => onUpdate({ ...field, field_type: e.target.value })}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Placeholder</label>
            <input
              className="field-input"
              value={field.placeholder || ''}
              placeholder="Optional hint text"
              onChange={(e) => onUpdate({ ...field, placeholder: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <input
              type="checkbox"
              id={`req-${field.field_key}`}
              checked={field.is_required}
              onChange={(e) => onUpdate({ ...field, is_required: e.target.checked })}
              className="rounded border-border"
            />
            <label htmlFor={`req-${field.field_key}`} className="text-sm text-heading cursor-pointer">
              Required field
            </label>
            {field.ai_confidence && (
              <span className="ml-auto text-xs" style={{ color: CONFIDENCE_COLOR(field.ai_confidence) }}>
                {Math.round(field.ai_confidence * 100)}% AI confidence
              </span>
            )}
          </div>

          {/* Options editor for dropdown / radio / checkbox / multi_select */}
          {['dropdown', 'radio', 'checkbox', 'multi_select'].includes(field.field_type) && (
            <div className="col-span-2">
              <label className="field-label">Options</label>
              {(field.options || []).map((opt, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <input
                    className="field-input"
                    placeholder="Label"
                    value={opt.label}
                    onChange={(e) => {
                      const opts = [...field.options]
                      opts[i] = { ...opts[i], label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') }
                      onUpdate({ ...field, options: opts })
                    }}
                  />
                  <button
                    className="text-muted hover:text-danger"
                    onClick={() => onUpdate({ ...field, options: field.options.filter((_, j) => j !== i) })}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              ))}
              <button
                className="text-xs text-primary flex items-center gap-1 mt-1"
                onClick={() => onUpdate({ ...field, options: [...(field.options || []), { label: '', value: '' }] })}
              >
                <IconPlus size={12} /> Add option
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SectionBlock({ section, fields, onUpdateField, onDeleteField, onAddField, onUpdateSection }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="mb-4">
      {/* Section header */}
      <div
        className="flex items-center gap-2 mb-2 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <IconChevronDown size={16} className="text-muted" /> : <IconChevronUp size={16} className="text-muted" />}
        <input
          className="flex-1 text-sm font-semibold text-heading bg-transparent border-0 outline-none focus:ring-0 p-0"
          value={section.title}
          onChange={(e) => onUpdateSection({ ...section, title: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="Section title"
        />
        <span className="text-xs text-muted bg-page border border-border px-1.5 py-0.5 rounded">
          {fields.length} field{fields.length !== 1 ? 's' : ''}
        </span>
      </div>

      {!collapsed && (
        <>
          {fields.map((field) => (
            <FieldRow
              key={field.field_key}
              field={field}
              onUpdate={onUpdateField}
              onDelete={() => onDeleteField(field.field_key)}
            />
          ))}
          <button
            className="text-xs text-primary flex items-center gap-1 mt-1 ml-1"
            onClick={onAddField}
          >
            <IconPlus size={12} /> Add field to section
          </button>
        </>
      )}
    </div>
  )
}


// ── Main page ─────────────────────────────────────────────────────────────────

const STEPS = ['Upload', 'Review & Edit', 'Save']

export default function FormIngestion() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  // Upload state
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)

  // Extraction result (editable)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('')
  const [sections, setSections] = useState([])
  const [fields, setFields] = useState([])
  const [rawResponse, setRawResponse] = useState(null)
  const [aiModel, setAiModel] = useState('')
  const [confidenceAvg, setConfidenceAvg] = useState(0)

  // Save options
  const [workflowTrigger, setWorkflowTrigger] = useState('')
  const [description, setDescription] = useState('')
  const [hasListView, setHasListView] = useState(false)
  const [listColumns, setListColumns] = useState([])
  const [saving, setSaving] = useState(false)
  const [savedFormId, setSavedFormId] = useState(null)
  const [tabLabel, setTabLabel]       = useState('')
  const [tabAssigned, setTabAssigned] = useState(false)
  const [assigningTab, setAssigningTab] = useState(false)

  // Dropzone
  const onDrop = useCallback((accepted) => {
    if (!accepted.length) return
    const f = accepted[0]
    setFile(f)
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null) // PDF — no client-side preview
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'], 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  })

  // Step 1 → 2: send to Claude Vision
  const handleIngest = async () => {
    if (!file) return toast.error('Please select a file first')
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/forms/ingest', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const data = res.data
      setFormName(data.form_name)
      setFormType(data.form_type)
      setSections(data.sections)
      setFields(data.fields)
      setRawResponse(data.raw_response)
      setAiModel(data.ai_model)
      setConfidenceAvg(data.confidence_avg)
      setStep(1)
      toast.success('Fields extracted! Review and edit below.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Extraction failed')
    } finally {
      setLoading(false)
    }
  }

  // Step 2 field edits
  const updateField = (updated) => {
    setFields((prev) => prev.map((f) => f.field_key === updated.field_key ? updated : f))
  }
  const deleteField = (key) => setFields((prev) => prev.filter((f) => f.field_key !== key))
  const addFieldToSection = (sectionKey) => {
    const newField = {
      field_key: `field_${Date.now()}`,
      label: 'New Field',
      field_type: 'text',
      section_key: sectionKey,
      order_index: fields.filter((f) => f.section_key === sectionKey).length,
      is_required: false,
      options: [],
      placeholder: null,
      ai_confidence: null,
    }
    setFields((prev) => [...prev, newField])
  }
  const updateSection = (updated) => {
    setSections((prev) => prev.map((s) => s.section_key === updated.section_key ? updated : s))
  }

  // Step 2 → 3: save to DB
  const handleSave = async () => {
    if (!formName.trim()) return toast.error('Form name is required')
    if (!fields.length) return toast.error('At least one field is required')
    setSaving(true)
    try {
      const res = await api.post('/forms/ingest/save', {
        form_name: formName,
        form_type: formType,
        description,
        sections,
        fields,
        ai_extraction_raw: rawResponse,
        workflow_trigger: workflowTrigger || null,
        has_list_view: hasListView,
        list_columns: listColumns,
      })
      setSavedFormId(res.data.id)
      setTabLabel(formName)
      setStep(2)
      toast.success('Form saved successfully!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleAssignTab = async (skip = false) => {
    if (skip) { setTabAssigned(true); return }
    if (!tabLabel.trim()) return toast.error('Tab label is required')
    setAssigningTab(true)
    try {
      await api.post('/workflow/tabs/custom', {
        form_schema_id: savedFormId,
        label: tabLabel.trim(),
      })
      setTabAssigned(true)
      toast.success(`"${tabLabel}" tab added to client records!`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create tab')
    } finally {
      setAssigningTab(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/forms')} className="text-muted hover:text-heading">
          <IconArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-medium text-heading">Ingest Form</h1>
          <p className="text-muted text-sm mt-0.5">
            Upload a paper form — Claude AI extracts every field automatically
          </p>
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-3 mb-6">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border ${
                i < step
                  ? 'bg-green border-green text-white'
                  : i === step
                  ? 'bg-primary border-primary text-white'
                  : 'bg-white border-border text-muted'
              }`}
            >
              {i < step ? <IconCheck size={12} /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? 'text-heading font-medium' : 'text-muted'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px ${i < step ? 'bg-green' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── STEP 0: Upload ─────────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="bg-card rounded-card border border-border p-6">
          <h2 className="text-sm font-medium text-heading mb-4">Upload Form Image or PDF</h2>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-card p-10 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-blue-50' : 'border-border hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <IconUpload size={32} className="mx-auto text-muted mb-3" strokeWidth={1.5} />
            {file ? (
              <p className="text-heading font-medium text-sm">{file.name}</p>
            ) : (
              <>
                <p className="text-heading font-medium text-sm mb-1">
                  Drop a form image or PDF here
                </p>
                <p className="text-muted text-xs">PNG, JPG, WEBP, or PDF — max 20 MB</p>
              </>
            )}
          </div>

          {/* Image preview */}
          {preview && (
            <div className="mt-4 border border-border rounded-card overflow-hidden">
              <img src={preview} alt="Form preview" className="max-h-64 w-full object-contain" />
            </div>
          )}

          {file && !preview && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted">
              <span>📄</span>
              <span>{file.name} — PDF selected</span>
            </div>
          )}

          {/* AI info banner */}
          <div
            className="mt-4 flex items-start gap-3 rounded-card p-3 text-xs"
            style={{ background: '#FFFBEB', border: '0.5px solid #F59E0B' }}
          >
            <IconSparkles size={14} style={{ color: '#F59E0B' }} className="mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold" style={{ color: '#92400E' }}>Claude AI will analyze this form</span>
              <span style={{ color: '#B45309' }}> — it identifies every field, section, and input type, and maps system fields like client name, visit date, and signatures automatically. You can edit everything before saving.</span>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              className="btn-primary flex items-center gap-2"
              onClick={handleIngest}
              disabled={!file || loading}
            >
              {loading ? (
                <><IconLoader2 size={16} className="animate-spin" /> Analyzing with Claude…</>
              ) : (
                <><IconSparkles size={16} /> Extract Fields</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 1: Review & Edit ──────────────────────────────────────────── */}
      {step === 1 && (
        <div>
          {/* Meta row */}
          <div className="bg-card rounded-card border border-border p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <IconSparkles size={14} style={{ color: '#2563EB' }} />
              <span className="text-xs text-muted">
                Extracted by <strong>{aiModel}</strong> — avg confidence{' '}
                <span style={{ color: CONFIDENCE_COLOR(confidenceAvg) }}>
                  {Math.round(confidenceAvg * 100)}%
                </span>{' '}
                — {fields.length} fields in {sections.length} section{sections.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Form Name</label>
                <input className="field-input" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Form Type</label>
                <input
                  className="field-input"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  placeholder="e.g. progress_note, hipaa_consent, intake"
                />
              </div>
              <div className="col-span-2">
                <label className="field-label">Description <span className="text-muted font-normal">(optional)</span></label>
                <input
                  className="field-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Internal description for staff"
                />
              </div>
            </div>
          </div>

          {/* Confidence legend */}
          <div className="flex items-center gap-4 mb-3 text-xs text-muted">
            <span className="font-medium text-heading">Field confidence:</span>
            {[['#10B981', '90–100% (high)'], ['#F59E0B', '70–89% (review)'], ['#EF4444', '<70% (check)']].map(([c, l]) => (
              <span key={c} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                {l}
              </span>
            ))}
          </div>

          {/* Sections + fields */}
          <div className="bg-card rounded-card border border-border p-4">
            {sections.map((sec) => (
              <SectionBlock
                key={sec.section_key}
                section={sec}
                fields={fields.filter((f) => f.section_key === sec.section_key)}
                onUpdateField={updateField}
                onDeleteField={deleteField}
                onAddField={() => addFieldToSection(sec.section_key)}
                onUpdateSection={updateSection}
              />
            ))}
          </div>

          {/* Low-confidence warning */}
          {confidenceAvg < 0.75 && (
            <div
              className="mt-3 flex items-start gap-2 rounded-card p-3 text-xs"
              style={{ background: '#FEF2F2', border: '0.5px solid #EF4444' }}
            >
              <IconAlertTriangle size={14} style={{ color: '#EF4444' }} className="shrink-0 mt-0.5" />
              <span style={{ color: '#991B1B' }}>
                <strong>Low average confidence.</strong> Please review all fields carefully — some labels, types, or options may need correction.
              </span>
            </div>
          )}

          <div className="mt-5 flex justify-between">
            <button className="btn-secondary" onClick={() => setStep(0)}>
              ← Back
            </button>
            <button className="btn-primary" onClick={() => setStep(2)}>
              Continue to Save →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Save / Confirm ─────────────────────────────────────────── */}
      {step === 2 && !savedFormId && (
        <div className="bg-card rounded-card border border-border p-6">
          <h2 className="text-sm font-medium text-heading mb-4">Configure &amp; Save</h2>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="col-span-2">
              <label className="field-label">Workflow Trigger</label>
              <select
                className="field-input"
                value={workflowTrigger}
                onChange={(e) => setWorkflowTrigger(e.target.value)}
              >
                {WORKFLOW_TRIGGERS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted mt-1">
                When should this form automatically appear for staff? Choose the event that triggers it.
              </p>
            </div>
          </div>

          {/* List View configuration */}
          <div className="col-span-2 border border-border rounded-card p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-heading">Enable List View</p>
                <p className="text-xs text-muted mt-0.5">
                  Allow multiple records per client (like progress notes or referrals). Staff see a list and can open each record individually.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHasListView(v => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${hasListView ? 'bg-primary' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${hasListView ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {hasListView && (
              <div>
                <p className="text-xs font-medium text-heading mb-2">List Columns — pick fields to show in the list view</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {fields.map(f => {
                    const isChecked = listColumns.some(c => c.field_key === f.field_key)
                    return (
                      <label key={f.field_key} className="flex items-center gap-2 cursor-pointer py-1 px-2 rounded hover:bg-page">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setListColumns(prev => [...prev, { field_key: f.field_key, label: f.label }])
                            } else {
                              setListColumns(prev => prev.filter(c => c.field_key !== f.field_key))
                            }
                          }}
                          className="accent-blue-600"
                        />
                        <span className="text-xs text-heading">{f.label}</span>
                        <span className="text-xs text-muted ml-auto">{f.field_type}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div
            className="rounded-card p-3 mb-5 text-xs"
            style={{ background: '#F0FDF4', border: '0.5px solid #10B981' }}
          >
            <div className="font-semibold mb-1" style={{ color: '#065F46' }}>Ready to save</div>
            <div style={{ color: '#059669' }} className="space-y-0.5">
              <div><strong>{formName}</strong> — {formType}</div>
              <div>{sections.length} section{sections.length !== 1 ? 's' : ''}, {fields.length} fields</div>
              {workflowTrigger && <div>Trigger: {WORKFLOW_TRIGGERS.find((t) => t.value === workflowTrigger)?.label}</div>}
            </div>
          </div>

          <div className="flex justify-between">
            <button className="btn-secondary" onClick={() => setStep(1)}>
              ← Back to Edit
            </button>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <IconLoader2 size={16} className="animate-spin" /> : <IconCheck size={16} />}
              Save Form Schema
            </button>
          </div>
        </div>
      )}

      {/* ── Success ────────────────────────────────────────────────────────── */}
      {savedFormId && !tabAssigned && (
        <div className="bg-card rounded-card border border-border p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <IconCircleCheck size={22} style={{ color: '#10B981' }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-heading">Form Saved!</h2>
              <p className="text-muted text-sm"><strong>{formName}</strong> — {fields.length} fields ready</p>
            </div>
          </div>

          <div className="border border-border rounded-card p-4 mb-4">
            <h3 className="text-sm font-medium text-heading mb-1">Add as a Client Record Tab</h3>
            <p className="text-xs text-muted mb-3">
              This will add a new tab to every client record so staff can fill out this form per client.
            </p>
            <div className="flex gap-2">
              <input
                className="field-input flex-1"
                placeholder="Tab label (e.g. Referral, Hospital Discharge)"
                value={tabLabel}
                onChange={e => setTabLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAssignTab()}
                autoFocus
              />
              <button
                className="btn-primary px-4 flex items-center gap-1.5 shrink-0"
                onClick={() => handleAssignTab()}
                disabled={assigningTab || !tabLabel.trim()}
              >
                {assigningTab ? <IconLoader2 size={14} className="animate-spin" /> : <IconPlus size={14} />}
                Create Tab
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button className="text-xs text-muted hover:text-heading underline" onClick={() => handleAssignTab(true)}>
              Skip — I'll assign it in Workflow Settings later
            </button>
            <button className="btn-secondary text-sm" onClick={() => navigate('/forms')}>
              View All Forms
            </button>
          </div>
        </div>
      )}

      {savedFormId && tabAssigned && (
        <div className="bg-card rounded-card border border-border p-8 text-center">
          <IconCircleCheck size={48} className="mx-auto mb-3" style={{ color: '#10B981' }} />
          <h2 className="text-lg font-semibold text-heading mb-1">
            {tabLabel ? `"${tabLabel}" Tab Created!` : 'Form Ready'}
          </h2>
          <p className="text-muted text-sm mb-5">
            {tabLabel
              ? `The tab now appears in all client records. Open any client and click "${tabLabel}" to fill it out.`
              : `${formName} is saved. Assign it to a tab anytime from Workflow Settings.`}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button className="btn-secondary" onClick={() => navigate('/forms')}>View All Forms</button>
            <button
              className="btn-primary"
              onClick={() => {
                setStep(0); setFile(null); setPreview(null); setSavedFormId(null)
                setFormName(''); setFormType(''); setSections([]); setFields([])
                setTabLabel(''); setTabAssigned(false)
              }}
            >
              Ingest Another Form
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
