import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { MED_FIELDS, SCREENINGS } from './sections'
import { inputCls, errText } from './ui'
import toast from 'react-hot-toast'

export function Medications({ noteId, rows, disabled, onTouched }) {
  const [list, setList] = useState(() => Array.from({ length: 7 }, (_, i) => rows.find((r) => r.row_no === i + 1) || { row_no: i + 1 }))
  useEffect(() => {
    setList(Array.from({ length: 7 }, (_, i) => rows.find((r) => r.row_no === i + 1) || { row_no: i + 1 }))
  }, [rows])

  const edit = (i, k, v) => setList((l) => l.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const save = async (i) => {
    const r = list[i]
    const body = {}
    MED_FIELDS.forEach(([k]) => { body[k] = r[k] ? r[k] : null })
    try { await api.put(`/notes/${noteId}/pn2/medications/${r.row_no}`, body); onTouched() }
    catch (e) { toast.error(errText(e)) }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Up to seven medications reviewed at this visit. This list is a snapshot kept with the note.</p>
      {list.map((r, i) => (
        <div key={r.row_no} className="rounded-lg border border-border p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-3 text-xs font-semibold text-muted">Medication {r.row_no}</div>
          {MED_FIELDS.map(([k, l]) => (
            <label key={k} className="text-xs">
              <span className="block mb-1">{l}</span>
              <input className={inputCls} disabled={disabled} value={r[k] ?? ''}
                onChange={(e) => edit(i, k, e.target.value)} onBlur={() => save(i)} />
            </label>
          ))}
        </div>
      ))}
    </div>
  )
}

function Tri({ value, onChange, disabled }) {
  const opt = [['Yes', true], ['No', false]]
  return (
    <div className="flex gap-1">
      {opt.map(([l, v]) => (
        <button key={l} type="button" disabled={disabled} onClick={() => onChange(value === v ? null : v)}
          className={`px-3 py-1 rounded border text-xs ${value === v ? 'bg-primary text-white border-primary' : 'border-border'}`}>{l}</button>
      ))}
    </div>
  )
}

function ScreeningForm({ noteId, kind, disabled, onTouched }) {
  const def = SCREENINGS[kind]
  const [row, setRow] = useState({})
  useEffect(() => {
    api.get(`/notes/${noteId}/screenings/${kind}`).then((r) => setRow(r.data || {})).catch(() => setRow({}))
  }, [noteId, kind])

  const put = async (fields) => {
    try { const r = await api.put(`/notes/${noteId}/screenings/${kind}`, fields); setRow(r.data); onTouched() }
    catch (e) { toast.error(errText(e)) }
  }
  const pickSingle = (group, key) => {
    const f = {}
    group.items.forEach((it) => { f[it.key] = it.key === key ? !row[it.key] : false })
    put(f)
  }
  const result = [
    row.total_score != null && `Score ${row.total_score}`,
    row.risk_band && `Risk ${row.risk_band}`,
    row.severity && `Severity ${row.severity}`,
    row.q9_positive && 'Question 9 positive: follow the safety protocol',
    row.any_yes && 'At least one yes answer',
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      {def.scale && (
        <>
          {def.scale.map(([k, l]) => (
            <div key={k} className="rounded-lg border border-border p-3">
              <div className="text-sm mb-2">{l}</div>
              <div className="flex flex-wrap gap-1">
                {def.options.map((o, n) => (
                  <button key={n} type="button" disabled={disabled} onClick={() => put({ [k]: n })}
                    className={`px-3 py-1.5 rounded border text-xs ${row[k] === n ? 'bg-primary text-white border-primary' : 'border-border'}`}>{n} {o}</button>
                ))}
              </div>
            </div>
          ))}
          <label className="block text-sm">
            <span className="block mb-1 font-medium">How difficult have these made things?</span>
            <select className={inputCls} disabled={disabled} value={row.difficulty ?? ''} onChange={(e) => put({ difficulty: e.target.value || null })}>
              <option value="">Choose</option>
              {def.difficulty.map((d) => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
            </select>
          </label>
        </>
      )}
      {def.groups?.map((g) => (
        <div key={g.label} className="rounded-lg border border-border p-3">
          <div className="text-xs font-semibold text-muted mb-1">{g.label}{g.single ? ' (choose one)' : ''}</div>
          {g.items.map((it) => (
            g.tri ? (
              <div key={it.key} className="flex items-center justify-between py-1.5 text-sm gap-3">
                <span>{it.label}</span>
                <Tri value={row[it.key]} disabled={disabled} onChange={(v) => put({ [it.key]: v })} />
              </div>
            ) : (
              <label key={it.key} className="flex items-center gap-3 py-1.5 text-sm cursor-pointer">
                <input type="checkbox" className="h-5 w-5" disabled={disabled} checked={!!row[it.key]}
                  onChange={() => (g.single ? pickSingle(g, it.key) : put({ [it.key]: !row[it.key] }))} />
                {it.label}
              </label>
            )
          ))}
        </div>
      ))}
      {result.length > 0 && (
        <div className="rounded-lg bg-slate-50 border border-border p-3 text-sm font-medium">{result.join('  ·  ')}</div>
      )}
    </div>
  )
}

export function Screenings({ noteId, disabled, onTouched }) {
  const [kind, setKind] = useState('fall_risk')
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {Object.entries(SCREENINGS).map(([k, d]) => (
          <button key={k} type="button" onClick={() => setKind(k)}
            className={`px-3 py-1.5 rounded-lg border text-sm ${kind === k ? 'bg-navy text-white border-navy' : 'border-border'}`}>{d.title}</button>
        ))}
      </div>
      <ScreeningForm key={kind} noteId={noteId} kind={kind} disabled={disabled} onTouched={onTouched} />
      <p className="text-xs text-muted">Totals and risk bands are worked out by the database, not typed.</p>
    </div>
  )
}
