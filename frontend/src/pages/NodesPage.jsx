import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { getNodes } from '../api/nodes'
import { useAuth } from '../context/AuthContext'

const TYPE_CONFIG = {
  WAREHOUSE: { icon: '🏭', color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-800/40' },
  RETAIL_STORE: { icon: '🏪', color: 'text-green-400', bg: 'bg-green-900/20 border-green-800/40' },
  DISTRIBUTION_CENTRE: { icon: '🚚', color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-800/40' },
}

const STATUS_BADGE = {
  ACTIVE: 'badge-active',
  INACTIVE: 'badge',
  MAINTENANCE: 'badge-warning',
}

const NodesPage = () => {
  const { user } = useAuth()
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchNodes = async () => {
      try {
        setLoading(true)
        const data = await getNodes()
        setNodes(data.data.nodes)
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load nodes')
      } finally {
        setLoading(false)
      }
    }
    fetchNodes()
  }, [])

  const title = user?.role === 'WAREHOUSE_ADMIN' ? 'My Node' : 'Nodes'

  return (
    <Layout title={title}>
      <div className="mb-5">
        <h1 className="text-lg font-bold text-white">
          {user?.role === 'SUPPLY_CHAIN_MANAGER' ? 'Supply Chain Network' : 'My Assigned Node'}
        </h1>
        <p className="text-sm text-gray-400">
          {user?.role === 'SUPPLY_CHAIN_MANAGER'
            ? `${nodes.length} nodes in the network`
            : 'Your assigned supply chain node'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3.5 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">⚠️ {error}</div>
      )}

      {/* Summary for managers */}
      {!loading && user?.role === 'SUPPLY_CHAIN_MANAGER' && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {['WAREHOUSE', 'RETAIL_STORE', 'DISTRIBUTION_CENTRE'].map(type => {
            const conf = TYPE_CONFIG[type]
            const count = nodes.filter(n => n.type === type).length
            return (
              <div key={type} className={`card border ${conf.bg}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{conf.icon}</span>
                  <div>
                    <p className={`text-2xl font-bold ${conf.color}`}>{count}</p>
                    <p className="text-xs text-gray-500">{type.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="card h-40 animate-pulse">
              <div className="h-5 bg-surface-700 rounded w-3/4 mb-3" />
              <div className="h-4 bg-surface-700 rounded w-1/2 mb-2" />
              <div className="h-4 bg-surface-700 rounded w-2/3" />
            </div>
          ))
        ) : nodes.length === 0 ? (
          <div className="col-span-full text-center py-16 text-gray-500">No nodes found.</div>
        ) : (
          nodes.map(node => {
            const conf = TYPE_CONFIG[node.type] || { icon: '📍', color: 'text-gray-400', bg: '' }
            return (
              <div key={node.id} className={`card hover:border-surface-500 transition-all duration-200`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{conf.icon}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{node.name}</h3>
                      <p className={`text-xs ${conf.color} font-medium`}>
                        {node.type.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                  <span className={STATUS_BADGE[node.status] || 'badge'}>{node.status}</span>
                </div>

                <div className="space-y-2 mt-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>📍</span>
                    <span>{node.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>📦</span>
                    <span>Capacity: <span className="text-gray-200 font-medium">{node.capacity.toLocaleString()}</span> units</span>
                  </div>
                  {user?.node_id === node.id && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-brand-400 bg-brand-900/20 px-2.5 py-1 rounded-md border border-brand-800/40 w-fit">
                      <span>✓</span> Your assigned node
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </Layout>
  )
}

export default NodesPage
