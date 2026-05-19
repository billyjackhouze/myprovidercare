import { NavLink } from 'react-router-dom'
import {
  IconLayoutDashboard,
  IconUsers,
  IconCalendar,
  IconClipboardList,
  IconFileDescription,
  IconReceipt2,
  IconCoin,
  IconMap,
  IconShieldCheck,
  IconSettings,
  IconLogout,
  IconForms,
} from '@tabler/icons-react'
import useAuthStore from '@/store/auth'

// Each nav item optionally specifies a permission key.
// If no permKey → always visible (e.g. Settings is always shown, filtered inside).
const NAV_ITEMS = [
  { to: '/dashboard',   icon: IconLayoutDashboard, label: 'Dashboard',       permKey: 'view_dashboard' },
  { to: '/clients',     icon: IconUsers,           label: 'Clients',         permKey: 'view_clients' },
  { to: '/schedule',    icon: IconCalendar,        label: 'Schedule',        permKey: 'view_schedule' },
  { to: '/visits',      icon: IconClipboardList,   label: 'Visits',          permKey: 'view_visits' },
  { to: '/notes',       icon: IconFileDescription, label: 'Progress Notes',  permKey: 'view_notes' },
  { to: '/forms',       icon: IconFileDescription, label: 'Forms Engine',    permKey: 'view_forms' },
  { to: '/claims',      icon: IconReceipt2,        label: 'Claims',          permKey: 'view_claims' },
  { to: '/payroll',     icon: IconCoin,            label: 'Payroll',         permKey: 'view_payroll' },
  { to: '/map',         icon: IconMap,             label: 'Live Map',        permKey: 'view_map' },
  { to: '/audit',       icon: IconShieldCheck,     label: 'Audit',           permKey: 'view_audit' },
  { to: '/settings',    icon: IconSettings,        label: 'Settings',        permKey: 'view_settings' },
]

export default function Sidebar() {
  const { user, logout, permissions } = useAuthStore()
  const permSet = new Set(permissions)

  // Determine which items to show.
  // If permissions haven't loaded yet (empty array) AND user role is known,
  // fall back to showing all items so the UI doesn't flicker blank on first load.
  const permsLoaded = permissions.length > 0
  const visibleItems = NAV_ITEMS.filter(item => {
    if (!item.permKey) return true               // always visible
    if (!permsLoaded) return true                // not loaded yet — show all
    return permSet.has(item.permKey)
  })

  return (
    <aside
      className="flex flex-col h-screen w-40 shrink-0"
      style={{ background: '#1B2D4E' }}
    >
      {/* Logo */}
      <div className="bg-white px-3 py-3 flex items-center justify-center">
        <span className="text-xs font-semibold text-navy leading-tight text-center">
          National<br />SmartHealthCare<br />Services
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-2 py-1.5 rounded-card text-sm transition-colors ${
                isActive
                  ? 'bg-primary text-white font-medium'
                  : 'text-nav-inactive hover:text-white hover:bg-white/10'
              }`
            }
          >
            <Icon size={16} strokeWidth={1.5} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User profile */}
      {user && (
        <div className="px-3 py-3 border-t border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
              style={{ background: '#2563EB' }}
            >
              {user.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-medium truncate">{user.full_name}</div>
              <div className="text-nav-inactive text-xs capitalize truncate">{user.role}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-nav-inactive hover:text-white text-xs transition-colors w-full"
          >
            <IconLogout size={14} />
            Sign out
          </button>
        </div>
      )}
    </aside>
  )
}
