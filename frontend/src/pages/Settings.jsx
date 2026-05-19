/**
 * Settings — four-tab settings page for NationalCM.
 * Tabs: Organization | Users & Roles | Workflow & Forms | Security
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  IconBuilding, IconUsers, IconSettings2, IconShieldLock,
  IconLoader2, IconCheck, IconPlus, IconX, IconPencil,
  IconUserCheck, IconUserOff, IconChevronRight, IconSparkles,
  IconLock, IconKey,
} from '@tabler/icons-react'
import api from '@/lib/api'
import useAuthStore from '@/store/auth'

const TABS = [
  { key: 'org',      label: 'Organization',    Icon: IconBuilding },
  { key: 'users',    label: 'Users & Roles',   Icon: IconUsers },
  { key: 'workflow', label: 'Workflow & Forms', Icon: IconSettings2 },
  { key: 'security', label: 'Security',         Icon: IconShieldLock },
]

export default function Settings() {
  const [activeTab, setActiveTab] = useState('org')

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-heading">Settings</h1>
        <p className="text-muted text-sm mt-0.5">Manage your organization, users, and security preferences</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-page border border-border rounded-card p-1 w-fit">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-heading shadow-sm'
                : 'text-muted hover:text-heading'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'org'      && <OrgTab />}
      {activeTab === 'users'    && <UsersTab />}
      {activeTab === 'workflow' && <WorkflowTab />}
      {activeTab === 'security' && <SecurityTab />}
    </div>
  )
}

// ─── Tab 1: Organization ──────────────────────────────────────────────────────
function OrgTab() {
  const [form, setForm] = useState({
    name: '', phone: '', address_line1: '', address_line2: '',
    city: '', state: '', zip_code: '', npi: '', tax_id: '', medicaid_provider_id: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/settings/org')
      .then(r => setForm(f => ({ ...f, ...r.data })))
      .catch(() => toast.error('Failed to load organization settings'))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/settings/org', form)
      toast.success('Organization settings saved')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner text="Loading organization…" />

  return (
    <form onSubmit={handleSave}>
      <div className="bg-card border border-border rounded-card overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-border bg-page">
          <h2 className="text-sm font-semibold text-heading">Organization Details</h2>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="field-label">Organization Name</label>
            <input name="name" value={form.name} onChange={handleChange} className="field-input" placeholder="National Case Management Inc." />
          </div>
          <div>
            <label className="field-label">Phone</label>
            <input name="phone" value={form.phone || ''} onChange={handleChange} className="field-input" placeholder="(555) 000-0000" />
          </div>
          <div>
            <label className="field-label">NPI Number</label>
            <input name="npi" value={form.npi || ''} onChange={handleChange} className="field-input" placeholder="1234567890" />
          </div>
          <div className="col-span-2">
            <label className="field-label">Address Line 1</label>
            <input name="address_line1" value={form.address_line1 || ''} onChange={handleChange} className="field-input" placeholder="123 Main St" />
          </div>
          <div className="col-span-2">
            <label className="field-label">Address Line 2</label>
            <input name="address_line2" value={form.address_line2 || ''} onChange={handleChange} className="field-input" placeholder="Suite 100" />
          </div>
          <div>
            <label className="field-label">City</label>
            <input name="city" value={form.city || ''} onChange={handleChange} className="field-input" placeholder="New York" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">State</label>
              <input name="state" value={form.state || ''} onChange={handleChange} maxLength={2} className="field-input uppercase" placeholder="NY" />
            </div>
            <div>
              <label className="field-label">ZIP Code</label>
              <input name="zip_code" value={form.zip_code || ''} onChange={handleChange} className="field-input" placeholder="10001" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-card overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-border bg-page">
          <h2 className="text-sm font-semibold text-heading">Billing &amp; Provider IDs</h2>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Tax ID (EIN)</label>
            <input name="tax_id" value={form.tax_id || ''} onChange={handleChange} className="field-input" placeholder="XX-XXXXXXX" />
          </div>
          <div>
            <label className="field-label">Medicaid Provider ID</label>
            <input name="medicaid_provider_id" value={form.medicaid_provider_id || ''} onChange={handleChange} className="field-input" placeholder="Provider ID" />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <IconLoader2 size={15} className="animate-spin" /> : <IconCheck size={15} />}
          Save Changes
        </button>
      </div>
    </form>
  )
}

// ─── Tab 2: Users & Roles ─────────────────────────────────────────────────────
const ROLE_COLORS = {
  owner:        'bg-purple-100 text-purple-700',
  supervisor:   'bg-blue-100 text-blue-700',
  case_manager: 'bg-green-100 text-green-700',
  billing:      'bg-teal-100 text-teal-700',
  intake:       'bg-amber-100 text-amber-700',
  auditor:      'bg-gray-100 text-gray-600',
}

function UsersTab() {
  const currentUser = useAuthStore(s => s.user)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)

  // Invite form state
  const [invite, setInvite] = useState({ full_name: '', email: '', role: 'case_manager', temp_password: '' })
  const [inviting, setInviting] = useState(false)

  const load = () => {
    api.get('/settings/users')
      .then(r => setUsers(r.data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleRoleChange = async (userId, role) => {
    setUpdatingId(userId)
    try {
      await api.put(`/settings/users/${userId}/role`, { role })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
      toast.success('Role updated')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update role')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleToggleStatus = async (user) => {
    setUpdatingId(user.id)
    try {
      await api.put(`/settings/users/${user.id}/status`, { is_active: !user.is_active })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      toast.success(user.is_active ? 'User deactivated' : 'User activated')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviting(true)
    try {
      const res = await api.post('/settings/users/invite', invite)
      setUsers(prev => [...prev, { ...res.data, created_at: new Date().toISOString() }])
      setInvite({ full_name: '', email: '', role: 'case_manager', temp_password: '' })
      setShowInvite(false)
      toast.success(`${res.data.full_name} has been added`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to invite user')
    } finally {
      setInviting(false)
    }
  }

  if (loading) return <LoadingSpinner text="Loading users…" />

  return (
    <div>
      {/* Invite panel */}
      {showInvite && (
        <div className="bg-card border border-border rounded-card overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-border bg-page flex items-center justify-between">
            <h2 className="text-sm font-semibold text-heading flex items-center gap-1.5">
              <IconPlus size={14} /> Invite New User
            </h2>
            <button onClick={() => setShowInvite(false)} className="text-muted hover:text-heading">
              <IconX size={15} />
            </button>
          </div>
          <form onSubmit={handleInvite} className="p-5 grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Full Name</label>
              <input
                required
                value={invite.full_name}
                onChange={e => setInvite(f => ({ ...f, full_name: e.target.value }))}
                className="field-input"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="field-label">Email Address</label>
              <input
                required type="email"
                value={invite.email}
                onChange={e => setInvite(f => ({ ...f, email: e.target.value }))}
                className="field-input"
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <label className="field-label">Role</label>
              <select
                value={invite.role}
                onChange={e => setInvite(f => ({ ...f, role: e.target.value }))}
                className="field-input"
              >
                {Object.keys(ROLE_COLORS).map(r => (
                  <option key={r} value={r}>{r.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Temporary Password</label>
              <input
                required type="text"
                value={invite.temp_password}
                onChange={e => setInvite(f => ({ ...f, temp_password: e.target.value }))}
                className="field-input"
                placeholder="Min 8 characters"
                minLength={8}
              />
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowInvite(false)} className="btn-secondary text-sm">
                Cancel
              </button>
              <button type="submit" disabled={inviting} className="btn-primary text-sm flex items-center gap-1.5">
                {inviting ? <IconLoader2 size={14} className="animate-spin" /> : <IconPlus size={14} />}
                Add User
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div className="bg-card border border-border rounded-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-page flex items-center justify-between">
          <h2 className="text-sm font-semibold text-heading">Team Members ({users.length})</h2>
          {!showInvite && (
            <button onClick={() => setShowInvite(true)} className="btn-primary text-sm flex items-center gap-1.5">
              <IconPlus size={14} /> Invite User
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-page">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Name</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Email</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Role</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(user => {
                const isSelf = user.email === currentUser?.email
                const isUpdating = updatingId === user.id
                return (
                  <tr key={user.id} className={`${user.is_active ? 'bg-white' : 'bg-page opacity-60'}`}>
                    <td className="px-5 py-3 font-medium text-heading">
                      {user.full_name}
                      {isSelf && <span className="ml-2 text-xs text-muted">(you)</span>}
                    </td>
                    <td className="px-5 py-3 text-muted">{user.email}</td>
                    <td className="px-5 py-3">
                      {isSelf ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-600'}`}>
                          {user.role.replace('_', ' ')}
                        </span>
                      ) : (
                        <select
                          value={user.role}
                          onChange={e => handleRoleChange(user.id, e.target.value)}
                          disabled={isUpdating}
                          className={`text-xs font-medium px-2 py-0.5 rounded border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-600'}`}
                        >
                          {Object.keys(ROLE_COLORS).map(r => (
                            <option key={r} value={r}>{r.replace('_', ' ')}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {user.is_active
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Active</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />Inactive</span>
                      }
                    </td>
                    <td className="px-5 py-3 text-right">
                      {!isSelf && (
                        <button
                          onClick={() => handleToggleStatus(user)}
                          disabled={isUpdating}
                          title={user.is_active ? 'Deactivate user' : 'Activate user'}
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded border transition-colors disabled:opacity-40 ${
                            user.is_active
                              ? 'border-red-200 text-red-500 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {isUpdating
                            ? <IconLoader2 size={12} className="animate-spin" />
                            : user.is_active
                              ? <><IconUserOff size={12} /> Deactivate</>
                              : <><IconUserCheck size={12} /> Activate</>
                          }
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="text-center py-10 text-muted text-sm">No users found.</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab 3: Workflow & Forms ──────────────────────────────────────────────────
function WorkflowTab() {
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      {/* Tab Layout card */}
      <div className="bg-card border border-border rounded-card p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <IconSettings2 size={18} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-heading">Client Record Workflow</h3>
            <p className="text-xs text-muted mt-0.5 max-w-md">
              Configure which tabs appear on every client record, control their order and visibility,
              and add custom form tabs from the Forms Engine. Changes apply org-wide instantly.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/settings/workflow')}
          className="btn-primary text-sm flex items-center gap-1.5 shrink-0"
        >
          Open Workflow Settings
          <IconChevronRight size={14} />
        </button>
      </div>

      {/* Smart Fields card */}
      <div className="bg-card border border-border rounded-card p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <IconSparkles size={18} className="text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-heading">Smart Fields</h3>
            <p className="text-xs text-muted mt-0.5 max-w-md">
              Define plain-language rules that surface key data from any form — like "most recent auth
              expiration date" — as a Key Metrics panel on every client's General Info tab.
              Claude AI interprets your rules automatically.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/settings/workflow', { state: { section: 'smartfields' } })}
          className="btn-secondary text-sm flex items-center gap-1.5 shrink-0"
        >
          Manage Smart Fields
          <IconChevronRight size={14} />
        </button>
      </div>

      {/* Forms Engine card */}
      <div className="bg-card border border-border rounded-card p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <IconPlus size={18} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-heading">Forms Engine</h3>
            <p className="text-xs text-muted mt-0.5 max-w-md">
              Upload any paper form (PDF or photo) and Claude Vision will extract all fields automatically.
              Once ingested, forms become available to add as client record tabs.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/forms')}
          className="btn-secondary text-sm flex items-center gap-1.5 shrink-0"
        >
          Go to Forms
          <IconChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Tab 4: Security ──────────────────────────────────────────────────────────
function SecurityTab() {
  const user = useAuthStore(s => s.user)
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [saving, setSaving] = useState(false)

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.new_password !== form.confirm_password) {
      toast.error('New passwords do not match')
      return
    }
    if (form.new_password.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    setSaving(true)
    try {
      await api.put('/settings/me/password', {
        current_password: form.current_password,
        new_password: form.new_password,
      })
      toast.success('Password changed successfully')
      setForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Session info */}
      <div className="bg-card border border-border rounded-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-page">
          <h2 className="text-sm font-semibold text-heading flex items-center gap-1.5">
            <IconLock size={14} /> Current Session
          </h2>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="field-label mb-1">Logged in as</p>
            <p className="text-heading font-medium">{user?.full_name || user?.email || '—'}</p>
          </div>
          <div>
            <p className="field-label mb-1">Email</p>
            <p className="text-heading">{user?.email || '—'}</p>
          </div>
          <div>
            <p className="field-label mb-1">Role</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[user?.role] || 'bg-gray-100 text-gray-600'}`}>
              {user?.role?.replace('_', ' ') || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-card border border-border rounded-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-page">
          <h2 className="text-sm font-semibold text-heading flex items-center gap-1.5">
            <IconKey size={14} /> Change Password
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="field-label">Current Password</label>
            <input
              required
              type="password"
              name="current_password"
              value={form.current_password}
              onChange={handleChange}
              className="field-input"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="field-label">New Password</label>
            <input
              required
              type="password"
              name="new_password"
              value={form.new_password}
              onChange={handleChange}
              className="field-input"
              autoComplete="new-password"
              minLength={8}
            />
            <p className="text-xs text-muted mt-1">Minimum 8 characters</p>
          </div>
          <div>
            <label className="field-label">Confirm New Password</label>
            <input
              required
              type="password"
              name="confirm_password"
              value={form.confirm_password}
              onChange={handleChange}
              className="field-input"
              autoComplete="new-password"
            />
            {form.confirm_password && form.new_password !== form.confirm_password && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving || (form.confirm_password && form.new_password !== form.confirm_password)}
              className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />}
              Update Password
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function LoadingSpinner({ text }) {
  return (
    <div className="flex items-center justify-center gap-2 text-muted py-20">
      <IconLoader2 size={18} className="animate-spin" />
      {text}
    </div>
  )
}
