import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { IconCheck, IconCircleX, IconChevronLeft, IconChevronRight, IconLoader2, IconLock } from '@tabler/icons-react'
import api from '@/lib/api'
import useAuthStore from '@/store/auth'
import { PN2_SECTIONS, sectionState } from './notes/sections'
import { Field, errText, inputCls } from './notes/ui'
import { SignaturePad, CameraCapture, buildCapture } from './notes/Capture'
import { Medications, Screenings } from './notes/Special'

const REVIEWERS = ['team_lead', 'supervisor', 'owner', 'admin', 'developer', 'auditor']
const ALL = [{ id: 'visit', title: 'Visit clock', special: 'clock' }, ...PN2_SECTIONS, { id: 'review', title: 'Review and submit', special: 'review' }]

const fmt = (t) => (t ? new Date(t).toLocaleString() : '')

export default function ProgressNote() {
  const { noteId } = useParams()
  const navigate = useNavigate()
  const me = useAuthStore((s) => s.user)
  const [note, setNote] = useState(null)
  const [data, setData] = useState({})
  const [meds, setMeds] = useState([])
  const [idx, setIdx] = useState(0)
  const [touched, setTouched] = useState({})
  const [saving, setSaving] = useState('')
  const [mode, setMode] = useState(null) // 'sign' | 'camera' | null
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')
  const dirty = useRef({})
  const timer = useRef(null)

  const loadNote = useCallback(async () => {
    const r = await api.get(`/notes/${noteId}`)
    setNote(r.data)
  }, [noteId])

  useEffect(() => {
    (async () => {
      try {
        await loadNote()
        const r = await api.get(`/notes/${noteId}/pn2`)
        setData(r.data.pn2 || {})
        setMeds(r.data.medications || [])
      } catch (e) { toast.error(errText(e)); navigate('/notes') }
    })()
  }, [noteId, loadNote, navigate])

  const locked = note?.lock_state === 'locked'
  const mine = note && me && note.cm_id === me.id
  const readOnly = !note || locked || !mine

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const keys = Object.keys(dirty.current)
    if (!keys.length) return true
    const body = { ...dirty.current }
    dirty.current = {}
    setSaving('Saving')
    try { await api.put(`/notes/${noteId}/pn2`, body); setSaving('Saved'); return true }
    catch (e) { dirty.current = { ...body, ...dirty.current }; setSaving('Not saved'); toast.error(errText(e)); return false }
  }, [noteId])

  const sec = ALL[idx]
  const touch = (id) => setTouched((t) => (t[id] ? t : { ...t, [id]: true }))

  const set = (key, val) => {
    if (readOnly) return
    const v = val === '' ? null : val
    const patch = { [key]: v }
    if (key === 'late_entry' && !val) patch.late_entry_date = null
    setData((d) => ({ ...d, ...patch }))
    Object.assign(dirty.current, patch)
    touch(sec.id)
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 1200)
  }

  const go = async (n) => {
    await flush()
    setIdx(Math.max(0, Math.min(ALL.length - 1, n)))
    window.scrollTo?.({ top: 0 })
  }

  const run = async (fn) => {
    setBusy(true)
    try { await fn() } catch (e) { toast.error(errText(e)) } finally { setBusy(false) }
  }

  const startClock = (signature) => run(async () => {
    const cap = await buildCapture()
    await api.post(`/notes/visits/${note.visit_id}/clock/start`, cap)
    setMode(null); await loadNote(); toast.success('Visit started')
  })

  const stopClock = ({ hash }) => run(async () => {
    const cap = await buildCapture()
    await api.post(`/notes/visits/${note.visit_id}/clock/stop`, { ...cap, photo_hash: hash, camera_only: true })
    setMode(null); await loadNote(); toast.success('Contact ended')
  })

  const submit = () => run(async () => {
    if (!(await flush())) return
    const cap = await buildCapture()
    await api.post(`/notes/${noteId}/submit`, cap)
    await loadNote(); toast.success('Note submitted and locked')
  })

  const reopen = () => run(async () => {
    await api.post(`/notes/${noteId}/reopen`, { reason })
    setReason(''); await loadNote(); toast.success('Note reopened')
  })

  if (!note) return <div className="p-8 flex justify-center"><IconLoader2 className="animate-spin" /></div>

  const clockState = !note.hipaa_signed_at ? 'todo' : !note.photo_taken_at ? 'open' : 'done'
  const stateOf = (s) => {
    if (s.special === 'clock') return clockState === 'done' ? 'done' : 'todo'
    if (s.special === 'review') return locked ? 'done' : 'todo'
    return sectionState(s, data, touched[s.id])
  }
  const incomplete = ALL.filter((s) => s.special !== 'review' && stateOf(s) !== 'done')

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-heading">Progress note: {note.client_first_name} {note.client_last_name}</h1>
          <p className="text-sm text-muted">
            {locked ? 'Locked' : note.lock_state === 'reopened' ? 'Reopened' : 'Draft'}
            {saving && !locked ? `  ·  ${saving}` : ''}
          </p>
        </div>
        {locked && <span className="inline-flex items-center gap-1 text-sm text-muted"><IconLock size={16} /> Locked</span>}
      </div>

      {!mine && <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3">You are viewing another user's note. It is read-only.</div>}

      <div className="flex flex-col md:flex-row gap-4">
        <nav className="md:w-64 shrink-0 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
          {ALL.map((s, i) => {
            const st = stateOf(s)
            return (
              <button key={s.id} type="button" onClick={() => go(i)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left whitespace-nowrap border ${i === idx ? 'border-primary bg-blue-50' : 'border-transparent hover:bg-slate-50'}`}>
                {st === 'done'
                  ? <IconCheck size={16} className="text-green shrink-0" />
                  : <IconCircleX size={16} className="text-danger shrink-0" />}
                <span>{s.title}</span>
              </button>
            )
          })}
        </nav>

        <section className="flex-1 bg-white border border-border rounded-xl p-4 md:p-6">
          <h2 className="text-lg font-semibold text-heading mb-1">{sec.title}</h2>
          {sec.hint && <p className="text-sm text-muted mb-3">{sec.hint}</p>}

          {sec.special === 'clock' && (
            <div className="space-y-4 mt-3">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted">Started</dt><dd>{fmt(note.hipaa_signed_at) || 'Not started'}</dd></div>
                <div><dt className="text-muted">Ended</dt><dd>{fmt(note.photo_taken_at) || 'Not ended'}</dd></div>
                {note.credited_minutes != null && <div><dt className="text-muted">Credited minutes</dt><dd>{note.credited_minutes}</dd></div>}
                {note.submit_due_at && <div><dt className="text-muted">Submit by</dt><dd>{fmt(note.submit_due_at)}</dd></div>}
              </dl>
              {mode === 'sign' && <SignaturePad title="Client signs the HIPAA acknowledgment to start the visit" onDone={startClock} onCancel={() => setMode(null)} />}
              {mode === 'camera' && <CameraCapture onDone={stopClock} onCancel={() => setMode(null)} />}
              {!mode && !readOnly && clockState === 'todo' && (
                <button disabled={busy} onClick={() => setMode('sign')} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">Start visit (HIPAA signature)</button>)}
              {!mode && !readOnly && clockState === 'open' && (
                <button disabled={busy} onClick={() => setMode('camera')} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">End contact (camera)</button>)}
              <p className="text-xs text-muted">Times come from the server clock, not this device.</p>
            </div>
          )}

          {sec.fields && (
            <div className={`mt-3 grid gap-3 ${sec.fields.every((f) => f.type === 'bool') ? 'sm:grid-cols-2' : 'sm:grid-cols-2'}`}>
              {sec.fields.map((f) => (
                <div key={f.key} className={f.type === 'area' ? 'sm:col-span-2' : ''}>
                  <Field def={f} value={data[f.key]} onChange={set} disabled={readOnly} />
                </div>
              ))}
            </div>
          )}

          {sec.special === 'meds' && (
            <div className="mt-3 space-y-3">
              <Field def={{ key: 'meds_not_reviewed', label: 'Medications not reviewed at this visit', type: 'bool' }}
                value={data.meds_not_reviewed} onChange={set} disabled={readOnly} />
              <Medications noteId={noteId} rows={meds} disabled={readOnly} onTouched={() => touch('meds')} />
            </div>
          )}

          {sec.special === 'screenings' && (
            <div className="mt-3"><Screenings noteId={noteId} disabled={readOnly} onTouched={() => touch('screenings')} /></div>
          )}

          {sec.special === 'review' && (
            <div className="space-y-4 mt-3">
              {incomplete.length > 0 ? (
                <div className="text-sm">
                  <p className="font-medium text-danger mb-1">Still to complete:</p>
                  <ul className="list-disc ml-5">{incomplete.map((s) => <li key={s.id}><button className="underline" onClick={() => go(ALL.indexOf(s))}>{s.title}</button></li>)}</ul>
                </div>
              ) : <p className="text-sm text-green font-medium">Every section is complete.</p>}

              {!locked && mine && (
                <div>
                  <button disabled={busy || clockState !== 'done'} onClick={submit}
                    className="px-4 py-2 rounded-lg bg-navy text-white text-sm disabled:opacity-40">Sign and submit (locks the note)</button>
                  {clockState !== 'done' && <p className="text-xs text-danger mt-1">End the contact before you submit.</p>}
                  <p className="text-xs text-muted mt-1">After you submit, the whole note locks. Only a team lead or above can reopen it.</p>
                </div>
              )}
              {locked && mine && <p className="text-sm text-muted">Submitted. To correct a locked note, a team lead reopens it or a signed addendum is added.</p>}
              {locked && !mine && REVIEWERS.includes(me?.role) && me?.role !== undefined && (
                <div className="space-y-2">
                  <textarea className={inputCls} rows={2} placeholder="Reason for reopening" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button disabled={busy || reason.trim().length < 3} onClick={reopen} className="px-4 py-2 rounded-lg border border-border text-sm disabled:opacity-40">Reopen note</button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-border">
            <button disabled={idx === 0} onClick={() => go(idx - 1)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm disabled:opacity-30"><IconChevronLeft size={16} />Back</button>
            <button disabled={idx === ALL.length - 1} onClick={() => go(idx + 1)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-30">Next<IconChevronRight size={16} /></button>
          </div>
        </section>
      </div>
    </div>
  )
}
