/**
 * FormBuilder — create a form from scratch without a PDF.
 * Reuses the same field editor UI as FormIngestion.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  IconArrowLeft, IconPlus, IconTrash, IconCheck,
  IconLoader2, IconChevronDown, IconChevronUp, IconCircleCheck,
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

export default function FormBuilder() {
  const navigate = useNavigate()
  const [formName, setFormName]     = useState('')
  const [formType, setFormType]     = useState('')
  const [description, setDescription] = useState('')
  const [hasListView, setHasListView] = useState(false)
  const [listColumns, setListColumns] = useState([])
  const [sections, setSections]     = useState([{ section_key: 'general', title: 'General', order_index: 0, is_repeating: false }])
  const [fields, setFields]         = useState([])
  const [saving, setSaving]         = useState(false)
  const [savedFormId, setSavedFormId] = useState(null)
  const [tabLabel, setTabLabel]     = useState('')
  const [tabAssigned, setTabAssigned] = useState(false)
  const [assigningTab, setAssigningTab] = useState(false)

  const addSection = () => {
    const key = `section_${Date.now()}`
    setSections(prev => [...prev, { section_key: key, title: 'New Section', order_index: prev.length, is_repeating: false }])
  }

  const updateSection = (key, title) => {
    setSections(prev => prev.map(s => s.section_key === key ? { ...s, title } : s))
  }

  const removeSection = (key) => {
    setSections(prev => prev.filter(s => s.section_key !== key))
    setFields(prev => prev.filter(f => f.section_key !== key))
  }

  const addField = (sectionKey) => {
    const newField = {
      field_key: `field_${Date.now()}`,
      label: 'New Field',
      field_type: 'text',
      section_key: sectionKey,
      order_index: fields.filter(f => f.section_key === sectionKey).length,
      is_required: false,
      options: [],
      placeholder: '',
      ai_confidence: null,
    }
    setFields(prev => [...prev, newField])
  }

  const updateField = (updated) => {
    setFields(prev => prev.map(f => f.field_key === updated.field_key ? updated : f))
  }

  const removeField = (key) => setFields(prev => prev.filter(f => f.field_key !== key))

  const handleSave = async () => {
    if (!formName.trim()) return toast.error('Form name is required')
    if (!fields.length) return toast.error('Add at least one field')
    setSaving(true)
    try {
      const res = await api.post('/forms/ingest/save', {
        form_name: formName,
        form_type: formType || 'custom',
        description,
        sections,
        fields,
        ai_extraction_raw: {},
        workflow_trigger: null,
        has_list_view: hasListView,
        list_columns: listColumns,
      })
      setSavedFormId(res.data.id)
      setTabLabel(formName)
      toast.success('Form saved!')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleAssignTab = async (skip = false) => {
    if (skip) { setTabAssigned(true); return }
    if (!tabLabel.trim()) return toast.error('Tab label is required')
    setAssigningTab(true)
    try {
      await api.post('/workflow/tabs/custom', { form_schema_id: savedFormId, label: tabLabel.trim() })
      setTabAssigned(true)
      toast.success(`"${tabLabel}" tab added!`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create tab')
    } finally { setAssigningTab(false) }
  }

  // ── Success screen ──────────────────────────────────────────────────────
  if (savedFormId && !tabAssigned) {
    return (
      <div className="max-w-2xl">
        <div className="bg-card rounded-card border border-border p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <IconCircleCheck size={22} style={{ color: '#10B981' }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-heading">Form Saved!</h2>
              <p className="text-muted text-sm"><strong>{formName}</strong> — {fields.length} fields</p>
            </div>
          </div>
          <div className="border border-border rounded-card p-4 mb-4">
            <h3 className="text-sm font-medium text-heading mb-1">Add as a Client Record Tab</h3>
            <p className="text-xs text-muted mb-3">This will add a new tab to client records so staff can fill out this form.</p>
            <div className="flex gap-2">
              <input className="field-input flex-1" placeholder="Tab label" value={tabLabel} onChange={e => setTabLabel(e.target.value)} autoFocus />
              <button className="btn-primary px-4 flex items-center gap-1.5 shrink-0" onClick={() => handleAssignTab()} disabled={assigningTab || !tabLabel.trim()}>
                {assigningTab ? <IconLoader2 size={14} className="animate-spin" /> : <IconPlus size={14} />} Create Tab
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button className="text-xs text-muted hover:text-heading underline" onClick={() => handleAssignTab(true)}>Skip for now</button>
            <button className="btn-secondary text-sm" onClick={() => navigate('/forms')}>View All Forms</button>
          </div>
        </div>
      </div>
    )
  }

  if (savedFormId && tabAssigned) {
    return (
      <div className="max-w-2xl">
        <div className="bg-card rounded-card border border-border p-8 text-center">
          <IconCircleCheck size={48} className="mx-auto mb-3" style={{ color: '#10B981' }} />
          <h2 className="text-lg font-semibold text-heading mb-1">{tabLabel ? `"${tabLabel}" Tab Created!` : 'Form Ready'}</h2>
          <div className="flex items-center justify-center gap-3 mt-5">
            <button className="btn-secondary" onClick={() => navigate('/forms')}>View All Forms</button>
            <button className="btn-primary" onClick={() => { setSavedFormId(null); setFormName(''); setFormType(''); setFields([]); setSections([{ section_key: 'general', title: 'General', order_index: 0, is_repeating: false }]); setTabAssigned(false); setTabLabel(''); }}>Build Another Form</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Builder UI ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/forms')} className="text-muted hover:text-heading"><IconArrowLeft size={18} /></button>
        <div>
          <h1 className="text-2xl font-medium text-heading">Build New Form</h1>
          <p className="text-muted text-sm mt-0.5">Create a form from scratch — no PDF needed</p>
        </div>
      </div>

      {/* Form meta */}
      <div className="bg-card rounded-card border border-border p-4 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Form Name *</label>
            <input className="field-input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Hospital Discharge, Referral" autoFocus />
          </div>
          <div>
            <label className="field-label">Form Type</label>
            <input className="field-input" value={formType} onChange={e => setFormType(e.target.value)} placeholder="e.g. referral, discharge, consent" />
          </div>
          <div className="col-span-2">
            <label className="field-label">Description <span className="font-normal text-muted">(optional)</span></label>
            <input className="field-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Internal description for staff" />
          </div>
        </div>

        {/* List view toggle */}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-heading">Enable List View</p>
            <p className="text-xs text-muted">Multiple records per client (e.g. referrals, progress notes)</p>
          </div>
          <button type="button" onClick={() => setHasListView(v => !v)} className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${hasListView ? 'bg-primary' : 'bg-slate-200'}`}>
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${hasListView ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Sections + fields */}
      {sections.map(sec => (
        <SectionBuilder
          key={sec.section_key}
          section={sec}
          fields={fields.filter(f => f.section_key === sec.section_key)}
          onUpdateSection={updateSection}
          onRemoveSection={removeSection}
          onAddField={() => addField(sec.section_key)}
          onUpdateField={updateField}
          onRemoveField={removeField}
          hasListView={hasListView}
          listColumns={listColumns}
          onToggleListCol={(f) => {
            const exists = listColumns.some(c => c.field_key === f.field_key)
            if (exists) setListColumns(prev => prev.filter(c => c.field_key !== f.field_key))
            else setListColumns(prev => [...prev, { field_key: f.field_key, label: f.label }])
          }}
          canRemoveSection={sections.length > 1}
        />
      ))}

      <div className="flex items-center justify-between mt-4">
        <button className="btn-secondary text-sm flex items-center gap-1.5" onClick={addSection}>
          <IconPlus size={14} /> Add Section
        </button>
        <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <IconLoader2 size={16} className="animate-spin" /> : <IconCheck size={16} />}
          Save Form
        </button>
      </div>
    </div>
  )
}

function SectionBuilder({ section, fields, onUpdateSection, onRemoveSection, onAddField, onUpdateField, onRemoveField, hasListView, listColumns, onToggleListCol, canRemoveSection }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="bg-card rounded-card border border-border mb-3 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-page">
        <button onClick={() => setCollapsed(v => !v)} className="text-muted">
          {collapsed ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
        </button>
        <input
          className="flex-1 text-sm font-semibold text-heading bg-transparent border-0 outline-none"
          value={section.title}
          onChange={e => onUpdateSection(section.section_key, e.target.value)}
        />
        <span className="text-xs text-muted">{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
        {canRemoveSection && (
          <button className="text-muted hover:text-red-500" onClick={() => onRemoveSection(section.section_key)}>
            <IconTrash size={13} />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="p-4">
          {fields.map(field => (
            <FieldBuilder
              key={field.field_key}
              field={field}
              onUpdate={onUpdateField}
              onRemove={() => onRemoveField(field.field_key)}
              hasListView={hasListView}
              inListColumns={listColumns.some(c => c.field_key === field.field_key)}
              onToggleListCol={() => onToggleListCol(field)}
            />
          ))}
          <button className="text-xs text-primary flex items-center gap-1 mt-2" onClick={onAddField}>
            <IconPlus size={12} /> Add field
          </button>
        </div>
      )}
    </div>
  )
}

function FieldBuilder({ field, onUpdate, onRemove, hasListView, inListColumns, onToggleListCol }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-border rounded-card mb-1.5 bg-white">
      <div className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50" onClick={() => setOpen(v => !v)}>
        <span className="flex-1 text-sm font-medium text-heading truncate">{field.label || 'Untitled field'}</span>
        <span className="text-xs bg-page border border-border px-1.5 py-0.5 rounded text-muted shrink-0">
          {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
        </span>
        {hasListView && (
          <button
            className={`text-xs px-1.5 py-0.5 rounded border shrink-0 ${inListColumns ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-border text-muted hover:border-primary'}`}
            onClick={e => { e.stopPropagation(); onToggleListCol() }}
            title="Show in list view"
          >
            List
          </button>
        )}
        {open ? <IconChevronUp size={14} className="text-muted shrink-0" /> : <IconChevronDown size={14} className="text-muted shrink-0" />}
        <button className="text-muted hover:text-red-500 p-0.5 shrink-0" onClick={e => { e.stopPropagation(); onRemove() }}><IconTrash size={14} /></button>
      </div>

      {open && (
        <div className="px-3 pb-3 border-t border-border grid grid-cols-2 gap-3 pt-3">
          <div>
            <label className="field-label">Label</label>
            <input className="field-input" value={field.label} onChange={e => onUpdate({ ...field, label: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Field Type</label>
            <select className="field-input" value={field.field_type} onChange={e => onUpdate({ ...field, field_type: e.target.value })}>
              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Placeholder</label>
            <input className="field-input" value={field.placeholder || ''} onChange={e => onUpdate({ ...field, placeholder: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 pt-4">
            <input type="checkbox" id={`req-${field.field_key}`} checked={field.is_required} onChange={e => onUpdate({ ...field, is_required: e.target.checked })} />
            <label htmlFor={`req-${field.field_key}`} className="text-sm cursor-pointer">Required</label>
          </div>
          {field.field_type === 'calculated' && (
            <div className="col-span-2">
              <label className="field-label">
                Formula
                <span className="ml-1 font-normal text-muted">(use other field keys, e.g. <code className="bg-page px-1 rounded text-xs">hours * 4</code>)</span>
              </label>
              <input
                className="field-input font-mono text-xs"
                value={field.validation?.formula || ''}
                placeholder="e.g.  hours * 4   or   total_units / 4"
                onChange={e => onUpdate({ ...field, validation: { ...(field.validation || {}), formula: e.target.value } })}
              />
              <p className="text-xs text-muted mt-1">
                Reference any field in this form by its field key. Use standard math: + − * / ( )<br/>
                1 unit = 15 min example: <code className="bg-page px-0.5 rounded">hours * 4</code> → units
              </p>
            </div>
          )}
          {['dropdown', 'radio'].includes(field.field_type) && (
            <div className="col-span-2">
              <label className="field-label">Options</label>
              {(field.options || []).map((opt, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <input className="field-input" placeholder="Label" value={opt.label} onChange={e => {
                    const opts = [...field.options]
                    opts[i] = { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') }
                    onUpdate({ ...field, options: opts })
                  }} />
                  <button className="text-muted hover:text-red-500" onClick={() => onUpdate({ ...field, options: field.options.filter((_, j) => j !== i) })}><IconTrash size={13} /></button>
                </div>
              ))}
              <button className="text-xs text-primary flex items-center gap-1 mt-1" onClick={() => onUpdate({ ...field, options: [...(field.options || []), { label: '', value: '' }] })}>
                <IconPlus size={11} /> Add option
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
