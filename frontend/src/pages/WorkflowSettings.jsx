/**
 * WorkflowSettings — Admin page to manage client record tabs and Smart Fields.
 * Drag to reorder, toggle visibility, rename, add custom forms as tabs.
 * Smart Fields: plain-language rules that surface form data on the General Info tab.
 */
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconGripVertical, IconEye, IconEyeOff, IconPencil,
  IconCheck, IconX, IconPlus, IconLock, IconLoader2,
  IconSparkles, IconArrowLeft, IconTrash, IconChevronUp, IconChevronDown,
  IconWand, IconAlertCircle,
} from '@tabler/icons-react'
import api from '@/lib/api'

export default function WorkflowSettings() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('tabs') // 'tabs' | 'smartfields'

  return (
    <div className="max-w-2xl">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/settings')} className="text-muted hover:text-heading transition-colors">
          <IconArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-medium text-heading">Client Record Workflow</h1>
          <p className="text-muted text-sm mt-0.5">
            Configure tabs, visibility, and smart field metrics
          </p>
        </div>
      </div>

      {/* Section toggle */}
      <div className="flex gap-1 mb-6 bg-page border border-border rounded-card p-1 w-fit">
        <button
          onClick={() => setActiveSection('tabs')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            activeSection === 'tabs'
              ? 'bg-white text-heading shadow-sm'
              : 'text-muted hover:text-heading'
          }`}
        >
          Tab Layout
        </button>
        <button
          onClick={() => setActiveSection('smartfields')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
            activeSection === 'smartfields'
              ? 'bg-white text-heading shadow-sm'
              : 'text-muted hover:text-heading'
          }`}
        >
          <IconSparkles size={13} />
          Smart Fields
        </button>
      </div>

      {activeSection === 'tabs' ? <TabsSection navigate={navigate} /> : <SmartFieldsSection />}
    </div>
  )
}

