import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconUsers, IconClipboardCheck, IconAlertTriangle, IconFileDescription,
  IconReceipt2, IconArrowRight,
} from '@tabler/icons-react'
import api from '@/lib/api'
import useAuthStore from '@/store/auth'

const STAT_CARDS = [
  { key: 'active_clients',  label: 'Active Clients',     color: '#3B82F6', icon: IconUsers },
  { key: 'visits_today',    label: 'Visits Today',       color: '#10B981', icon: IconClipboardCheck },
  { key: 'pending_notes',   label: 'Pending Notes',      color: '#F59E0B', icon: IconFileDescription },
  { key: 'flagged_visits',  label: 'Flagged Visits',     color: '#EF4444', icon: IconAlertTriangle },
  { key: 'pending_claims',  label: 'Pending Claims',     color: '#F97316', icon: IconReceipt2 },
  { key: 'forms_count',     label: 'Forms in System',    color: '#0D9488', icon: IconFileDescription },
]

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const [stats, setStats] = useState({})

  useEffect(() => {
    api.get('/dashboard/stats').then((r) => setStats(r.data)).catch(() => {})
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-medium text-heading">
          {greeting}{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-muted text-sm mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {STAT_CARDS.map(({ key, label, color, icon: Icon }) => (
          <div
            key={key}
            className="stat-card"
            style={{ borderTopColor: color }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="stat-label">{label}</span>
              <Icon size={14} color={color} strokeWidth={1.5} />
            </div>
            <div className="stat-number">{stats[key] ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-card rounded-card border border-border p-4">
          <h2 className="text-sm font-medium text-heading mb-3">Forms Engine</h2>
          <p className="text-muted text-xs mb-3">
            Upload a paper form screenshot or PDF and let Claude AI extract all fields automatically.
          </p>
          <Link to="/forms/ingest" className="btn-primary inline-flex items-center gap-1.5 text-xs">
            Ingest New Form
            <IconArrowRight size={14} />
          </Link>
        </div>

        <div className="bg-card rounded-card border border-border p-4">
          <h2 className="text-sm font-medium text-heading mb-3">Getting Started</h2>
          <ul className="text-muted text-xs space-y-1.5">
            <li className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-page border border-border flex items-center justify-center text-xs font-bold text-heading">1</span>
              Upload your existing paper forms
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-page border border-border flex items-center justify-center text-xs font-bold text-heading">2</span>
              Review AI-extracted fields
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-page border border-border flex items-center justify-center text-xs font-bold text-heading">3</span>
              Import clients from FileMaker
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-page border border-border flex items-center justify-center text-xs font-bold text-heading">4</span>
              Configure geofences & schedules
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
