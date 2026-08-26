import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import StockStatusBadge from '../components/StockStatusBadge'
import Pagination from '../components/Pagination'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { getInventory, getInventoryOverview, incomingShipment, outgoingShipment } from '../api/inventory'
import { getNodes } from '../api/nodes'
import { getProducts } from '../api/products'
import { useAuth } from '../context/AuthContext'

const fmt = (n) => n == null ? '—' : Number(n).toLocaleString('en-IN')
const fmtVal = (n) => n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const CATEGORIES = ['Dairy', 'Bakery', 'Vegetables', 'Fruits', 'Grains', 'Pulses', 'Meat & Poultry', 'Oils', 'Beverages', 'Snacks']
const STATUSES = ['', 'LOW_STOCK', 'OVERSTOCKED', 'NEAR_EXPIRY', 'CRITICAL', 'HEALTHY']
const STATUS_LABELS = { '': 'All Status', LOW_STOCK: 'Low Stock', OVERSTOCKED: 'Overstocked', NEAR_EXPIRY: 'Near Expiry', CRITICAL: 'Critical', HEALTHY: 'Healthy' }

const SortBtn = ({ field, current, order, onSort }) => {
  const active = current === field
  return (
    <button onClick={() => onSort(field)} className="group inline-flex items-center gap-1 hover:text-white transition-colors">
      {active ? (order === 'ASC' ? '↑' : '↓') : <span className="opacity-0 group-hover:opacity-50">↕</span>}
    </button>
  )
}

const InventoryPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const canWrite = ['SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN'].includes(user?.role)

  // Filters & pagination
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [nodeFilter, setNodeFilter] = useState('')
  const [sort, setSort] = useState('last_updated')
  const [order, setOrder] = useState('DESC')

  // Data
  const [inventory, setInventory] = useState([])
  const [pagination, setPagination] = useState({})
  const [overview, setOverview] = useState(null)
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal state
  const [shipModal, setShipModal] = useState(null) // 'incoming' | 'outgoing'
  const [shipForm, setShipForm] = useState({ node_id: '', product_id: '', quantity: '', reason: '', reference: '' })
  const [products, setProducts] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [shipError, setShipError] = useState('')
  const [shipSuccess, setShipSuccess] = useState('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
    return () => clearTimeout(timer)
  }, [search])

  // Reset page on filter changes
  useEffect(() => { setPage(1) }, [category, status, nodeFilter, sort, order])

  // Load overview
  useEffect(() => {
    getInventoryOverview().then(r => setOverview(r.data)).catch(() => {})
  }, [])

  // Load filter options
  useEffect(() => {
    getNodes().then(r => setNodes(r.data.nodes || [])).catch(() => {})
    getProducts({ limit: 200 }).then(r => setProducts(r.data.products || [])).catch(() => {})
  }, [])

  // Load inventory
  const loadInventory = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = { page, limit: 20, sort, order }
      if (debouncedSearch) params.search = debouncedSearch
      if (category) params.category = category
      if (status) params.status = status
      if (nodeFilter) params.node_id = nodeFilter
      const r = await getInventory(params)
      setInventory(r.data.inventory)
      setPagination(r.data.pagination)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, category, status, nodeFilter, sort, order])

  useEffect(() => { loadInventory() }, [loadInventory])

  const handleSort = (field) => {
    if (sort === field) setOrder(o => o === 'ASC' ? 'DESC' : 'ASC')
    else { setSort(field); setOrder('ASC') }
  }

  const openShipModal = (type) => {
    setShipModal(type)
    setShipForm({
      node_id: user?.role === 'WAREHOUSE_ADMIN' ? String(user.node_id) : '',
      product_id: '', quantity: '', reason: '', reference: ''
    })
    setShipError('')
    setShipSuccess('')
  }

  const handleShipSubmit = async (e) => {
    e.preventDefault()
    setShipError('')
    setShipSuccess('')
    if (!shipForm.node_id || !shipForm.product_id || !shipForm.quantity) {
      setShipError('Node, product, and quantity are required')
      return
    }
    setSubmitting(true)
    try {
      const fn = shipModal === 'incoming' ? incomingShipment : outgoingShipment
      await fn({ ...shipForm, node_id: parseInt(shipForm.node_id), product_id: parseInt(shipForm.product_id), quantity: parseInt(shipForm.quantity) })
      setShipSuccess(`${shipModal === 'incoming' ? 'Incoming' : 'Outgoing'} shipment recorded successfully!`)
      setTimeout(() => { setShipModal(null); loadInventory() }, 1500)
    } catch (err) {
      setShipError(err.response?.data?.message || 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const isNearExpiry = (d) => {
    if (!d) return false
    return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24)) <= 7
  }

  return (
    <Layout title="Inventory">
      {/* Overview KPIs */}
      <div className="mb-6">
        <h1 className="text-lg font-bold text-white">Inventory Management</h1>
        <p className="text-sm text-gray-400">Real-time stock levels, expiry dates, and warehouse capacity</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard title="Total Units" value={fmt(overview?.total_units)} icon="🗄️" colorClass="text-brand-400" bgClass="bg-brand-900/30" />
        <StatCard title="Inventory Value" value={fmtVal(overview?.total_value)} icon="💰" colorClass="text-green-400" bgClass="bg-green-900/30" />
        <StatCard title="Low Stock" value={fmt(overview?.low_stock_count)} icon="📉" colorClass={overview?.low_stock_count > 0 ? 'text-yellow-400' : 'text-gray-400'} bgClass={overview?.low_stock_count > 0 ? 'bg-yellow-900/30' : 'bg-surface-700'} />
        <StatCard title="Near Expiry" value={fmt(overview?.near_expiry_count)} icon="⏳" colorClass={overview?.near_expiry_count > 0 ? 'text-orange-400' : 'text-gray-400'} bgClass={overview?.near_expiry_count > 0 ? 'bg-orange-900/30' : 'bg-surface-700'} />
        <StatCard title="Overstocked" value={fmt(overview?.overstock_count)} icon="📈" colorClass={overview?.overstock_count > 0 ? 'text-blue-400' : 'text-gray-400'} bgClass={overview?.overstock_count > 0 ? 'bg-blue-900/30' : 'bg-surface-700'} />
      </div>

      {/* Filters + Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search SKU or product..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field w-52 text-sm py-2"
        />
        <select value={category} onChange={e => setCategory(e.target.value)} className="select-field w-40 text-sm py-2">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="select-field w-40 text-sm py-2">
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        {user?.role === 'SUPPLY_CHAIN_MANAGER' && (
          <select value={nodeFilter} onChange={e => setNodeFilter(e.target.value)} className="select-field w-48 text-sm py-2">
            <option value="">All Nodes</option>
            {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        )}
        {(search || category || status || nodeFilter) && (
          <button
            onClick={() => { setSearch(''); setCategory(''); setStatus(''); setNodeFilter('') }}
            className="btn-ghost text-sm py-2 px-3 text-xs"
          >
            Clear ✕
          </button>
        )}

        {canWrite && (
          <div className="ml-auto flex gap-2">
            <button onClick={() => openShipModal('incoming')} className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
              <span>+ Incoming</span>
            </button>
            <button onClick={() => openShipModal('outgoing')} className="btn-secondary text-sm py-2 px-4 flex items-center gap-1.5">
              <span>- Outgoing</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3.5 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">⚠️ {error}</div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-surface-600 bg-surface-900/50">
              <tr>
                <th className="table-header">
                  <span className="flex items-center gap-1">SKU</span>
                </th>
                <th className="table-header">
                  Product <SortBtn field="product_name" current={sort} order={order} onSort={handleSort} />
                </th>
                <th className="table-header">Category</th>
                <th className="table-header">Node <SortBtn field="node_name" current={sort} order={order} onSort={handleSort} /></th>
                <th className="table-header">
                  Stock <SortBtn field="quantity" current={sort} order={order} onSort={handleSort} />
                </th>
                <th className="table-header">Threshold</th>
                <th className="table-header">
                  Expiry <SortBtn field="expiry_date" current={sort} order={order} onSort={handleSort} />
                </th>
                <th className="table-header">Status</th>
                <th className="table-header">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="table-cell">
                        <div className="h-4 bg-surface-700 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState icon="📦" title="No inventory records found" subtitle="Try adjusting your filters or search terms" />
                  </td>
                </tr>
              ) : (
                inventory.map(item => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-700/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/inventory/${item.id}`)}
                  >
                    <td className="table-cell">
                      <code className="text-xs bg-surface-700 px-1.5 py-0.5 rounded text-brand-400">
                        {item.product?.sku}
                      </code>
                    </td>
                    <td className="table-cell font-medium text-white">{item.product?.name}</td>
                    <td className="table-cell text-gray-400 text-xs">{item.product?.category}</td>
                    <td className="table-cell text-gray-300 text-xs">{item.node?.name}</td>
                    <td className="table-cell font-semibold text-gray-100">{fmt(item.quantity)}</td>
                    <td className="table-cell text-gray-500 text-xs">{item.reorder_threshold}</td>
                    <td className="table-cell">
                      {item.expiry_date ? (
                        <span className={`text-xs ${isNearExpiry(item.expiry_date) ? 'text-orange-400 font-medium' : 'text-gray-400'}`}>
                          {isNearExpiry(item.expiry_date) && '⚠️ '}
                          {new Date(item.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </span>
                      ) : <span className="text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="table-cell">
                      <StockStatusBadge status={item.stock_status} />
                    </td>
                    <td className="table-cell text-green-400 font-medium text-xs">
                      {fmtVal(item.inventory_value)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      {/* Shipment Modal */}
      <Modal
        isOpen={!!shipModal}
        onClose={() => setShipModal(null)}
        title={shipModal === 'incoming' ? '📦 Record Incoming Shipment' : '🚚 Record Outgoing Shipment'}
      >
        <form onSubmit={handleShipSubmit} className="space-y-4">
          {shipError && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">{shipError}</div>
          )}
          {shipSuccess && (
            <div className="p-3 bg-green-900/30 border border-green-700/50 rounded-lg text-green-300 text-sm">✅ {shipSuccess}</div>
          )}

          {user?.role === 'SUPPLY_CHAIN_MANAGER' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Node</label>
              <select value={shipForm.node_id} onChange={e => setShipForm(f => ({ ...f, node_id: e.target.value }))} className="select-field" required>
                <option value="">Select node...</option>
                {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
          )}
          {user?.role === 'WAREHOUSE_ADMIN' && (
            <div className="p-3 bg-surface-700 rounded-lg text-sm text-gray-400">
              📍 Node: <span className="text-white font-medium">{user.node?.name}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Product</label>
            <select value={shipForm.product_id} onChange={e => setShipForm(f => ({ ...f, product_id: e.target.value }))} className="select-field" required>
              <option value="">Select product...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Quantity</label>
            <input
              type="number"
              min="1"
              value={shipForm.quantity}
              onChange={e => setShipForm(f => ({ ...f, quantity: e.target.value }))}
              className="input-field"
              placeholder="Enter quantity..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Reason</label>
            <input
              type="text"
              value={shipForm.reason}
              onChange={e => setShipForm(f => ({ ...f, reason: e.target.value }))}
              className="input-field"
              placeholder="e.g., Weekly restocking, Customer order..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Reference / PO Number</label>
            <input
              type="text"
              value={shipForm.reference}
              onChange={e => setShipForm(f => ({ ...f, reference: e.target.value }))}
              className="input-field"
              placeholder="Optional reference number..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShipModal(null)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={`flex-1 flex items-center justify-center gap-2 ${shipModal === 'incoming' ? 'btn-primary' : 'btn-danger'}`}>
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing...</>
              ) : (shipModal === 'incoming' ? 'Record Incoming' : 'Record Outgoing')}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  )
}

export default InventoryPage
