import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { IconPlus, IconLoader2, IconLock } from '@tabler/icons-react'
import api from '@/lib/api'
import { errText, inputCls } from './notes/ui'

export default function ProgressNotes() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [picking, setPicking] = useState(false)
  const [q, setQ] = useState('')
  const [clients, setClients] = useState([])

  useEffect(() => {
    api.get('/notes/mine').then((r) => setNotes(r.data.notes)).catch(() => setNotes([])).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!picking) return
    const t = setTimeout(() => {
      api.get('/clients', { params: { pt_status: 'active', per_page: 20, ...(q.trim() ? { q: q.trim() } : {}) } })
        .then((r) => setClients(r.data.clients)).catch(() => setClients([]))
    }, 250)
    return () => clearTimeout(t)
  }, [picking, q])

  const start = async (clientId) => {
    try {
      const r = await api.post('/notes/start', { client_id: clientId })
      navigate(`/notes/${r.data.note_id}`)
    } catch (e) { toast.error(errText(e)) }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-heading">Progress Notes</h1>
        <button onClick={() => setPicking((p) => !p)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-white text-sm"><IconPlus size={16} />New note</button>
      </div>

      {picking && (
        <div className="bg-white border border-border rounded-xl p-4 space-y-3">
          <input autoFocus className={inputCls} placeholder="Find a client" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="divide-y divide-border">
            {clients.map((c) => (
              <li key={c.id}>
                <button onClick={() => start(c.id)} className="w-full text-left py-2 px-1 text-sm hover:bg-slate-50">
                  {c.last_name}, {c.first_name}
                </button>
              </li>
            ))}
            {clients.length === 0 && <li className="py-2 text-sm text-muted">No matching clients.</li>}
          </ul>
        </div>
      )}

      {loading ? <div className="flex justify-center p-8"><IconLoader2 className="animate-spin" /></div> : (
        <div className="bg-white border border-border rounded-xl divide-y divide-border">
          {notes.map((n) => (
            <button key={n.id} onClick={() => navigate(`/notes/${n.id}`)} className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50">
              <div>
                <div className="text-sm font-medium text-heading">{n.last_name}, {n.first_name}</div>
                <div className="text-xs text-muted">{n.hipaa_signed_at ? new Date(n.hipaa_signed_at).toLocaleString() : 'Not started'}</div>
              </div>
              <span className="text-xs inline-flex items-center gap-1 text-muted">
                {n.lock_state === 'locked' && <IconLock size={14} />}{n.lock_state}
              </span>
            </button>
          ))}
          {notes.length === 0 && <p className="p-4 text-sm text-muted">No notes yet. Choose New note to begin.</p>}
        </div>
      )}
    </div>
  )
}
