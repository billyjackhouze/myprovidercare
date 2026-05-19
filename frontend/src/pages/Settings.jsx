/**
 * Settings — Organization | Users & Roles | Roles & Permissions | Workflow & Forms | Security
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  IconBuilding, IconUsers, IconSettings2, IconShieldLock,
  IconLoader2, IconCheck, IconPlus, IconX, IconPencil,
  IconUserCheck, IconUserOff, IconChevronRight, IconSparkles,
  IconLock, IconKey, IconShieldCheck, IconChevronDown, IconChevronUp,
} from '@tabler/icons-react'

// Simple inline icon substitutes
function IconInfoCircle({ size = 16, className = '' }) {
  return <span className={`inline-flex items-center justify-center font-bold text-xs leading-none ${className}`} style={{ width: size, height: size, borderRadius: '50%', border: '1.5px currentColor solid', flexShrink: 0 }}>i</span>
}
import api from '@/lib/api'
import useAuthStore from '@/store/auth'

const TABS = [
  { key: 'org',      label: 'Organization',        Icon: IconBuilding },
  { key: 'users',    label: 'Users & Roles',        Icon: IconUsers },
  { key: 'roles',    label: 'Roles & Permissions',  Icon: IconShieldCheck },
  { key: 'workflow', label: 'Workflow & Forms',      Icon: IconSettings2 },
  { key: 'security', label: 'Security',              Icon: IconShieldLock },
]

export default function Settings() {
  const [activeTab, setActiveTab] = useState('org')

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-heading">Settings</h1>
        <p className="text-muted text-sm mt-0.5">Manage your organization, users, roles, and security preferences</p>
      </div>

      <div className="flex gap-1 mb-6 bg-page border border-border rounded-card p-1 w-fit flex-wrap">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-white text-heading shadow-sm' : 'text-muted hover:text-heading'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'org'      && <OrgTab />}
      {activeTab === 'users'    && <UsersTab />}
      {activeTab === 'roles'    && <RolesTab />}
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
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    api.get('/settings/org')
      .then(r => setForm(f => ({ ...f, ...r.data })))
      .catch(() => toast.error('Failed to load organization settings'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/settings/org', form)
      toast.success('Organization settings saved')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }

  if (loading) return <Spinner text="Loading organization…" />

  return (
    <form onSubmit={handleSave}>
      <Card title="Organization Details">
        <div className="p-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="field-label">Organization Name</label>
            <input name="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="field-input" placeholder="National Case Management Inc." />
          </div>
          <div>
            <label className="field-label">Phone</label>
            <input name="phone" value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="field-input" placeholder="(555) 000-0000" />
          </div>
          <div>
            <label className="field-label">NPI Number</label>
            <input name="npi" value={form.npi || ''} onChange={e => setForm(f => ({ ...f, npi: e.target.value }))} className="field-input" placeholder="1234567890" />
          </div>
          <div className="col-span-2">
            <label className="field-label">Address Line 1</label>
            <input name="address_line1" value={form.address_line1 || ''} onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))} className="field-input" />
          </div>
          <div className="col-span-2">
            <label className="field-label">Address Line 2</label>
            <input name="address_line2" value={form.address_line2 || ''} onChange={e => setForm(f => ({ ...f, address_line2: e.target.value }))} className="field-input" />
          </div>
          <div>
            <label className="field-label">City</label>
            <input name="city" value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="field-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">State</label>
              <input name="state" value={form.state || ''} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} maxLength={2} className="field-input uppercase" placeholder="NY" />
            </div>
            <div>
              <label className="field-label">ZIP</label>
              <input name="zip_code" value={form.zip_code || ''} onChange={e => setForm(f => ({ ...f, zip_code: e.target.value }))} className="field-input" />
            </div>
          </div>
        </div>
      </Card>

      <Card title="Billing & Provider IDs" className="mb-6">
        <div className="p-5 grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Tax ID (EIN)</label>
            <input name="tax_id" value={form.tax_id || ''} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} className="field-input" placeholder="XX-XXXXXXX" />
          </div>
          <div>
            <label className="field-label">Medicaid Provider ID</label>
            <input name="medicaid_provider_id" value={form.medicaid_provider_id || ''} onChange={e => setForm(f => ({ ...f, medicaid_provider_id: e.target.value }))} className="field-input" />
          </div>
        </div>
      </Card>

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
  developer:    'bg-red-100 text-red-700',
  admin:        'bg-orange-100 text-orange-700',
  owner:        'bg-purple-100 text-purple-700',
  supervisor:   'bg-blue-100 text-blue-700',
  case_manager: 'bg-green-100 text-green-700',
  billing:      'bg-teal-100 text-teal-700',
  intake:       'bg-amber-100 text-amber-700',
  auditor:      'bg-gray-100 text-gray-600',
  staff:        'bg-slate-100 text-slate-600',
}

const ALL_ROLES = Object.keys(ROLE_COLORS)

function UsersTab() {
  const currentUser = useAuthStore(s => s.user)
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null) // for permission overrides panel
  const [invite, setInvite] = useState({ full_name: '', email: '', role: 'case_manager', temp_password: '' })
  const [inviting, setInviting]   = useState(false)

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
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') } finally { setUpdatingId(null) }
  }

  const handleToggleStatus = async (user) => {
    setUpdatingId(user.id)
    try {
      await api.put(`/settings/users/${user.id}/status`, { is_active: !user.is_active })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      toast.success(user.is_active ? 'User deactivated' : 'User activated')
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') } finally { setUpdatingId(null) }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviting(true)
    try {
      const res = await api.post('/settings/users/invite', invite)
      setUsers(prev => [...prev, { ...res.data, created_at: new Date().toISOString() }])
      setInvite({ full_name: '', email: '', role: 'case_manager', temp_password: '' })
      setShowInvite(false)
      toast.success(`${res.data.full_name} added`)
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') } finally { setInviting(false) }
  }

  if (loading) return <Spinner text="Loading users…" />

  return (
    <div className="flex gap-5">
      {/* Left: user table */}
      <div className="flex-1 min-w-0">
        {showInvite && (
          <Card className="mb-4" title={<span className="flex items-center gap-1.5"><IconPlus size={14} /> Invite New User</span>} action={<button onClick={() => setShowInvite(false)} className="text-muted hover:text-heading"><IconX size={15} /></button>}>
            <form onSubmit={handleInvite} className="p-5 grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Full Name</label>
                <input required value={invite.full_name} onChange={e => setInvite(f => ({ ...f, full_name: e.target.value }))} className="field-input" placeholder="Jane Smith" />
              </div>
              <div>
                <label className="field-label">Email</label>
                <input required type="email" value={invite.email} onChange={e => setInvite(f => ({ ...f, email: e.target.value }))} className="field-input" placeholder="jane@example.com" />
              </div>
              <div>
                <label className="field-label">Role</label>
                <select value={invite.role} onChange={e => setInvite(f => ({ ...f, role: e.target.value }))} className="field-input">
                  {ALL_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Temporary Password</label>
                <input required type="text" value={invite.temp_password} onChange={e => setInvite(f => ({ ...f, temp_password: e.target.value }))} className="field-input" placeholder="Min 8 characters" minLength={8} />
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowInvite(false)} className="btn-secondary text-sm">Cancel</button>
                <button type="submit" disabled={inviting} className="btn-primary text-sm flex items-center gap-1.5">
                  {inviting ? <IconLoader2 size={14} className="animate-spin" /> : <IconPlus size={14} />} Add User
                </button>
              </div>
            </form>
          </Card>
        )}

        <Card title={`Team Members (${users.length})`} action={!showInvite && <button onClick={() => setShowInvite(true)} className="btn-primary text-sm flex items-center gap-1.5"><IconPlus size={14} /> Invite</button>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-page">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map(user => {
                  const isSelf = user.email === currentUser?.email
                  const isSelected = selectedUser?.id === user.id
                  return (
                    <tr key={user.id} className={`${user.is_active ? 'bg-white' : 'bg-page opacity-60'} ${isSelected ? 'ring-1 ring-primary' : ''}`}>
                      <td className="px-4 py-3 font-medium text-heading">
                        {user.full_name}
                        {isSelf && <span className="ml-1.5 text-xs text-muted">(you)</span>}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">{user.email}</td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <RoleBadge role={user.role} />
                        ) : (
                          <select value={user.role} onChange={e => handleRoleChange(user.id, e.target.value)} disabled={updatingId === user.id}
                            className={`text-xs font-medium px-2 py-0.5 rounded border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-600'}`}>
                            {ALL_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {user.is_active
                          ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Active</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />Inactive</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedUser(isSelected ? null : user)}
                            className={`text-xs px-2 py-1 rounded border transition-colors flex items-center gap-1 ${isSelected ? 'border-primary text-primary bg-blue-50' : 'border-border text-muted hover:text-heading hover:bg-page'}`}
                            title="View/edit permission overrides"
                          >
                            <IconShieldCheck size={11} /> Perms
                          </button>
                          {!isSelf && (
                            <button onClick={() => handleToggleStatus(user)} disabled={updatingId === user.id}
                              className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 ${user.is_active ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                              {updatingId === user.id ? <IconLoader2 size={11} className="animate-spin" /> : user.is_active ? <><IconUserOff size={11} /></> : <><IconUserCheck size={11} /></>}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {users.length === 0 && <div className="text-center py-10 text-muted text-sm">No users found.</div>}
          </div>
        </Card>
      </div>

      {/* Right: per-user permission overrides */}
      {selectedUser && (
        <div className="w-80 shrink-0">
          <UserPermissionsPanel user={selectedUser} onClose={() => setSelectedUser(null)} />
        </div>
      )}
    </div>
  )
}

// ── Per-user permission overrides panel ───────────────────────────────────────
function UserPermissionsPanel({ user, onClose }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState({})

  const load = useCallback(() => {
    api.get(`/settings/users/${user.id}/permissions`)
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load permissions'))
      .finally(() => setLoading(false))
  }, [user.id])

  useEffect(() => { load() }, [load])

  const setOverride = async (permKey, state) => {
    setSaving(prev => ({ ...prev, [permKey]: true }))
    try {
      await api.put(`/settings/users/${user.id}/permissions`, { permission_key: permKey, state })
      setData(prev => ({
        ...prev,
        permissions: prev.permissions.map(p => {
          if (p.key !== permKey) return p
          const override = state
          const effective = override === 'granted' ? true : override === 'denied' ? false : p.role_default
          return { ...p, override, effective }
        })
      }))
    } catch { toast.error('Failed to update') } finally { setSaving(prev => ({ ...prev, [permKey]: false })) }
  }

  if (loading) return (
    <div className="bg-card border border-border rounded-card p-5">
      <Spinner text="Loading…" />
    </div>
  )

  const bySection = {}
  for (const p of (data?.permissions || [])) {
    if (!bySection[p.section]) bySection[p.section] = []
    bySection[p.section].push(p)
  }

  return (
    <div className="bg-card border border-primary/40 rounded-card overflow-hidden sticky top-4">
      <div className="px-4 py-3 border-b border-border bg-page flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-heading">{data?.user_name}</div>
          <div className="text-xs text-muted">Permission overrides · <RoleBadge role={data?.role} /></div>
        </div>
        <button onClick={onClose} className="text-muted hover:text-heading"><IconX size={15} /></button>
      </div>

      <div className="text-xs text-muted px-4 py-2 bg-amber-50 border-b border-amber-100 flex gap-1.5">
        <IconInfoCircle size={13} className="shrink-0 mt-0.5 text-amber-500" />
        Override individual permissions beyond their role defaults. Grey = inherited from role.
      </div>

      <div className="overflow-y-auto max-h-[calc(100vh-240px)]">
        {Object.entries(bySection).map(([section, perms]) => (
          <div key={section}>
            <div className="px-4 py-1.5 bg-page border-b border-border text-xs font-semibold text-muted uppercase tracking-wide">{section}</div>
            {perms.map(p => {
              const isSaving = saving[p.key]
              return (
                <div key={p.key} className="flex items-center gap-2 px-4 py-2 border-b border-border last:border-0 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium truncate ${p.effective ? 'text-heading' : 'text-muted'}`}>{p.label}</div>
                    {p.override && (
                      <div className={`text-xs ${p.override === 'granted' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {p.override === 'granted' ? '+ Granted' : '− Denied'} (override)
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Grant */}
                    <button
                      onClick={() => setOverride(p.key, p.override === 'granted' ? null : 'granted')}
                      disabled={isSaving}
                      title="Grant (override)"
                      className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${p.override === 'granted' ? 'bg-emerald-100 text-emerald-600' : 'text-muted hover:bg-emerald-50 hover:text-emerald-500'}`}
                    >✓</button>
                    {/* Deny */}
                    <button
                      onClick={() => setOverride(p.key, p.override === 'denied' ? null : 'denied')}
                      disabled={isSaving}
                      title="Deny (override)"
                      className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${p.override === 'denied' ? 'bg-red-100 text-red-500' : 'text-muted hover:bg-red-50 hover:text-red-400'}`}
                    >✗</button>
                  </div>
                  {/* Effective indicator */}
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.effective ? 'bg-emerald-400' : 'bg-gray-200'}`} title={p.effective ? 'Active' : 'Not active'} />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab 3: Roles & Permissions ───────────────────────────────────────────────
function RolesTab() {
  const currentUser = useAuthStore(s => s.user)
  const [permissions, setPermissions] = useState([])
  const [roleDefaults, setRoleDefaults] = useState({})
  const [loading, setLoading]         = useState(true)
  const [selectedRole, setSelectedRole] = useState('case_manager')
  const [saving, setSaving]           = useState({})

  const canManageRoles = ['developer', 'admin', 'owner'].includes(currentUser?.role)

  const load = useCallback(async () => {
    try {
      const [permRes, roleRes] = await Promise.all([
        api.get('/settings/permissions'),
        api.get('/settings/roles'),
      ])
      setPermissions(permRes.data.permissions)
      setRoleDefaults(roleRes.data)
    } catch { toast.error('Failed to load role settings') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const togglePerm = async (permKey, currentlyGranted) => {
    if (!canManageRoles) return toast.error('You do not have permission to manage roles')
    setSaving(prev => ({ ...prev, [`${selectedRole}:${permKey}`]: true }))
    try {
      await api.put(`/settings/roles/${selectedRole}/permissions`, { permission_key: permKey, granted: !currentlyGranted })
      setRoleDefaults(prev => {
        const updated = { ...prev }
        const keys = [...(updated[selectedRole] || [])]
        if (!currentlyGranted) {
          if (!keys.includes(permKey)) keys.push(permKey)
        } else {
          const i = keys.indexOf(permKey)
          if (i !== -1) keys.splice(i, 1)
        }
        updated[selectedRole] = keys
        return updated
      })
    } catch { toast.error('Failed to update') } finally { setSaving(prev => { const n = { ...prev }; delete n[`${selectedRole}:${permKey}`]; return n }) }
  }

  if (loading) return <Spinner text="Loading roles…" />

  // Group permissions by section
  const bySection = {}
  for (const p of permissions) {
    if (!bySection[p.section]) bySection[p.section] = []
    bySection[p.section].push(p)
  }

  const rolePerms = new Set(roleDefaults[selectedRole] || [])

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-card px-4 py-3 mb-5 flex gap-2.5 text-xs text-blue-800">
        <IconInfoCircle size={14} className="shrink-0 mt-0.5 text-blue-500" />
        <div>
          <strong>How it works:</strong> Set what each role can do by default here. Then in the Users tab, you can grant or deny individual permissions per user as overrides on top of their role.
        </div>
      </div>

      <div className="flex gap-5">
        {/* Role selector */}
        <div className="w-44 shrink-0">
          <div className="bg-card border border-border rounded-card overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border bg-page text-xs font-semibold text-muted uppercase tracking-wide">Roles</div>
            {ALL_ROLES.map(role => (
              <button key={role} onClick={() => setSelectedRole(role)}
                className={`w-full text-left px-3 py-2.5 text-sm border-b border-border last:border-0 transition-colors flex items-center gap-2 ${selectedRole === role ? 'bg-primary/5 text-primary font-medium' : 'hover:bg-page text-muted hover:text-heading'}`}
              >
                <span className={`w-2 h-2 rounded-full inline-block ${selectedRole === role ? 'bg-primary' : 'bg-transparent'}`} />
                {role.replace(/_/g, ' ')}
                <span className="ml-auto text-xs opacity-60">{(roleDefaults[role] || []).length}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Permission matrix for selected role */}
        <div className="flex-1 min-w-0">
          <div className="bg-card border border-border rounded-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-page flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-heading capitalize">{selectedRole.replace(/_/g, ' ')} — Permissions</h3>
                <p className="text-xs text-muted mt-0.5">{(roleDefaults[selectedRole] || []).length} permissions granted</p>
              </div>
              {!canManageRoles && <span className="text-xs text-muted bg-page border border-border px-2 py-1 rounded">View only</span>}
            </div>

            {Object.entries(bySection).map(([section, perms]) => (
              <div key={section}>
                <div className="px-4 py-2 bg-page border-b border-border text-xs font-semibold text-muted uppercase tracking-wide">{section}</div>
                {perms.map(p => {
                  const granted = rolePerms.has(p.key)
                  const isSaving = saving[`${selectedRole}:${p.key}`]
                  return (
                    <div key={p.key} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-heading">{p.label}</div>
                        {p.description && <div className="text-xs text-muted">{p.description}</div>}
                      </div>
                      <button
                        onClick={() => togglePerm(p.key, granted)}
                        disabled={isSaving || !canManageRoles}
                        title={granted ? 'Click to revoke' : 'Click to grant'}
                        className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 disabled:opacity-50 ${granted ? 'bg-emerald-500' : 'bg-gray-200'} ${canManageRoles ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        {isSaving
                          ? <IconLoader2 size={12} className="animate-spin text-white mx-auto" />
                          : <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${granted ? 'translate-x-4' : 'translate-x-0'}`} />
                        }
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 4: Workflow & Forms ──────────────────────────────────────────────────
function WorkflowTab() {
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <WorkflowCard
        icon={<IconSettings2 size={18} className="text-blue-600" />}
        iconBg="bg-blue-50"
        title="Client Record Workflow"
        description="Configure which tabs appear on every client record, control their order and visibility, and add custom form tabs from the Forms Engine. Changes apply org-wide instantly."
        action={<button onClick={() => navigate('/settings/workflow')} className="btn-primary text-sm flex items-center gap-1.5 shrink-0">Open Workflow Settings<IconChevronRight size={14} /></button>}
      />
      <WorkflowCard
        icon={<IconSparkles size={18} className="text-amber-500" />}
        iconBg="bg-amber-50"
        title="Smart Fields"
        description='Define plain-language rules that surface key data from any form — like "most recent auth expiration date" — as a Key Metrics panel on every client. Claude AI interprets your rules automatically.'
        action={<button onClick={() => navigate('/settings/workflow', { state: { section: 'smartfields' } })} className="btn-secondary text-sm flex items-center gap-1.5 shrink-0">Manage Smart Fields<IconChevronRight size={14} /></button>}
      />
      <WorkflowCard
        icon={<IconPlus size={18} className="text-emerald-600" />}
        iconBg="bg-emerald-50"
        title="Forms Engine"
        description="Upload any paper form (PDF or photo) and Claude Vision will extract all fields automatically. Once ingested, forms become available to add as client record tabs."
        action={<button onClick={() => navigate('/forms')} className="btn-secondary text-sm flex items-center gap-1.5 shrink-0">Go to Forms<IconChevronRight size={14} /></button>}
      />
    </div>
  )
}

function WorkflowCard({ icon, iconBg, title, description, action }) {
  return (
    <div className="bg-card border border-border rounded-card p-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
        <div>
          <h3 className="text-sm font-semibold text-heading">{title}</h3>
          <p className="text-xs text-muted mt-0.5 max-w-md">{description}</p>
        </div>
      </div>
      {action}
    </div>
  )
}

// ─── Tab 5: Security ──────────────────────────────────────────────────────────
function SecurityTab() {
  const user = useAuthStore(s => s.user)
  const [form, setForm]   = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.new_password !== form.confirm_password) return toast.error('Passwords do not match')
    if (form.new_password.length < 8) return toast.error('Min 8 characters')
    setSaving(true)
    try {
      await api.put('/settings/me/password', { current_password: form.current_password, new_password: form.new_password })
      toast.success('Password changed successfully')
      setForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to change password') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <Card title={<span className="flex items-center gap-1.5"><IconLock size={14} /> Current Session</span>}>
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
            <RoleBadge role={user?.role} />
          </div>
        </div>
      </Card>

      <Card title={<span className="flex items-center gap-1.5"><IconKey size={14} /> Change Password</span>}>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="field-label">Current Password</label>
            <input required type="password" value={form.current_password} onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))} className="field-input" autoComplete="current-password" />
          </div>
          <div>
            <label className="field-label">New Password</label>
            <input required type="password" value={form.new_password} onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))} className="field-input" autoComplete="new-password" minLength={8} />
          </div>
          <div>
            <label className="field-label">Confirm New Password</label>
            <input required type="password" value={form.confirm_password} onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))} className="field-input" autoComplete="new-password" />
            {form.confirm_password && form.new_password !== form.confirm_password && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving || (form.confirm_password && form.new_password !== form.confirm_password)} className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
              {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />} Update Password
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function Card({ title, action, children, className = 'mb-4' }) {
  return (
    <div className={`bg-card border border-border rounded-card overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="px-5 py-3 border-b border-border bg-page flex items-center justify-between">
          <h2 className="text-sm font-semibold text-heading">{title}</h2>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[role] || 'bg-gray-100 text-gray-600'}`}>
      {role?.replace(/_/g, ' ') || '—'}
    </span>
  )
}

function Spinner({ text }) {
  return (
    <div className="flex items-center justify-center gap-2 text-muted py-16">
      <IconLoader2 size={18} className="animate-spin" />{text}
    </div>
  )
}
