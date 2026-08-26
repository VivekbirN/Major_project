import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// SVG icon components
const Icon = ({ path, className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
)

const ICONS = {
  dashboard: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  inventory: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  products: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  nodes: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  forecasting: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  redistribution: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
  alerts: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  waste: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  mynode: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
}

// Navigation items per role
const getNavItems = (role) => {
  const common = [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', implemented: true },
    { label: 'Inventory', path: '/inventory', icon: 'inventory', implemented: true },
    { label: 'Products', path: '/products', icon: 'products', implemented: true },
  ]

  if (role === 'SUPPLY_CHAIN_MANAGER') {
    return [
      ...common,
      { label: 'Nodes', path: '/nodes', icon: 'nodes', implemented: true },
      { divider: true, label: 'AI Intelligence' },
      { label: 'Forecasting', path: '/forecasting', icon: 'forecasting', implemented: true },
      { label: 'AI Alerts & Risk', path: '/alerts', icon: 'alerts', implemented: true },
      { divider: true, label: 'Part 4 — Redistribution' },
      { label: 'Redistribution', path: '/redistribution', icon: 'redistribution', implemented: false },
      { label: 'Waste Analytics', path: '/waste', icon: 'waste', implemented: false },
    ]
  }

  if (role === 'WAREHOUSE_ADMIN') {
    return [
      ...common,
      { label: 'My Node', path: '/nodes', icon: 'mynode', implemented: true },
      { divider: true, label: 'AI Intelligence' },
      { label: 'Forecasting', path: '/forecasting', icon: 'forecasting', implemented: true },
      { label: 'AI Alerts & Risk', path: '/alerts', icon: 'alerts', implemented: true },
    ]
  }

  // VIEWER
  return [
    ...common,
    { divider: true, label: 'AI Intelligence' },
    { label: 'Forecasting', path: '/forecasting', icon: 'forecasting', implemented: true },
    { label: 'AI Alerts & Risk', path: '/alerts', icon: 'alerts', implemented: true },
  ]
}

const Sidebar = () => {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) return null

  const navItems = getNavItems(user.role)

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-surface-800 border-r border-surface-600 flex flex-col z-30">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-surface-600">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zm5.99 7.176A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">FoodChain AI</h1>
            <p className="text-xs text-gray-500 leading-tight">Supply Intelligence</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item, idx) => {
          if (item.divider) {
            return (
              <div key={idx} className="pt-4 pb-1.5">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider px-3">
                  {item.label}
                </p>
              </div>
            )
          }

          if (!item.implemented) {
            return (
              <div key={item.path} className="nav-item-disabled" title="Coming in a future phase">
                <Icon path={ICONS[item.icon]} />
                <span>{item.label}</span>
                <span className="ml-auto text-xs bg-surface-600 text-gray-500 px-1.5 py-0.5 rounded">Soon</span>
              </div>
            )
          }

          const isActive = location.pathname === item.path

          return (
            <NavLink key={item.path} to={item.path} className={isActive ? 'nav-item-active' : 'nav-item'}>
              <Icon path={ICONS[item.icon]} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-surface-600">
        <p className="text-xs text-gray-600 text-center">Part 1 — Foundation</p>
      </div>
    </aside>
  )
}

export default Sidebar
