import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowDown, IconArrowUp, IconLoader2, IconLock } from '@tabler/icons-react'
import { format, subDays } from 'date-fns'
import api from '@/lib/api'

const STATUS = {
  not_started:     { label: 'Not started',      cls: 'bg-slate-100 text-slate-600 border-slate-200', rank: 0 },
  in_progress:     { label: 'Visit in progress', cls: 'bg-blue-50 text-blue-700 border-blue-200', rank: 1 },
  ready_to_submit: { label: 'Ready to submit',  cls: 'bg-amber-50 text-amber-700 border-amber-200', rank: 2 },
  reopened:        { label: 'Reopened',         cls: 'bg-orange-50 text-orange-700 border-orange-200', rank: 3 },
  submitted:       { label: 'Submitted',        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', rank: 4 },
}
const FILTERS = [['open', 'Not finished'], ['submitted', 'Submitted'], ['all', 'All statuses']]
const iso = (d) => format(d, 'yyyy-MM-dd')

export default function NoteBoard({ clientId = null, showClient = true }) {
  const navigate = useNavigate()
  const [from, setFrom] = useState(iso(subDays(new Date(), 30)))
  const [to, setTo] = useState(iso(new Date()))
  const [seeAll, setSeeAll] = useState(false)
  const [filter, setFilter] = useState('open')
  const [cm, setCm] = useState('')
  const [rows, setRows] = useState([])
  const [reviewer, setReviewer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState({ key: 'service_at', dir: 'desc' })

  useEffect(() => {
    setLoading(true)
    const params = { see_all: seeAll }
    if (!seeAll) { params.date_from = from; params.date_to = to }
    if (clientId) params.client_id = clientId
    api.get('/notes/board', { params })
      .then((r) => { setRows(r.data.notes); setReviewer(r.data.can_see_all_staff) })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [from, to, seeAll, clientId])

  const preset = (days) => { setSeeAll(false); setFrom(iso(subDays(new Date(), days))); setTo(iso(new Date())) }
  const cms = useMemo(() => [...new Map(rows.map((r) => [r.cm_id, `${r.cm_last_name}, ${r.cm_first_name}`])).entries()], [rows])

  const shown = useMemo(() => {
    let list = rows
    if (filter === 'open') list = list.filter((r) => r.board_status !== 'submitted')
    if (filter === 'submitted') list = list.filter((r) => r.board_status === 'submitted')
    if (cm) list = list.filter((r) => r.cm_id === cm)
    const val = {
      client: (r) => `${r.client_last_name} ${r.client_first_name}`.toLowerCase(),
      cm: (r) => `${r.cm_last_name} ${r.cm_first_name}`.toLowerCase(),
      service_at: (r) => r.service_at || '',
      status: (r) => STATUS[r.board_status].rank,
      sections: (r) => r.sections_done / r.sections_required,
      due: (r) => r.submit_due_at || '9999',
    }[sort.key]
    const m = sort.dir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => (val(a) > val(b) ? m : val(a) < val(b) ? -m : 0))
  }, [rows, filter, cm, sort])

  const th = (key, label, hide) => (
    <th className={`text-left font-medium px-3 py-2 ${hide ? 'hidden md:table-cell' : ''}`}>
      <button type="button" className="inline-flex items-center gap-1"
        onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))}>
        {label}
        {sort.key === key && (sort.dir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />)}
      </button>
    </th>
  )

  const counts = useMemo(() => {
    const c = {}
    rows.forEach((r) => { c[r.board_status] = (c[r.board_status] || 0) + 1 })
    return c
  }, [rows])

  return (
    <div className="space-y-3">
      <div className="bg-white border border-border rounded-xl p-3 flex flex-wrap items-end gap-3 text-sm">
        <label>From<input type="date" disabled={seeAll} value={from} onChange={(e) => setFrom(e.target.value)} className="block border border-border rounded-lg px-2 py-1.5 disabled:bg-slate-50" /></label>
        <label>To<input type="date" disabled={seeAll} value={to} onChange={(e) => setTo(e.target.value)} className="block border border-border rounded-lg px-2 py-1.5 disabled:bg-slate-50" /></label>
        {[['Today', 0], ['7 days', 7], ['30 days', 30], ['90 days', 90]].map(([l, d]) => (
          <button key={l} type="button" onClick={() => preset(d)} className="px-2.5 py-1.5 rounded-lg border border-border hover:bg-slate-50">{l}</button>
        ))}
        <button type="button" onClick={() => setSeeAll(!seeAll)}
          className={`px-2.5 py-1.5 rounded-lg border ${seeAll ? 'bg-primary text-white border-primary' : 'border-border hover:bg-slate-50'}`}>See all</button>
        {reviewer && !clientId && (
          <label>Case manager
            <select value={cm} onChange={(e) => setCm(e.target.value)} className="block border border-border rounded-lg px-2 py-1.5">
              <option value="">Everyone</option>
              {cms.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-lg border text-sm ${filter === k ? 'bg-navy text-white border-navy' : 'border-border bg-white'}`}>{l}</button>
        ))}
        <span className="text-xs text-muted ml-1">
          {Object.entries(STATUS).filter(([k]) => counts[k]).map(([k, s]) => `${counts[k]} ${s.label.toLowerCase()}`).join('  ·  ')}
        </span>
      </div>

      {loading ? <div className="flex justify-center p-8"><IconLoader2 className="animate-spin" /></div> : (
        <div className="bg-white border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-muted text-xs">
              <tr>
                {showClient && th('client', 'Client')}
                {reviewer && th('cm', 'Case manager', true)}
                {th('service_at', 'Visit date')}
                {th('status', 'Status')}
                {th('sections', 'Required sections', true)}
                {th('due', 'Submit by', true)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((r) => {
                const st = STATUS[r.board_status]
                const pct = Math.round((r.sections_done / r.sections_required) * 100)
                return (
                  <tr key={r.id} onClick={() => navigate(`/notes/${r.id}`)} className="cursor-pointer hover:bg-slate-50">
                    {showClient && <td className="px-3 py-2 font-medium text-heading">{r.client_last_name}, {r.client_first_name}</td>}
                    {reviewer && <td className="px-3 py-2 hidden md:table-cell">{r.cm_last_name}, {r.cm_first_name}</td>}
                    <td className="px-3 py-2 whitespace-nowrap">{r.service_at ? new Date(r.service_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${st.cls}`}>
                        {r.board_status === 'submitted' && <IconLock size={12} />}{st.label}
                      </span>
                      {r.overdue && <span className="ml-2 text-xs font-medium text-danger">Overdue</span>}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 rounded bg-slate-100 overflow-hidden"><div className={`h-full ${pct === 100 ? 'bg-green' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} /></div>
                        <span className="text-xs text-muted">{r.sections_done}/{r.sections_required}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell whitespace-nowrap text-xs">{r.submit_due_at && r.board_status !== 'submitted' ? new Date(r.submit_due_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''}</td>
                  </tr>
                )
              })}
              {shown.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted">No notes match. Widen the date range or choose See all.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
