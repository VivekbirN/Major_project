import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { getInventory } from '../api/inventory'

const statusColor = (quantity, threshold) => {
  if (quantity <= 0) return 'text-red-400'
  if (quantity <= threshold) return 'text-yellow-400'
  if (quantity > threshold * 5) return 'text-blue-400'
  return 'text-green-400'
}

const statusLabel = (quantity, threshold) => {
  if (quantity <= 0) return { label: 'Out of Stock', cls: 'badge-danger' }
  if (quantity <= threshold) return { label: 'Low Stock', cls: 'badge-warning' }
  if (quantity > threshold * 5) return { label: 'Overstock', cls: 'badge-info' }
  return { label: 'In Stock', cls: 'badge-active' }
}

const isNearExpiry = (expiryDate) => {
  if (!expiryDate) return false
  const today = new Date()
  const expiry = new Date(expiryDate)
  const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
  return diff <= 7
}

const InventoryPage = () => {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({})
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchInventory()
  }, [page])

  const fetchInventory = async () => {
    try {
      setLoading(true)
      const data = await getInventory({ page, limit: 20 })
      setInventory(data.data.inventory)
      setPagination(data.data.pagination)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  const filtered = inventory.filter(item =>
    !search ||
    item.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
    item.product?.sku?.toLowerCase().includes(search.toLowerCase()) ||
    item.node?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout title="Inventory">
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Inventory Overview</h1>
          <p className="text-sm text-gray-400">Real-time stock levels across all nodes</p>
        </div>
        <input
          type="text"
          placeholder="Search by product or node..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field sm:w-64"
        />
      </div>

      {error && (
        <div className="mb-4 p-3.5 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">⚠️ {error}</div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-surface-600 bg-surface-900/50">
              <tr>
                <th className="table-header">Product</th>
                <th className="table-header">SKU</th>
                <th className="table-header">Node</th>
                <th className="table-header">Category</th>
                <th className="table-header">Quantity</th>
                <th className="table-header">Threshold</th>
                <th className="table-header">Expiry</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="table-cell">
                        <div className="h-4 bg-surface-700 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-12 text-gray-500">
                    No inventory records found.
                  </td>
                </tr>
              ) : (
                filtered.map(item => {
                  const { label, cls } = statusLabel(item.quantity, item.reorder_threshold)
                  const nearExpiry = isNearExpiry(item.expiry_date)
                  return (
                    <tr key={item.id} className="hover:bg-surface-700/50 transition-colors">
                      <td className="table-cell font-medium text-white">{item.product?.name}</td>
                      <td className="table-cell">
                        <code className="text-xs bg-surface-700 px-1.5 py-0.5 rounded text-brand-400">
                          {item.product?.sku}
                        </code>
                      </td>
                      <td className="table-cell text-gray-300">{item.node?.name}</td>
                      <td className="table-cell text-gray-400 text-xs">{item.product?.category}</td>
                      <td className={`table-cell font-semibold ${statusColor(item.quantity, item.reorder_threshold)}`}>
                        {item.quantity.toLocaleString()}
                      </td>
                      <td className="table-cell text-gray-500 text-sm">{item.reorder_threshold}</td>
                      <td className="table-cell">
                        {item.expiry_date ? (
                          <span className={`text-xs font-medium ${nearExpiry ? 'text-orange-400' : 'text-gray-400'}`}>
                            {nearExpiry && '⚠️ '}
                            {new Date(item.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className={cls}>{label}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-600">
            <p className="text-xs text-gray-500">
              Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total} records
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
                className="btn-ghost text-xs py-1 px-3 disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= pagination.totalPages}
                className="btn-ghost text-xs py-1 px-3 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default InventoryPage
