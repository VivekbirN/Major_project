import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import ProgressBar from '../components/ProgressBar'
import EmptyState from '../components/EmptyState'
import StockStatusBadge from '../components/StockStatusBadge'
import { getDashboardOverview } from '../api/dashboard'
import { useAuth } from '../context/AuthContext'

const fmt = (n) => n == null ? '—' : Number(n).toLocaleString('en-IN')
const fmtVal = (n) => n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const NODE_TYPE_ICONS = { WAREHOUSE: '🏭', RETAIL_STORE: '🏪', DISTRIBUTION_CENTRE: '🚚' }

const CHART_COLORS = ['#6366f1', '#22d3ee', '#a78bfa', '#34d399', '#f59e0b', '#f87171', '#60a5fa', '#fb923c']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-white">{Number(payload[0].value).toLocaleString('en-IN')} units</p>
    </div>
  )
}

const DashboardPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await getDashboardOverview()
        setData(res.data)
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const kpis = data?.kpis || {}
  const nodes = data?.nodes || []
  const lowStock = data?.low_stock || []
  const nearExpiry = data?.near_expiry || []
  const catData = data?.inventory_by_category || []
  const nodeData = data?.inventory_by_node || []

  const daysUntil = (d) => {
    if (!d) return null
    return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24))
  }

  const Skeleton = ({ className = '' }) => (
    <div className={`bg-surface-700 rounded animate-pulse ${className}`} />
  )

  return (
    <Layout title="Dashboard">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">
          {user?.role === 'SUPPLY_CHAIN_MANAGER'
            ? 'Network Overview 🌐'
            : user?.role === 'WAREHOUSE_ADMIN'
            ? `${user.node?.name || 'Node'} Dashboard 🏭`
            : 'Supply Chain Dashboard 📊'}
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {user?.role === 'SUPPLY_CHAIN_MANAGER'
            ? 'Real-time visibility across all supply chain nodes'
            : user?.node?.name
            ? `Monitoring ${user.node.name} — ${user.node.type?.replace(/_/g, ' ')}`
            : 'Read-only supply chain view'}
        </p>
      </div>

      {error && (
        <div className="mb-5 p-4 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">⚠️ {error}</div>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <StatCard title="Total Nodes" value={fmt(kpis.total_nodes)} subtitle="Active supply nodes" icon="🏭" colorClass="text-brand-400" bgClass="bg-brand-900/30" />
        <StatCard title="Total Products" value={fmt(kpis.total_products)} subtitle="Tracked SKUs" icon="📦" colorClass="text-blue-400" bgClass="bg-blue-900/30" />
        <StatCard title="Total Inventory" value={fmt(kpis.total_inventory_units)} subtitle="Units across network" icon="🗄️" colorClass="text-indigo-400" bgClass="bg-indigo-900/30" />
        <StatCard title="Inventory Value" value={fmtVal(kpis.total_inventory_value)} subtitle="Estimated total value" icon="💰" colorClass="text-green-400" bgClass="bg-green-900/30" />
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Low Stock"
          value={fmt(kpis.low_stock_items)}
          subtitle="At or below reorder threshold"
          icon="📉"
          colorClass={kpis.low_stock_items > 0 ? 'text-yellow-400' : 'text-gray-400'}
          bgClass={kpis.low_stock_items > 0 ? 'bg-yellow-900/30' : 'bg-surface-700'}
          trend={kpis.low_stock_items > 0 ? { label: 'Needs attention', positive: false } : null}
        />
        <StatCard
          title="Near Expiry"
          value={fmt(kpis.near_expiry_items)}
          subtitle="Expiring within 7 days"
          icon="⏳"
          colorClass={kpis.near_expiry_items > 0 ? 'text-orange-400' : 'text-gray-400'}
          bgClass={kpis.near_expiry_items > 0 ? 'bg-orange-900/30' : 'bg-surface-700'}
        />
        <StatCard
          title="Overstocked"
          value={fmt(kpis.overstock_items)}
          subtitle="Significantly above threshold"
          icon="📈"
          colorClass={kpis.overstock_items > 0 ? 'text-blue-400' : 'text-gray-400'}
          bgClass={kpis.overstock_items > 0 ? 'bg-blue-900/30' : 'bg-surface-700'}
        />
        <StatCard
          title="Active Alerts"
          value={fmt(kpis.active_alerts)}
          subtitle="Unresolved anomaly alerts"
          icon="🔔"
          colorClass={kpis.active_alerts > 0 ? 'text-red-400' : 'text-gray-400'}
          bgClass={kpis.active_alerts > 0 ? 'bg-red-900/30' : 'bg-surface-700'}
        />
      </div>

      {/* ── Charts ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Inventory by Node */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-brand-400">📊</span> Inventory by Node
          </h3>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : nodeData.length === 0 ? (
            <EmptyState icon="📊" title="No data" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={nodeData} margin={{ left: -10 }}>
                <XAxis dataKey="node_name" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {nodeData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.9} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Inventory by Category */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-brand-400">🥧</span> Inventory by Category
          </h3>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : catData.length === 0 ? (
            <EmptyState icon="📊" title="No data" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={catData}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={65}
                  innerRadius={35}
                  paddingAngle={2}
                >
                  {catData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [v.toLocaleString('en-IN') + ' units', 'Inventory']} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Nodes Table ──────────────────────────────────────────────────────── */}
      {nodes.length > 0 && (
        <div className="card p-0 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-surface-600 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="text-brand-400">🌐</span> Node Status Overview
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-surface-600 bg-surface-900/50">
                <tr>
                  <th className="table-header">Node</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Inventory</th>
                  <th className="table-header">Capacity</th>
                  <th className="table-header">Low Stock</th>
                  <th className="table-header">Near Expiry</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700">
                {nodes.map(node => (
                  <tr
                    key={node.id}
                    className="hover:bg-surface-700/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/nodes/${node.id}`)}
                  >
                    <td className="table-cell font-medium text-white">
                      {NODE_TYPE_ICONS[node.type]} {node.name}
                    </td>
                    <td className="table-cell text-gray-400 text-xs">{node.type?.replace(/_/g, ' ')}</td>
                    <td className="table-cell text-gray-200">{fmt(node.current_inventory)}</td>
                    <td className="table-cell w-36">
                      <ProgressBar pct={node.capacity_utilization} status={node.capacity_status} size="sm" />
                    </td>
                    <td className="table-cell">
                      <span className={node.low_stock_count > 0 ? 'text-yellow-400 font-medium' : 'text-gray-500'}>
                        {node.low_stock_count}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={node.near_expiry_count > 0 ? 'text-orange-400 font-medium' : 'text-gray-500'}>
                        {node.near_expiry_count}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${node.status === 'ACTIVE' ? 'badge-active' : node.status === 'MAINTENANCE' ? 'badge-warning' : 'badge'}`}>
                        {node.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Low Stock + Near Expiry ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low Stock */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-600 flex items-center gap-2">
            <span className="text-yellow-400">📉</span>
            <h3 className="text-sm font-semibold text-white">Low Stock Items</h3>
            {kpis.low_stock_items > 0 && (
              <span className="ml-auto badge-low-stock">{kpis.low_stock_items} items</span>
            )}
          </div>
          {lowStock.length === 0 ? (
            <EmptyState icon="✅" title="No low stock items" subtitle="All products are adequately stocked" />
          ) : (
            <div className="divide-y divide-surface-700">
              {lowStock.map(item => (
                <div
                  key={item.id}
                  className="px-5 py-3 hover:bg-surface-700/50 transition-colors cursor-pointer flex items-center justify-between"
                  onClick={() => navigate(`/inventory/${item.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium text-white">{item.product?.name}</p>
                    <p className="text-xs text-gray-500">
                      <code className="text-brand-400">{item.product?.sku}</code> · {item.node?.name}
                    </p>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-sm font-bold text-yellow-400">{item.quantity} units</p>
                    <p className="text-xs text-gray-600">threshold: {item.reorder_threshold}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Near Expiry */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-600 flex items-center gap-2">
            <span className="text-orange-400">⏳</span>
            <h3 className="text-sm font-semibold text-white">Near Expiry</h3>
            {kpis.near_expiry_items > 0 && (
              <span className="ml-auto badge-near-expiry">{kpis.near_expiry_items} items</span>
            )}
          </div>
          {nearExpiry.length === 0 ? (
            <EmptyState icon="✅" title="No near-expiry items" subtitle="All inventory is within shelf life" />
          ) : (
            <div className="divide-y divide-surface-700">
              {nearExpiry.map(item => {
                const days = daysUntil(item.expiry_date)
                const value = item.quantity * parseFloat(item.product?.unit_cost || 0)
                return (
                  <div
                    key={item.id}
                    className="px-5 py-3 hover:bg-surface-700/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/inventory/${item.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{item.product?.name}</p>
                        <p className="text-xs text-gray-500">
                          <code className="text-brand-400">{item.product?.sku}</code> · {item.node?.name}
                        </p>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className={`text-sm font-bold ${days <= 2 ? 'text-red-400' : days <= 4 ? 'text-orange-400' : 'text-yellow-400'}`}>
                          {days === 0 ? 'Expires today!' : days < 0 ? 'Expired' : `${days}d left`}
                        </p>
                        <p className="text-xs text-gray-500">{item.quantity} units · {fmtVal(value)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* AI Modules Notice */}
      <div className="card border-dashed border-surface-500 mt-4">
        <h3 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2">
          <span>🤖</span> AI Modules — Coming in Part 3
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {['Demand Forecasting', 'Redistribution Engine', 'Spoilage Prediction', 'Anomaly Detection', 'Waste Analytics'].map(m => (
            <div key={m} className="text-center py-2 rounded-lg bg-surface-700/30 border border-surface-700">
              <p className="text-xs text-gray-600 font-medium">{m}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}

export default DashboardPage
