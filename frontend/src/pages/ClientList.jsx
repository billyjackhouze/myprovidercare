import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconPlus, IconSearch, IconLoader2, IconUsers,
  IconAlertTriangle, IconChevronRight, IconFilter,
} from '@tabler/icons-react'
import api from '@/lib/api'

const STATUS_OPTIONS = [
  { value: 'active',     label: 'Active',     color: '#10B981' },
  { value: 'inactive',   label: 'Inactive',   color: '#94A3B8' },
  { value: 'pending',    label: 'Pending',    color: '#F59E0B' },
  { value: 'on_hold',    label: 'On Hold',    color: '#F97316' },
  { value: 'discharged', label: 'Discharged', color: '#64748B' },
  { value: 'all',        label: 'All',        color: '#2563EB' },
]

const STATUS_STYLE = {
  active:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive:   'bg-slate-100 text-slate-500 border-slate-200',
  pending:    'bg-amber-50 text-amber-700 border-amber-200',
  on_hold:    'bg-orange-50 text-orange-700 border-orange-200',
  discharged: 'bg-slate-100 text-slate-500 border-slate-200',
}

function StatusBadge({ status }) {
  const cls = STATUS_STYLE[status] || 'bg-slate-100 text-slate-500 border-slate-200'
  const label = STATUS_OPTIONS.find(s => s.value === status)?.label || status
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {label}
    </span>
  )
}

export default function ClientList() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [ptStatus, setPtStatus] = useState('active')
  const [page, setPage] = useState(1)
  const PER_PAGE = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { pt_status: ptStatus, page, per_page: PER_PAGE }
      if (search.trim()) params.q = search.trim()
      const r = await api.get('/clients', { params })
      setClients(r.data.clients)
      setTotal(r.data.total)
    } catch {
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [search, ptStatus, page])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  // Reset to page 1 when filter/search changes
  useEffect(() => { setPage(1) }, [search, ptStatus])

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-medium text-heading">Clients</h1>
          <p className="text-muted text-sm mt-0.5">
            {total > 0 ? `${total} client${total !== 1 ? 's' : ''}` : 'No clients found'}
          </p>
        </div>
        <button
          onClick={() => navigate('/clients/new')}
          className="btn-primary flex items-center gap-1.5 text-sm"
        >
          <IconPlus size={16} />
          New Client
        </button>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-card p-3 mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <IconSearch size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search name, Medicaid ID, phone, chart ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="field-input pl-8"
          />
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-page rounded-card p-1">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s.value}
              onClick={() => setPtStatus(s.value)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                ptStatus === s.value
                  ? 'bg-white text-heading shadow-sm border border-border'
                  : 'text-muted hover:text-heading'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-muted py-16">
            <IconLoader2 size={18} className="animate-spin" />
            <span>Loading clients…</span>
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <IconUsers size={40} className="text-muted mb-3" strokeWidth={1} />
            <h3 className="text-heading font-medium mb-1">No clients found</h3>
            <p className="text-muted text-sm mb-4">
              {search ? 'Try a different search term.' : 'Add your first client to get started.'}
            </p>
            {!search && (
              <button
                onClick={() => navigate('/clients/new')}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                <IconPlus size={15} />
                New Client
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-page">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted uppercase tracking-wider">Medicaid ID</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted uppercase tracking-wider">Chart ID</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted uppercase tracking-wider">DOB</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted uppercase tracking-wider">Phone</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted uppercase tracking-wider">Last Visit</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map(c => (
                <tr
                  key={c.id}
                  className="hover:bg-page cursor-pointer transition-colors"
                  onClick={() => navigate(`/clients/${c.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.photo_s3_key ? (
                        <img
                          src={`/api/clients/${c.id}/photo`}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-primary text-xs font-semibold">
                            {c.first_name?.[0]}{c.last_name?.[0]}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-heading">{c.display_name}</div>
                        {c.hit_list && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-red-600">
                            <IconAlertTriangle size={11} /> HIT List
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{c.medicaid_id || '—'}</td>
                  <td className="px-4 py-3 text-muted">{c.chart_id || '—'}</td>
                  <td className="px-4 py-3 text-muted">{c.date_of_birth || '—'}</td>
                  <td className="px-4 py-3 text-muted">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-muted">{c.last_visit_date || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.pt_status} />
                  </td>
                  <td className="px-4 py-3">
                    <IconChevronRight size={14} className="text-muted" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted">
          <span>
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
