import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { IconPlus } from '@tabler/icons-react'
import api from '@/lib/api'
import useAuthStore from '@/store/auth'
import { errText } from './ui'
import NoteBoard from './NoteBoard'

const REVIEWERS = ['team_lead', 'supervisor', 'owner', 'admin', 'developer', 'auditor']

// Progress Notes tab inside the client record: new note for this client, plus this client's notes.
export default function ClientNotesTab({ clientId, client }) {
  const navigate = useNavigate()
  const me = useAuthStore((s) => s.user)
  const [busy, setBusy] = useState(false)
  const assignedToMe = client?.assigned_cm_id === me?.id
  const allowed = assignedToMe || REVIEWERS.includes(me?.role)

  const start = async () => {
    setBusy(true)
    try {
      const r = await api.post('/notes/start', { client_id: clientId })
      navigate(`/notes/${r.data.note_id}`)
    } catch (e) { toast.error(errText(e)); setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {allowed ? 'Start a note for this client, or open an unfinished one below.' : 'This client is not assigned to you, so you cannot start a note.'}
        </p>
        <button disabled={!allowed || busy} onClick={start}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-40"><IconPlus size={16} />New progress note</button>
      </div>
      <NoteBoard clientId={clientId} showClient={false} />
    </div>
  )
}
