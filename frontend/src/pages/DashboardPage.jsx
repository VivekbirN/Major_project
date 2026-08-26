import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import { getDashboardOverview } from '../api/dashboard'
import { useAuth } from '../context/AuthContext'

const AlertSeverityBadge = ({ severity }) => {
  const cls = {
    CRITICAL: 'badge-danger',
    HIGH: 'badge-warning',
    MEDIUM: 'badge-info',
    LOW: 'badge',
  }
  return <span className={cls[severity] || 'badge'}>{severity}</span>
}

const DashboardPage = () => {
  const { user } = useAuth()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true)
        const data = await getDashboardOverview()
        setOverview(data.data)
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    fetchOverview()
  }, [])

  const fmt = (n) => (n === null || n === undefined ? null : n.toLocaleString())
  const fmtCurrency = (n) => n != null ? `₹${parseFloat(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : null

  return (
    <Layout title="Dashboard">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {user?.role === 'SUPPLY_CHAIN_MANAGER'
            ? 'Here\'s a full network overview.'
            : user?.node
            ? `Showing data for ${user.node.name}`
            : 'Here\'s your supply chain snapshot.'}
        </p>
      </div>

      {error && (
        <div className="mb-5 p-4 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Nodes"
          value={fmt(overview?.total_nodes)}
          subtitle="Active supply chain nodes"
          icon="🏭"
          colorClass="text-brand-400"
          bgClass="bg-brand-900/30"
        />
        <StatCard
          title="Total Products"
          value={fmt(overview?.total_products)}
          subtitle="Tracked SKUs"
          icon="📦"
          colorClass="text-blue-400"
          bgClass="bg-blue-900/30"
        />
        <StatCard
          title="Inventory Units"
          value={fmt(overview?.total_inventory_units)}
          subtitle="Across all active nodes"
          icon="🗄️"
          colorClass="text-indigo-400"
          bgClass="bg-indigo-900/30"
        />
        <StatCard
          title="Active Alerts"
          value={fmt(overview?.active_alerts)}
          subtitle="Require attention"
          icon="🔔"
          colorClass={overview?.active_alerts > 0 ? 'text-red-400' : 'text-gray-400'}
          bgClass={overview?.active_alerts > 0 ? 'bg-red-900/30' : 'bg-surface-700'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Low Stock Items"
          value={fmt(overview?.low_stock_items)}
          subtitle="At or below reorder threshold"
          icon="📉"
          colorClass={overview?.low_stock_items > 0 ? 'text-yellow-400' : 'text-gray-400'}
          bgClass={overview?.low_stock_items > 0 ? 'bg-yellow-900/30' : 'bg-surface-700'}
        />
        <StatCard
          title="Near-Expiry Items"
          value={fmt(overview?.near_expiry_items)}
          subtitle="Expiring within 7 days"
          icon="⏳"
          colorClass={overview?.near_expiry_items > 0 ? 'text-orange-400' : 'text-gray-400'}
          bgClass={overview?.near_expiry_items > 0 ? 'bg-orange-900/30' : 'bg-surface-700'}
        />
        <StatCard
          title="Spoilage Events"
          value={fmt(overview?.recent_spoilage?.count)}
          subtitle="Last 30 days"
          icon="🗑️"
          colorClass="text-red-400"
          bgClass="bg-red-900/30"
        />
        <StatCard
          title="Spoilage Loss"
          value={fmtCurrency(overview?.recent_spoilage?.estimated_loss)}
          subtitle="Estimated loss — last 30 days"
          icon="💸"
          colorClass="text-red-400"
          bgClass="bg-red-900/30"
        />
      </div>

      {/* Info panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Network status */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-brand-400">🌐</span> Network Health
          </h3>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-5 bg-surface-700 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-surface-600">
                <span className="text-sm text-gray-400">Stock availability</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-surface-600 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{
                      width: overview ? `${Math.max(0, 100 - (overview.low_stock_items / Math.max(overview.total_inventory_units, 1)) * 100)}%` : '0%'
                    }} />
                  </div>
                  <span className="text-xs text-gray-400">
                    {overview ? `${Math.round(100 - (overview.low_stock_items / Math.max(overview.total_products, 1)) * 10)}%` : '—'}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-surface-600">
                <span className="text-sm text-gray-400">Near-expiry risk</span>
                <span className={`text-sm font-medium ${overview?.near_expiry_items > 5 ? 'text-red-400' : overview?.near_expiry_items > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {overview?.near_expiry_items > 5 ? 'High' : overview?.near_expiry_items > 0 ? 'Medium' : 'Low'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-400">Alert severity</span>
                <span className={`text-sm font-medium ${overview?.active_alerts > 3 ? 'text-red-400' : overview?.active_alerts > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {overview?.active_alerts > 3 ? 'Critical' : overview?.active_alerts > 0 ? 'Warning' : 'Normal'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ML Modules Notice */}
        <div className="card border-dashed border-surface-500">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <span>🤖</span> AI Modules — Coming in Part 3
          </h3>
          <div className="space-y-2">
            {[
              { label: 'Demand Forecasting', desc: 'Random Forest / XGBoost prediction' },
              { label: 'Redistribution Engine', desc: 'AI-driven inter-node transfer recommendations' },
              { label: 'Spoilage Prediction', desc: 'Shelf-life risk scoring per product' },
              { label: 'Anomaly Detection', desc: 'Real-time demand & supply irregularity alerts' },
              { label: 'Waste Analytics', desc: 'PySpark-powered loss reporting & SKU analysis' },
            ].map(module => (
              <div key={module.label} className="flex items-start gap-2.5 py-1.5">
                <span className="text-xs text-gray-600 mt-0.5">◻</span>
                <div>
                  <p className="text-xs font-medium text-gray-500">{module.label}</p>
                  <p className="text-xs text-gray-600">{module.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default DashboardPage
