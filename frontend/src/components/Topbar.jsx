import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = {
  SUPPLY_CHAIN_MANAGER: 'Supply Chain Manager',
  WAREHOUSE_ADMIN: 'Warehouse Admin',
  VIEWER: 'Viewer',
}

const ROLE_BADGE_CLASS = {
  SUPPLY_CHAIN_MANAGER: 'badge-manager',
  WAREHOUSE_ADMIN: 'badge-admin',
  VIEWER: 'badge-viewer',
}

const Topbar = ({ title }) => {
  const { user, logout } = useAuth()

  return (
    <header className="fixed top-0 left-60 right-0 h-14 bg-surface-800 border-b border-surface-600 flex items-center justify-between px-6 z-20">
      {/* Page title */}
      <h2 className="text-base font-semibold text-white">{title}</h2>

      {/* Right side: user info + logout */}
      <div className="flex items-center gap-4">
        {/* Node info if applicable */}
        {user?.node && (
          <span className="hidden md:block text-xs text-gray-500 border border-surface-600 px-2.5 py-1 rounded-md">
            📍 {user.node.name}
          </span>
        )}

        {/* Role badge */}
        <span className={ROLE_BADGE_CLASS[user?.role] || 'badge'}>
          {ROLE_LABELS[user?.role] || user?.role}
        </span>

        {/* User avatar + name */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center">
            <span className="text-xs font-bold text-white">
              {user?.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-200 hidden md:block">{user?.name}</span>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5"
          title="Logout"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden md:block">Logout</span>
        </button>
      </div>
    </header>
  )
}

export default Topbar
