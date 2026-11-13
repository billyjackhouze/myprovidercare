import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { IconPlus } from '@tabler/icons-react'
import api from '@/lib/api'
import useAuthStore from '@/store/auth'
import { errText, inputCls } from './notes/ui'
import NoteBoard from './notes/NoteBoard'

const REVIEWERS = ['team_lead', 'supervisor', 'owner', 'admin', 'developer', 'auditor']

export default function ProgressNotes() {
  const navigate = useNavigate()
  const me = useAuthStore((s) => s.user)
  const [picking, setPicking] = useState(false)
  const [q, setQ] = useState('')
  const [clients, setClients] = useState([])

  useEffect(() => {
    if (!picking) return
    const t = setTimeout(() => {
      api.get('/clients', { params: { pt_status: 'active', per_page: 100, ...(q.trim() ? { q: q.trim() } : {}) } })
        .then((r) => {
          const all = r.data.clients
          setClients(REVIEWERS.includes(me?.role) ? all : all.filter((c) => c.assigned_cm_id === me?.id))
        })
        .catch(() => setClients([]))
    }, 250)
    return () => clearTimeout(t)
  }, [picking, q, me])

  const start = async (clientId) => {
    try {
      const r = await api.post('/notes/start', { client_id: clientId })
      navigate(`/notes/${r.data.note_id}`)
    } catch (e) { toast.error(errText(e)) }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-heading">Progress Notes</h1>
          <p className="text-sm text-muted">Status board. Open any row to keep working on the note.</p>
        </div>
        <button onClick={() => setPicking((p) => !p)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-white text-sm"><IconPlus size={16} />New note</button>
      </div>

      {picking && (
        <div className="bg-white border border-border rounded-xl p-4 space-y-3">
          <input autoFocus className={inputCls} placeholder="Find one of your assigned clients" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="divide-y divide-border max-h-64 overflow-y-auto">
            {clients.map((c) => (
              <li key={c.id}>
                <button onClick={() => start(c.id)} className="w-full text-left py-2 px-1 text-sm hover:bg-slate-50">{c.display_name || c.full_name}</button>
              </li>
            ))}
            {clients.length === 0 && <li className="py-2 text-sm text-muted">No matching assigned clients.</li>}
          </ul>
        </div>
      )}

      <NoteBoard />
    </div>
  )
}
