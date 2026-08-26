import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import StockStatusBadge from '../components/StockStatusBadge'
import Modal from '../components/Modal'
import { getInventoryById, adjustInventory } from '../api/inventory'
import { recordSpoilage } from '../api/spoilage'
import { useAuth } from '../context/AuthContext'

const fmt = (n) => n == null ? '—' : Number(n).toLocaleString('en-IN')
const fmtVal = (n) => n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const TXN_BADGE = {
  INCOMING:   'badge-incoming',
  OUTGOING:   'badge-outgoing',
  ADJUSTMENT: 'badge-adjustment',
  SPOILAGE:   'badge-spoilage',
  INITIAL:    'badge',
}
const TXN_ICONS = { INCOMING: '↑', OUTGOING: '↓', ADJUSTMENT: '⇄', SPOILAGE: '🗑', INITIAL: '●' }

const InventoryDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canWrite = ['SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN'].includes(user?.role)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Adjust modal
  const [adjustModal, setAdjustModal] = useState(false)
  const [adjustForm, setAdjustForm] = useState({ quantity: '', reorder_threshold: '', expiry_date: '', reason: '' })
  const [adjusting, setAdjusting] = useState(false)
  const [adjustError, setAdjustError] = useState('')
  const [adjustSuccess, setAdjustSuccess] = useState('')

  // Spoilage modal
  const [spoilageModal, setSpoilageModal] = useState(false)
  const [spoilForm, setSpoilForm] = useState({ quantity: '', reason: '', event_date: '' })
  const [spoiling, setSpoiling] = useState(false)
  const [spoilError, setSpoilError] = useState('')
  const [spoilSuccess, setSpoilSuccess] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const r = await getInventoryById(id)
      setData(r.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load inventory record')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const openAdjust = () => {
    const inv = data?.inventory
    setAdjustForm({
      quantity: String(inv?.quantity ?? ''),
      reorder_threshold: String(inv?.reorder_threshold ?? ''),
      expiry_date: inv?.expiry_date || '',
      reason: '',
    })
    setAdjustError('')
    setAdjustSuccess('')
    setAdjustModal(true)
  }

  const handleAdjust = async (e) => {
    e.preventDefault()
    setAdjustError('')
    setAdjusting(true)
    try {
      const payload = {}
      if (adjustForm.quantity !== '') payload.quantity = parseInt(adjustForm.quantity)
      if (adjustForm.reorder_threshold !== '') payload.reorder_threshold = parseInt(adjustForm.reorder_threshold)
      if (adjustForm.expiry_date) payload.expiry_date = adjustForm.expiry_date
      if (adjustForm.reason) payload.reason = adjustForm.reason
      await adjustInventory(id, payload)
      setAdjustSuccess('Inventory adjusted successfully!')
      setTimeout(() => { setAdjustModal(false); load() }, 1200)
    } catch (err) {
      setAdjustError(err.response?.data?.message || 'Adjustment failed')
    } finally {
      setAdjusting(false)
    }
  }

  const handleSpoilage = async (e) => {
    e.preventDefault()
    setSpoilError('')
    setSpoiling(true)
    try {
      await recordSpoilage({
        node_id: data.inventory.node_id,
        product_id: data.inventory.product_id,
        quantity: parseInt(spoilForm.quantity),
        reason: spoilForm.reason,
        event_date: spoilForm.event_date || undefined,
      })
      setSpoilSuccess('Spoilage recorded successfully!')
      setTimeout(() => { setSpoilageModal(false); load() }, 1200)
    } catch (err) {
      setSpoilError(err.response?.data?.message || 'Failed to record spoilage')
    } finally {
      setSpoiling(false)
    }
  }

  if (loading) {
    return (
      <Layout title="Inventory Detail">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-700 rounded w-1/3" />
          <div className="h-48 bg-surface-700 rounded" />
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout title="Inventory Detail">
        <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300">⚠️ {error}</div>
        <button onClick={() => navigate(-1)} className="btn-ghost mt-4">← Back</button>
      </Layout>
    )
  }

  const inv = data?.inventory
  const txns = data?.transactions || []

  return (
    <Layout title="Inventory Detail">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost py-2 px-3 text-sm">← Back</button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">{inv?.product?.name}</h1>
              <StockStatusBadge status={inv?.stock_status} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              <code className="text-brand-400">{inv?.product?.sku}</code> · {inv?.node?.name}
            </p>
          </div>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <button onClick={openAdjust} className="btn-secondary text-sm py-2 px-4">Adjust Stock</button>
            <button onClick={() => { setSpoilForm({ quantity: '', reason: '', event_date: '' }); setSpoilError(''); setSpoilSuccess(''); setSpoilageModal(true) }} className="btn-danger text-sm py-2 px-4">Record Spoilage</button>
          </div>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Product info */}
        <div className="card space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Info</h3>
          <div className="space-y-2">
            {[
              ['SKU', <code className="text-brand-400 text-xs">{inv?.product?.sku}</code>],
              ['Category', inv?.product?.category],
              ['Shelf Life', `${inv?.product?.shelf_life_days} days`],
              ['Unit Cost', fmtVal(inv?.product?.unit_cost)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-surface-700 last:border-0">
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-xs text-gray-200 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stock info */}
        <div className="card space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock Info</h3>
          <div className="space-y-2">
            {[
              ['Current Quantity', <span className="text-xl font-bold text-white">{fmt(inv?.quantity)}</span>],
              ['Reorder Threshold', inv?.reorder_threshold],
              ['Expiry Date', inv?.expiry_date ? new Date(inv.expiry_date).toLocaleDateString('en-IN') : '—'],
              ['Days Until Expiry', inv?.days_until_expiry != null ? (inv.days_until_expiry <= 0 ? <span className="text-red-400">Expired</span> : `${inv.days_until_expiry} days`) : '—'],
              ['Last Updated', fmtDate(inv?.last_updated)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-surface-700 last:border-0">
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-xs text-gray-200 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Node + Value */}
        <div className="card space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Node & Value</h3>
          <div className="space-y-2">
            {[
              ['Node', inv?.node?.name],
              ['Node Type', inv?.node?.type?.replace(/_/g, ' ')],
              ['Location', inv?.node?.location],
              ['Inventory Value', <span className="text-green-400 font-semibold">{fmtVal(inv?.inventory_value)}</span>],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-surface-700 last:border-0">
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-xs text-gray-200 font-medium text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-600">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="text-brand-400">📋</span> Activity History
          </h3>
        </div>
        {txns.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">No activity history yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-surface-600 bg-surface-900/50">
                <tr>
                  <th className="table-header">Date/Time</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Change</th>
                  <th className="table-header">Before</th>
                  <th className="table-header">After</th>
                  <th className="table-header">User</th>
                  <th className="table-header">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700">
                {txns.map(txn => (
                  <tr key={txn.id} className="hover:bg-surface-700/30">
                    <td className="table-cell text-xs text-gray-400">{fmtDate(txn.created_at)}</td>
                    <td className="table-cell">
                      <span className={TXN_BADGE[txn.transaction_type] || 'badge'}>
                        {TXN_ICONS[txn.transaction_type]} {txn.transaction_type}
                      </span>
                    </td>
                    <td className="table-cell font-semibold">
                      <span className={txn.quantity_change > 0 ? 'text-green-400' : 'text-red-400'}>
                        {txn.quantity_change > 0 ? '+' : ''}{txn.quantity_change}
                      </span>
                    </td>
                    <td className="table-cell text-gray-400">{txn.quantity_before}</td>
                    <td className="table-cell text-gray-200">{txn.quantity_after}</td>
                    <td className="table-cell text-gray-400 text-xs">{txn.user?.name || '—'}</td>
                    <td className="table-cell text-gray-500 text-xs max-w-xs truncate">{txn.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjust Modal */}
      <Modal isOpen={adjustModal} onClose={() => setAdjustModal(false)} title="⇄ Adjust Inventory">
        <form onSubmit={handleAdjust} className="space-y-4">
          {adjustError && <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">{adjustError}</div>}
          {adjustSuccess && <div className="p-3 bg-green-900/30 border border-green-700/50 rounded-lg text-green-300 text-sm">✅ {adjustSuccess}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">New Quantity</label>
            <input type="number" min="0" value={adjustForm.quantity} onChange={e => setAdjustForm(f => ({ ...f, quantity: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Reorder Threshold</label>
            <input type="number" min="0" value={adjustForm.reorder_threshold} onChange={e => setAdjustForm(f => ({ ...f, reorder_threshold: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Expiry Date</label>
            <input type="date" value={adjustForm.expiry_date} onChange={e => setAdjustForm(f => ({ ...f, expiry_date: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Reason</label>
            <input type="text" value={adjustForm.reason} onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason for adjustment..." className="input-field" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setAdjustModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={adjusting} className="btn-primary flex-1">
              {adjusting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Spoilage Modal */}
      <Modal isOpen={spoilageModal} onClose={() => setSpoilageModal(false)} title="🗑 Record Spoilage">
        <form onSubmit={handleSpoilage} className="space-y-4">
          {spoilError && <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">{spoilError}</div>}
          {spoilSuccess && <div className="p-3 bg-green-900/30 border border-green-700/50 rounded-lg text-green-300 text-sm">✅ {spoilSuccess}</div>}
          <div className="p-3 bg-surface-700 rounded-lg text-sm text-gray-400">
            Available stock: <span className="text-white font-semibold">{inv?.quantity} units</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Spoilage Quantity</label>
            <input type="number" min="1" max={inv?.quantity} value={spoilForm.quantity} onChange={e => setSpoilForm(f => ({ ...f, quantity: e.target.value }))} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Reason</label>
            <select value={spoilForm.reason} onChange={e => setSpoilForm(f => ({ ...f, reason: e.target.value }))} className="select-field" required>
              <option value="">Select reason...</option>
              <option value="EXPIRED">Expired</option>
              <option value="DAMAGED">Damaged</option>
              <option value="CONTAMINATED">Contaminated</option>
              <option value="QUALITY_FAILURE">Quality Failure</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Event Date</label>
            <input type="date" value={spoilForm.event_date} onChange={e => setSpoilForm(f => ({ ...f, event_date: e.target.value }))} className="input-field" />
          </div>
          {spoilForm.quantity && inv?.product?.unit_cost && (
            <div className="p-3 bg-red-900/20 border border-red-800/30 rounded-lg">
              <p className="text-xs text-gray-400">Estimated Loss</p>
              <p className="text-lg font-bold text-red-400">
                {fmtVal(parseInt(spoilForm.quantity) * parseFloat(inv.product.unit_cost))}
              </p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setSpoilageModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={spoiling} className="btn-danger flex-1">
              {spoiling ? 'Recording...' : 'Record Spoilage'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  )
}

export default InventoryDetailPage
