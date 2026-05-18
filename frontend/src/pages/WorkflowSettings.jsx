/**
 * WorkflowSettings — Admin page to manage client record tabs.
 * Drag to reorder, toggle visibility, rename, add custom forms as tabs.
 */
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconGripVertical, IconEye, IconEyeOff, IconPencil,
  IconCheck, IconX, IconPlus, IconLock, IconLoader2,
  IconSparkles, IconArrowLeft,
} from '@tabler/icons-react'
import api from '@/lib/api'

export default function WorkflowSettings() {
  const navigate = useNavigate()
  const [tabs, setTabs] = useState([])
  const [forms, setForms] = useState([])      // available forms to add
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
      // Only show forms that aren't already tabs
      const existingIds = new Set(tabRes.data.map(t => t.form_schema_id).filter(Boolean))
      setForms((formRes.data || []).filter(f => !existingIds.has(f.id)))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // ── Drag & drop reorder ───────────────────────────────────────────────────
  const handleDragStart = (idx) => { dragItem.current = idx }
  const handleDragEnter = (idx) => { dragOver.current = idx }

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null) return
    const updated = [...tabs]
    const dragged = updated.splice(dragItem.current, 1)[0]
    updated.splice(dragOver.current, 0, dragged)
    // Reassign sort orders
    const reordered = updated.map((t, i) => ({ ...t, sort_order: i + 1 }))
    setTabs(reordered)
    dragItem.current = null
    dragOver.current = null
  }

  // ── Toggle visibility ─────────────────────────────────────────────────────
  const toggleVisible = (tab_key) => {
    setTabs(prev => prev.map(t =>
      t.tab_key === tab_key && !t.is_locked
        ? { ...t, is_visible: !t.is_visible }
        : t
    ))
  }

  // ── Rename ────────────────────────────────────────────────────────────────
  const startEdit = (tab) => {
    setEditingKey(tab.tab_key)
    setEditLabel(tab.label)
  }
  const commitEdit = () => {
    if (!editLabel.trim()) return
    setTabs(prev => prev.map(t =>
      t.tab_key === editingKey ? { ...t, label: editLabel.trim() } : t
    ))
    setEditingKey(null)
  }

  // ── Save all changes ──────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      // Save reorder + visibility
      await api.put('/workflow/tabs/reorder', {
        tabs: tabs.map(t => ({
          tab_key: t.tab_key,
          sort_order: t.sort_order,
          is_visible: t.is_visible,
        }))
      })
      // Save any label changes
      for (const t of tabs) {
        if (!t.is_locked) {
          await api.put(`/workflow/tabs/${t.tab_key}`, { label: t.label })
        }
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  // ── Add custom form as tab ────────────────────────────────────────────────
  const handleAddFormTab = async () => {
    if (!selectedFormId) return
    const form = forms.find(f => f.id === selectedFormId)
    await api.post('/workflow/tabs/custom', {
      form_schema_id: selectedFormId,
      label: form?.name || 'Custom Form',
    })
    // Reload tabs
    const r = await api.get('/workflow/tabs')
    setTabs(r.data)
    setForms(prev => prev.filter(f => f.id !== selectedFormId))
    setSelectedFormId('')
    setShowAddForm(false)
  }

  // ── Remove custom tab ─────────────────────────────────────────────────────
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
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="text-muted hover:text-heading transition-colors">
            <IconArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-medium text-heading">Client Record Workflow</h1>
            <p className="text-muted text-sm mt-0.5">
              Drag to reorder tabs · toggle visibility · rename · add custom forms
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>}
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-1.5">
            {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Visible tabs */}
      <div className="bg-card border border-border rounded-card overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-border bg-page flex items-center justify-between">
          <h2 className="text-sm font-semibold text-heading">
            Visible Tabs ({visible.length})
          </h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-secondary text-xs flex items-center gap-1 px-2.5 py-1"
          >
            <IconPlus size={12} /> Add Custom Form
          </button>
        </div>

        {/* Add form panel */}
        {showAddForm && (
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-end gap-3">
            <div className="flex-1">
              <label className="field-label">Select a form from the Forms Engine</label>
              {forms.length === 0 ? (
                <p className="text-xs text-muted mt-1">
                  No forms available.{' '}
                  <button
                    onClick={() => navigate('/forms/ingest')}
                    className="text-primary underline"
                  >
                    Ingest a form first
                  </button>
                </p>
              ) : (
                <select
                  value={selectedFormId}
                  onChange={e => setSelectedFormId(e.target.value)}
                  className="field-input"
                >
                  <option value="">Choose form…</option>
                  {forms.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.ai_extracted ? '✨' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button
              onClick={handleAddFormTab}
              disabled={!selectedFormId}
              className="btn-primary text-sm px-3 py-2 disabled:opacity-40"
            >
              Add Tab
            </button>
            <button onClick={() => setShowAddForm(false)} className="text-muted hover:text-heading">
              <IconX size={16} />
            </button>
          </div>
        )}

        {/* Tab rows */}
        <div className="divide-y divide-border">
          {tabs.filter(t => t.is_visible).map((tab, idx) => (
            <TabRow
              key={tab.tab_key}
              tab={tab}
              idx={idx}
              isEditing={editingKey === tab.tab_key}
              editLabel={editLabel}
              onEditLabelChange={setEditLabel}
              onStartEdit={() => startEdit(tab)}
              onCommitEdit={commitEdit}
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

      {/* Hidden tabs */}
      {hidden.length > 0 && (
        <div className="bg-card border border-border rounded-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-page">
            <h2 className="text-sm font-semibold text-muted">Hidden Tabs ({hidden.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {hidden.map((tab, idx) => (
              <TabRow
                key={tab.tab_key}
                tab={tab}
                idx={idx}
                isEditing={editingKey === tab.tab_key}
                editLabel={editLabel}
                onEditLabelChange={setEditLabel}
                onStartEdit={() => startEdit(tab)}
                onCommitEdit={commitEdit}
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

      {/* Info box */}
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
      {/* Drag handle */}
      <IconGripVertical
        size={14}
        className={tab.is_locked ? 'text-transparent' : 'text-muted'}
      />

      {/* Lock icon */}
      {tab.is_locked && (
        <IconLock size={13} className="text-muted shrink-0" />
      )}

      {/* Custom badge */}
      {tab.tab_type === 'custom' && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium shrink-0">
          Custom
        </span>
      )}

      {/* Label / edit */}
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
          <button onClick={onCommitEdit} className="text-emerald-600 hover:text-emerald-700">
            <IconCheck size={15} />
          </button>
          <button onClick={onCancelEdit} className="text-muted hover:text-heading">
            <IconX size={15} />
          </button>
        </div>
      ) : (
        <span className={`flex-1 text-sm ${tab.is_visible ? 'text-heading' : 'text-muted'}`}>
          {tab.label}
        </span>
      )}

      {/* Actions */}
      {!isEditing && (
        <div className="flex items-center gap-2 shrink-0">
          {!tab.is_locked && (
            <button
              onClick={onStartEdit}
              title="Rename"
              className="text-muted hover:text-heading transition-colors"
            >
              <IconPencil size={14} />
            </button>
          )}
          {!tab.is_locked && (
            <button
              onClick={onToggleVisible}
              title={tab.is_visible ? 'Hide tab' : 'Show tab'}
              className="text-muted hover:text-heading transition-colors"
            >
              {tab.is_visible
                ? <IconEye size={14} />
                : <IconEyeOff size={14} className="text-slate-300" />
              }
            </button>
          )}
          {tab.tab_type === 'custom' && (
            <button
              onClick={onRemove}
              title="Remove custom tab"
              className="text-muted hover:text-red-500 transition-colors"
            >
              <IconX size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
