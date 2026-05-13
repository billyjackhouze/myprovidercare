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
} from '@tabler/icons-react'
import useAuthStore from '@/store/auth'

const navItems = [
  { to: '/dashboard',   icon: IconLayoutDashboard, label: 'Dashboard' },
  { to: '/clients',     icon: IconUsers,           label: 'Clients' },
  { to: '/schedule',    icon: IconCalendar,        label: 'Schedule' },
  { to: '/visits',      icon: IconClipboardList,   label: 'Visits' },
  { to: '/notes',       icon: IconFileDescription, label: 'Progress Notes' },
  { to: '/forms',       icon: IconFileDescription, label: 'Forms Engine' },
  { to: '/claims',      icon: IconReceipt2,        label: 'Claims' },
  { to: '/payroll',     icon: IconCoin,            label: 'Payroll' },
  { to: '/map',         icon: IconMap,             label: 'Live Map' },
  { to: '/audit',       icon: IconShieldCheck,     label: 'Audit' },
  { to: '/settings',    icon: IconSettings,        label: 'Settings' },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()

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
        {navItems.map(({ to, icon: Icon, label }) => (
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