// ─── Tab Layout Section ───────────────────────────────────────────────────────
function TabsSection({ navigate }) {
  const [tabs, setTabs] = useState([])
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editingKey, setEditingKey] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedFormId, setSelectedFormId] = useState('')

  const dragItem = useRef(null)
  const dragOver = useRef(null)

  useEffect(() => {
    Promise.all([
      api.get('/workflow/tabs'),
      api.get('/forms'),
    ]).then(([tabRes, formRes]) => {
      setTabs(tabRes.data)
      const existingIds = new Set(tabRes.data.map(t => t.form_schema_id).filter(Boolean))
      setForms((formRes.data || []).filter(f => !existingIds.has(f.id)))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleDragStart = (idx) => { dragItem.current = idx }
  const handleDragEnter = (idx) => { dragOver.current = idx }

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null) return
    const updated = [...tabs]
    const dragged = updated.splice(dragItem.current, 1)[0]
    updated.splice(dragOver.current, 0, dragged)
    setTabs(updated.map((t, i) => ({ ...t, sort_order: i + 1 })))
    dragItem.current = null
    dragOver.current = null
  }

  const toggleVisible = (tab_key) => {
    setTabs(prev => prev.map(t =>
      t.tab_key === tab_key && !t.is_locked ? { ...t, is_visible: !t.is_visible } : t
    ))
  }

  const startEdit = (tab) => { setEditingKey(tab.tab_key); setEditLabel(tab.label) }
  const commitEdit = () => {
    if (!editLabel.trim()) return
    setTabs(prev => prev.map(t => t.tab_key === editingKey ? { ...t, label: editLabel.trim() } : t))
    setEditingKey(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/workflow/tabs/reorder', {
        tabs: tabs.map(t => ({ tab_key: t.tab_key, sort_order: t.sort_order, is_visible: t.is_visible }))
      })
      for (const t of tabs) {
        if (!t.is_locked) await api.put(`/workflow/tabs/${t.tab_key}`, { label: t.label })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {} finally { setSaving(false) }
  }

  const handleAddFormTab = async () => {
    if (!selectedFormId) return
    const form = forms.find(f => f.id === selectedFormId)
    await api.post('/workflow/tabs/custom', { form_schema_id: selectedFormId, label: form?.name || 'Custom Form' })
    const r = await api.get('/workflow/tabs')
    setTabs(r.data)
    setForms(prev => prev.filter(f => f.id !== selectedFormId))
    setSelectedFormId('')
    setShowAddForm(false)
  }

  const handleRemoveTab = async (tab_key) => {
    if (!confirm('Remove this custom tab?')) return
    await api.delete(`/workflow/tabs/${tab_key}`)
    setTabs(prev => prev.filter(t => t.tab_key !== tab_key))
  }

  if (loading) return (
    <div className="flex items-center justify-center gap-2 text-muted py-20">
      <IconLoader2 size={18} className="animate-spin" />
      Loading workflow config…
    </div>
  )

  const visible = tabs.filter(t => t.is_visible)
  const hidden  = tabs.filter(t => !t.is_visible)

  return (
    <>
      {/* Visible tabs */}
      <div className="bg-card border border-border rounded-card overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-border bg-page flex items-center justify-between">
          <h2 className="text-sm font-semibold text-heading">Visible Tabs ({visible.length})</h2>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn-secondary text-xs flex items-center gap-1 px-2.5 py-1"
            >
              <IconPlus size={12} /> Add Custom Form
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-1.5">
              {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />}
              Save
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-end gap-3">
            <div className="flex-1">
              <label className="field-label">Select a form from the Forms Engine</label>
              {forms.length === 0 ? (
                <p className="text-xs text-muted mt-1">
                  No forms available.{' '}
                  <button onClick={() => navigate('/forms/ingest')} className="text-primary underline">
                    Ingest a form first
                  </button>
                </p>
              ) : (
                <select value={selectedFormId} onChange={e => setSelectedFormId(e.target.value)} className="field-input">
                  <option value="">Choose form…</option>
                  {forms.map(f => <option key={f.id} value={f.id}>{f.name} {f.ai_extracted ? '✨' : ''}</option>)}
                </select>
              )}
            </div>
            <button onClick={handleAddFormTab} disabled={!selectedFormId} className="btn-primary text-sm px-3 py-2 disabled:opacity-40">
              Add Tab
            </button>
            <button onClick={() => setShowAddForm(false)} className="text-muted hover:text-heading"><IconX size={16} /></button>
          </div>
        )}

        <div className="divide-y divide-border">
          {tabs.filter(t => t.is_visible).map((tab, idx) => (
            <TabRow
              key={tab.tab_key} tab={tab} idx={idx}
              isEditing={editingKey === tab.tab_key} editLabel={editLabel}
              onEditLabelChange={setEditLabel}
              onStartEdit={() => startEdit(tab)} onCommitEdit={commitEdit}
              onCancelEdit={() => setEditingKey(null)}
              onToggleVisible={() => toggleVisible(tab.tab_key)}
              onRemove={() => handleRemoveTab(tab.tab_key)}
              onDragStart={() => handleDragStart(tabs.indexOf(tab))}
              onDragEnter={() => handleDragEnter(tabs.indexOf(tab))}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      </div>

      {hidden.length > 0 && (
        <div className="bg-card border border-border rounded-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-page">
            <h2 className="text-sm font-semibold text-muted">Hidden Tabs ({hidden.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {hidden.map((tab, idx) => (
              <TabRow
                key={tab.tab_key} tab={tab} idx={idx}
                isEditing={editingKey === tab.tab_key} editLabel={editLabel}
                onEditLabelChange={setEditLabel}
                onStartEdit={() => startEdit(tab)} onCommitEdit={commitEdit}
                onCancelEdit={() => setEditingKey(null)}
                onToggleVisible={() => toggleVisible(tab.tab_key)}
                onRemove={() => handleRemoveTab(tab.tab_key)}
                onDragStart={() => handleDragStart(tabs.indexOf(tab))}
                onDragEnter={() => handleDragEnter(tabs.indexOf(tab))}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-card p-4 text-sm text-blue-800">
        <p className="font-medium mb-1 flex items-center gap-1.5">
          <IconSparkles size={14} /> How custom forms work
        </p>
        <p className="text-blue-700 text-xs leading-relaxed">
          Go to <strong>Forms Engine → Ingest New Form</strong> and upload a PDF or screenshot of any paper form.
          Claude AI will extract all fields automatically. After reviewing, come back here and add it as a tab —
          it will appear in every client record and each client gets their own filled copy stored in your database.
        </p>
      </div>
    </>
  )
}

// ─── Smart Fields Section ─────────────────────────────────────────────────────
function SmartFieldsSection() {
  const [smartFields, setSmartFields] = useState([])
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)

  // Interpret panel state
  const [nlInput, setNlInput] = useState('')
  const [interpreting, setInterpreting] = useState(false)
  const [interpreted, setInterpreted] = useState(null)   // Claude result
  const [interpretError, setInterpretError] = useState(null)
  const [saving, setSaving] = useState(false)

  // Manual picker (fallback)
  const [showManual, setShowManual] = useState(false)
  const [manualFormId, setManualFormId] = useState('')
  const [manualFieldKey, setManualFieldKey] = useState('')
  const [manualLabel, setManualLabel] = useState('')
  const [manualAgg, setManualAgg] = useState('latest')
  const [manualFormat, setManualFormat] = useState('auto')
  const [formFields, setFormFields] = useState([])
  const [loadingFields, setLoadingFields] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [sfRes, formsRes] = await Promise.all([
        api.get('/workflow/smart-fields'),
        api.get('/forms'),
      ])
      setSmartFields(sfRes.data)
      setForms(formsRes.data || [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Load fields when a form is picked in manual mode
  useEffect(() => {
    if (!manualFormId) { setFormFields([]); return }
    setLoadingFields(true)
    api.get(`/forms/${manualFormId}`)
      .then(r => {
        const fields = (r.data.sections || []).flatMap(s => s.fields || [])
        setFormFields(fields)
      })
      .catch(() => setFormFields([]))
      .finally(() => setLoadingFields(false))
  }, [manualFormId])

  const handleInterpret = async () => {
    if (!nlInput.trim()) return
    setInterpreting(true)
    setInterpreted(null)
    setInterpretError(null)
    setShowManual(false)
    try {
      const r = await api.post('/workflow/smart-fields/interpret', { description: nlInput })
      if (r.data.error) {
        setInterpretError(r.data.reasoning || 'Could not match to a known form/field.')
        setShowManual(true)
      } else {
        setInterpreted(r.data)
      }
    } catch {
      setInterpretError('Interpretation request failed. Use manual picker below.')
      setShowManual(true)
    } finally { setInterpreting(false) }
  }

  const handleSaveInterpreted = async () => {
    if (!interpreted) return
    setSaving(true)
    try {
      await api.post('/workflow/smart-fields', {
        label: interpreted.label,
        source_form_id: interpreted.source_form_id,
        source_field_key: interpreted.source_field_key,
        aggregation: interpreted.aggregation || 'latest',
        display_format: interpreted.display_format || 'auto',
        nl_description: nlInput,
        order_index: smartFields.length,
      })
      setInterpreted(null)
      setNlInput('')
      await load()
    } catch {} finally { setSaving(false) }
  }

  const handleSaveManual = async () => {
    if (!manualFormId || !manualFieldKey || !manualLabel) return
    setSaving(true)
    try {
      await api.post('/workflow/smart-fields', {
        label: manualLabel,
        source_form_id: manualFormId,
        source_field_key: manualFieldKey,
        aggregation: manualAgg,
        display_format: manualFormat,
        nl_description: nlInput || null,
        order_index: smartFields.length,
      })
      setShowManual(false)
      setManualFormId(''); setManualFieldKey(''); setManualLabel('')
      setManualAgg('latest'); setManualFormat('auto')
      setNlInput('')
      await load()
    } catch {} finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this smart field?')) return
    await api.delete(`/workflow/smart-fields/${id}`)
    setSmartFields(prev => prev.filter(sf => sf.id !== id))
  }

  const handleMove = async (idx, dir) => {
    const newList = [...smartFields]
    const target = idx + dir
    if (target < 0 || target >= newList.length) return
    ;[newList[idx], newList[target]] = [newList[target], newList[idx]]
    setSmartFields(newList)
    // Persist new order_index for both
    await Promise.all([
      api.put(`/workflow/smart-fields/${newList[idx].id}`, { order_index: idx }),
      api.put(`/workflow/smart-fields/${newList[target].id}`, { order_index: target }),
    ])
  }

  const confidenceColor = (c) => {
    if (c >= 0.8) return 'text-emerald-600'
    if (c >= 0.5) return 'text-amber-600'
    return 'text-red-500'
  }

  if (loading) return (
    <div className="flex items-center justify-center gap-2 text-muted py-20">
      <IconLoader2 size={18} className="animate-spin" />
      Loading smart fields…
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Explainer */}
      <div className="bg-blue-50 border border-blue-200 rounded-card p-4 text-sm text-blue-800">
        <p className="font-medium mb-1 flex items-center gap-1.5">
          <IconSparkles size={14} /> What are Smart Fields?
        </p>
        <p className="text-blue-700 text-xs leading-relaxed">
          Smart Fields pull a value from any form submission and display it in a <strong>Key Metrics</strong> panel
          at the top of every client's General Info tab. Example: "Show the most recent Auth Expiration Date."
        </p>
      </div>

      {/* NL interpreter */}
      <div className="bg-card border border-border rounded-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-page">
          <h2 className="text-sm font-semibold text-heading flex items-center gap-1.5">
            <IconWand size={14} /> Add a Smart Field
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="field-label">Describe the rule in plain language</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={nlInput}
                onChange={e => setNlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInterpret()}
                placeholder='e.g. "Show the most recent Auth Expiration Date from the Authorization form"'
                className="field-input flex-1"
              />
              <button
                onClick={handleInterpret}
                disabled={interpreting || !nlInput.trim()}
                className="btn-primary text-sm flex items-center gap-1.5 px-4 disabled:opacity-50 shrink-0"
              >
                {interpreting
                  ? <IconLoader2 size={14} className="animate-spin" />
                  : <IconSparkles size={14} />
                }
                Interpret →
              </button>
            </div>
          </div>

          {/* Interpretation result */}
          {interpreted && !interpreted.error && (
            <div className="border border-emerald-200 bg-emerald-50 rounded-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-emerald-800">Claude interpreted this as:</p>
                <span className={`text-xs font-medium ${confidenceColor(interpreted.confidence)}`}>
                  {Math.round((interpreted.confidence || 0) * 100)}% confident
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div><span className="text-muted">Label:</span> <span className="text-heading font-medium">{interpreted.label}</span></div>
                <div><span className="text-muted">Form:</span> <span className="text-heading">{interpreted.source_form_name || interpreted.source_form_id}</span></div>
                <div><span className="text-muted">Field:</span> <span className="text-heading font-mono">{interpreted.source_field_key}</span></div>
                <div><span className="text-muted">Aggregation:</span> <span className="text-heading">{interpreted.aggregation}</span></div>
                <div><span className="text-muted">Format:</span> <span className="text-heading">{interpreted.display_format}</span></div>
              </div>
              {interpreted.reasoning && (
                <p className="text-xs text-emerald-700 italic">{interpreted.reasoning}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveInterpreted}
                  disabled={saving}
                  className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5"
                >
                  {saving ? <IconLoader2 size={12} className="animate-spin" /> : <IconCheck size={12} />}
                  Save This Rule
                </button>
                <button
                  onClick={() => { setShowManual(true); setInterpretError(null) }}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Edit Manually
                </button>
                <button onClick={() => setInterpreted(null)} className="text-muted hover:text-heading ml-auto">
                  <IconX size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Error + fallback */}
          {interpretError && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-card p-3 text-xs text-amber-800">
              <IconAlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{interpretError}</span>
            </div>
          )}

          {/* Manual picker */}
          {showManual && (
            <div className="border border-border rounded-card p-3 space-y-3 bg-page">
              <p className="text-xs font-semibold text-heading">Manual Field Picker</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Display Label</label>
                  <input
                    type="text"
                    value={manualLabel}
                    onChange={e => setManualLabel(e.target.value)}
                    placeholder="e.g. Auth Exp Date"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label">Aggregation</label>
                  <select value={manualAgg} onChange={e => setManualAgg(e.target.value)} className="field-input">
                    <option value="latest">Latest</option>
                    <option value="sum">Sum</option>
                    <option value="count">Count</option>
                    <option value="max">Max</option>
                    <option value="min">Min</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Source Form</label>
                  <select value={manualFormId} onChange={e => setManualFormId(e.target.value)} className="field-input">
                    <option value="">Choose form…</option>
                    {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Source Field</label>
                  {loadingFields ? (
                    <div className="field-input flex items-center gap-2 text-muted text-xs">
                      <IconLoader2 size={12} className="animate-spin" /> Loading fields…
                    </div>
                  ) : (
                    <select
                      value={manualFieldKey}
                      onChange={e => setManualFieldKey(e.target.value)}
                      className="field-input"
                      disabled={!manualFormId}
                    >
                      <option value="">Choose field…</option>
                      {formFields.map(f => (
                        <option key={f.field_key} value={f.field_key}>{f.label} ({f.field_key})</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="field-label">Display Format</label>
                  <select value={manualFormat} onChange={e => setManualFormat(e.target.value)} className="field-input">
                    <option value="auto">Auto</option>
                    <option value="date">Date</option>
                    <option value="number">Number</option>
                    <option value="currency">Currency</option>
                    <option value="text">Text</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveManual}
                  disabled={saving || !manualFormId || !manualFieldKey || !manualLabel}
                  className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5 disabled:opacity-50"
                >
                  {saving ? <IconLoader2 size={12} className="animate-spin" /> : <IconCheck size={12} />}
                  Save Rule
                </button>
                <button onClick={() => setShowManual(false)} className="btn-secondary text-xs px-3 py-1.5">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Existing smart fields */}
      {smartFields.length > 0 && (
        <div className="bg-card border border-border rounded-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-page">
            <h2 className="text-sm font-semibold text-heading">Active Smart Fields ({smartFields.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {smartFields.map((sf, idx) => (
              <div key={sf.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => handleMove(idx, -1)}
                    disabled={idx === 0}
                    className="text-muted hover:text-heading disabled:opacity-20"
                  >
                    <IconChevronUp size={13} />
                  </button>
                  <button
                    onClick={() => handleMove(idx, 1)}
                    disabled={idx === smartFields.length - 1}
                    className="text-muted hover:text-heading disabled:opacity-20"
                  >
                    <IconChevronDown size={13} />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-heading truncate">{sf.label}</p>
                  <p className="text-xs text-muted truncate">
                    {sf.source_form_name || sf.source_form_id} · <span className="font-mono">{sf.source_field_key}</span>
                    {' · '}{sf.aggregation}{' · '}{sf.display_format}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(sf.id)}
                  title="Delete smart field"
                  className="text-muted hover:text-red-500 transition-colors shrink-0"
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {smartFields.length === 0 && !loading && (
        <div className="text-center py-10 text-muted text-sm">
          No smart fields yet. Add one above to display key metrics on the General Info tab.
        </div>
      )}
    </div>
  )
}

// ─── Single tab row ───────────────────────────────────────────────────────────
function TabRow({
  tab, isEditing, editLabel, onEditLabelChange,
  onStartEdit, onCommitEdit, onCancelEdit,
  onToggleVisible, onRemove,
  onDragStart, onDragEnter, onDragEnd,
}) {
  return (
    <div
      draggable={!tab.is_locked}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}
      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
        tab.is_visible ? 'bg-white' : 'bg-page'
      } ${!tab.is_locked ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <IconGripVertical size={14} className={tab.is_locked ? 'text-transparent' : 'text-muted'} />

      {tab.is_locked && <IconLock size={13} className="text-muted shrink-0" />}

      {tab.tab_type === 'custom' && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium shrink-0">
          Custom
        </span>
      )}

      {isEditing ? (
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            value={editLabel}
            onChange={e => onEditLabelChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') onCancelEdit() }}
            className="field-input text-sm py-1 flex-1"
            autoFocus
          />
          <button onClick={onCommitEdit} className="text-emerald-600 hover:text-emerald-700"><IconCheck size={15} /></button>
          <button onClick={onCancelEdit} className="text-muted hover:text-heading"><IconX size={15} /></button>
        </div>
      ) : (
        <span className={`flex-1 text-sm ${tab.is_visible ? 'text-heading' : 'text-muted'}`}>{tab.label}</span>
      )}

      {!isEditing && (
        <div className="flex items-center gap-2 shrink-0">
          {!tab.is_locked && (
            <button onClick={onStartEdit} title="Rename" className="text-muted hover:text-heading transition-colors">
              <IconPencil size={14} />
            </button>
          )}
          {!tab.is_locked && (
            <button onClick={onToggleVisible} title={tab.is_visible ? 'Hide tab' : 'Show tab'} className="text-muted hover:text-heading transition-colors">
              {tab.is_visible ? <IconEye size={14} /> : <IconEyeOff size={14} className="text-slate-300" />}
            </button>
          )}
          {tab.tab_type === 'custom' && (
            <button onClick={onRemove} title="Remove custom tab" className="text-muted hover:text-red-500 transition-colors">
              <IconX size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
