import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { detectAnomaly, getSpoilagePrediction } from '../api/ml'
import { getInventory } from '../api/inventory'
import { getNodes } from '../api/nodes'
import { getProducts } from '../api/products'
import { useAuth } from '../context/AuthContext'

const SEVERITY_BADGE = {
  CRITICAL: 'badge-critical',
  HIGH: 'badge-danger',
  MEDIUM: 'badge-warning',
  LOW: 'badge-info',
}

const RISK_BADGE = {
  CRITICAL: 'badge-critical',
  HIGH: 'badge-danger',
  MEDIUM: 'badge-warning',
  LOW: 'badge-healthy',
}

const AlertsPage = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('anomalies') // 'anomalies' | 'spoilage'
  
  const [nodes, setNodes] = useState([])
  const [products, setProducts] = useState([])
  const [inventoryList, setInventoryList] = useState([])

  // Anomaly Scanner Form
  const [anomalyForm, setAnomalyForm] = useState({
    node_id: '',
    product_id: '',
    recent_sales: 45,
    rolling_mean: 15,
    stockout_ratio: 0.0,
    persist_alert: true,
  })
  const [scanning, setScanning] = useState(false)
  const [anomalyResult, setAnomalyResult] = useState(null)
  const [anomalyHistory, setAnomalyHistory] = useState([])

  // Spoilage Scanner Form
  const [spoilageForm, setSpoilageForm] = useState({
    selected_inventory_id: '',
    days_to_expiry: 3,
    product_shelf_life: 7,
    inventory_quantity: 120,
    temperature_exposure: 1.2,
    storage_condition: 1,
  })
  const [analyzingSpoilage, setAnalyzingSpoilage] = useState(false)
  const [spoilageResult, setSpoilageResult] = useState(null)

  const [error, setError] = useState(null)

  useEffect(() => {
    getNodes().then((r) => {
      const list = r.data.nodes || []
      setNodes(list)
      if (list.length > 0 && !anomalyForm.node_id) {
        setAnomalyForm((f) => ({ ...f, node_id: String(list[0].id) }))
      }
    }).catch(() => {})

    getProducts({ limit: 100 }).then((r) => {
      const list = r.data.products || []
      setProducts(list)
      if (list.length > 0 && !anomalyForm.product_id) {
        setAnomalyForm((f) => ({ ...f, product_id: String(list[0].id) }))
      }
    }).catch(() => {})

    getInventory({ limit: 100 }).then((r) => {
      const items = r.data.inventory || []
      setInventoryList(items)
      if (items.length > 0) {
        const item = items[0]
        setSpoilageForm({
          selected_inventory_id: String(item.id),
          days_to_expiry: item.days_until_expiry ?? 3,
          product_shelf_life: item.product?.shelf_life_days ?? 7,
          inventory_quantity: item.quantity ?? 100,
          temperature_exposure: 1.0,
          storage_condition: 0,
        })
      }
    }).catch(() => {})
  }, [])

  const handleRunAnomalyScan = async (e) => {
    if (e) e.preventDefault()
    setScanning(true)
    setError(null)
    try {
      const res = await detectAnomaly({
        node_id: anomalyForm.node_id ? parseInt(anomalyForm.node_id) : undefined,
        product_id: anomalyForm.product_id ? parseInt(anomalyForm.product_id) : undefined,
        recent_sales: parseFloat(anomalyForm.recent_sales),
        rolling_mean: parseFloat(anomalyForm.rolling_mean),
        stockout_ratio: parseFloat(anomalyForm.stockout_ratio),
        persist_alert: anomalyForm.persist_alert,
      })
      setAnomalyResult(res.data)
      setAnomalyHistory((prev) => [
        {
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          node_name: nodes.find((n) => String(n.id) === String(anomalyForm.node_id))?.name || 'Node',
          product_name: products.find((p) => String(p.id) === String(anomalyForm.product_id))?.name || 'Product',
          ...res.data.anomaly,
        },
        ...prev,
      ])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Anomaly scan failed')
    } finally {
      setScanning(false)
    }
  }

  const handleRunSpoilageScan = async (e) => {
    if (e) e.preventDefault()
    setAnalyzingSpoilage(true)
    setError(null)
    try {
      const res = await getSpoilagePrediction({
        days_to_expiry: parseFloat(spoilageForm.days_to_expiry),
        product_shelf_life: parseFloat(spoilageForm.product_shelf_life),
        inventory_quantity: parseInt(spoilageForm.inventory_quantity),
        temperature_exposure: parseFloat(spoilageForm.temperature_exposure),
        storage_condition: parseInt(spoilageForm.storage_condition),
      })
      setSpoilageResult(res.data)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Spoilage risk analysis failed')
    } finally {
      setAnalyzingSpoilage(false)
    }
  }

  const handleSelectInventoryItem = (invId) => {
    const item = inventoryList.find((i) => String(i.id) === String(invId))
    if (item) {
      setSpoilageForm({
        selected_inventory_id: String(item.id),
        days_to_expiry: item.days_until_expiry !== null ? item.days_until_expiry : 3,
        product_shelf_life: item.product?.shelf_life_days || 7,
        inventory_quantity: item.quantity || 100,
        temperature_exposure: 1.0,
        storage_condition: 0,
      })
    }
  }

  return (
    <Layout title="AI Alerts & Risk Center">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">AI Alerts & Spoilage Intelligence</h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time anomaly detection via Isolation Forest and perishable risk assessment
          </p>
        </div>
        {/* Tab switch */}
        <div className="flex bg-surface-800 p-1 rounded-xl border border-surface-600">
          <button
            onClick={() => setActiveTab('anomalies')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'anomalies'
                ? 'bg-brand-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🛡️ Anomaly Detection
          </button>
          <button
            onClick={() => setActiveTab('spoilage')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'spoilage'
                ? 'bg-brand-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🧪 Spoilage Risk Analyzer
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-4 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-gray-400 hover:text-white">✕</button>
        </div>
      )}

      {/* ── TAB 1: ANOMALY DETECTION ───────────────────────────────────────── */}
      {activeTab === 'anomalies' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Control Panel */}
            <div className="card space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2 pb-2 border-b border-surface-600">
                <span>🔍</span> Isolation Forest Anomaly Scan
              </h2>

              <form onSubmit={handleRunAnomalyScan} className="space-y-3.5">
                <div>
                  <label htmlFor="alerts-node-select" className="block text-xs font-medium text-gray-400 mb-1">Target Node</label>
                  <select
                    id="alerts-node-select"
                    aria-label="Target Node"
                    value={anomalyForm.node_id}
                    onChange={(e) => setAnomalyForm((f) => ({ ...f, node_id: e.target.value }))}
                    className="select-field text-sm"
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="alerts-product-select" className="block text-xs font-medium text-gray-400 mb-1">Target Product</label>
                  <select
                    id="alerts-product-select"
                    aria-label="Target Product"
                    value={anomalyForm.product_id}
                    onChange={(e) => setAnomalyForm((f) => ({ ...f, product_id: e.target.value }))}
                    className="select-field text-sm"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} [{p.sku}]</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="alerts-recent-sales-input" className="block text-xs font-medium text-gray-400 mb-1">Recent 24h Sales</label>
                    <input
                      id="alerts-recent-sales-input"
                      type="number"
                      value={anomalyForm.recent_sales}
                      onChange={(e) => setAnomalyForm((f) => ({ ...f, recent_sales: e.target.value }))}
                      className="input-field text-sm py-2"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="alerts-rolling-mean-input" className="block text-xs font-medium text-gray-400 mb-1">7-Day Mean (Baseline)</label>
                    <input
                      id="alerts-rolling-mean-input"
                      type="number"
                      value={anomalyForm.rolling_mean}
                      onChange={(e) => setAnomalyForm((f) => ({ ...f, rolling_mean: e.target.value }))}
                      className="input-field text-sm py-2"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Stockout Ratio</span>
                    <span className="text-yellow-400 font-semibold">{Math.round(anomalyForm.stockout_ratio * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={anomalyForm.stockout_ratio}
                    onChange={(e) => setAnomalyForm((f) => ({ ...f, stockout_ratio: parseFloat(e.target.value) }))}
                    className="w-full accent-yellow-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="persist_chk"
                    checked={anomalyForm.persist_alert}
                    onChange={(e) => setAnomalyForm((f) => ({ ...f, persist_alert: e.target.checked }))}
                    className="w-4 h-4 rounded accent-brand-500"
                  />
                  <label htmlFor="persist_chk" className="text-xs text-gray-300 cursor-pointer">
                    Persist confirmed anomaly to database alert feed
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={scanning}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 mt-2"
                >
                  {scanning ? 'Running Detection...' : 'Run Anomaly Detector'}
                </button>
              </form>
            </div>

            {/* Results Display */}
            <div className="lg:col-span-2 space-y-4">
              {anomalyResult ? (
                <div className={`card border-l-4 ${
                  anomalyResult.anomaly.is_anomaly
                    ? anomalyResult.anomaly.severity === 'CRITICAL'
                      ? 'border-l-red-500 bg-red-950/20'
                      : 'border-l-amber-500 bg-amber-950/20'
                    : 'border-l-emerald-500 bg-emerald-950/20'
                }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {anomalyResult.anomaly.is_anomaly ? '🚨' : '✅'}
                        </span>
                        <h3 className="text-base font-bold text-white">
                          {anomalyResult.anomaly.is_anomaly
                            ? `Anomaly Confirmed: ${anomalyResult.anomaly.anomaly_type.replace(/_/g, ' ')}`
                            : 'Normal Operational Pattern'}
                        </h3>
                        <span className={SEVERITY_BADGE[anomalyResult.anomaly.severity] || 'badge'}>
                          {anomalyResult.anomaly.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mt-2 font-medium">
                        {anomalyResult.anomaly.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Isolation Forest Outlier Score: <code className="text-brand-400">{anomalyResult.anomaly.score}</code> (Threshold: &lt; -0.00 is outlier)
                      </p>
                    </div>

                    {anomalyResult.persisted_alert && (
                      <span className="badge bg-purple-900/60 text-purple-300 border border-purple-700/50 text-xs">
                        Saved as Alert #{anomalyResult.persisted_alert.id}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="card p-8 text-center bg-surface-800/60 border-dashed border-surface-600">
                  <span className="text-3xl block mb-2">📡</span>
                  <p className="text-sm text-gray-300 font-medium">Ready for real-time anomaly detection</p>
                  <p className="text-xs text-gray-500 mt-1">Configure sales parameters and click Run Anomaly Detector above</p>
                </div>
              )}

              {/* Anomaly Detection Scan History */}
              <div className="card p-0 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-surface-600">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Recent AI Scan Results
                  </h3>
                </div>
                {anomalyHistory.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-500">
                    No scans performed in this session yet.
                  </div>
                ) : (
                  <div className="divide-y divide-surface-700">
                    {anomalyHistory.map((h) => (
                      <div key={h.id} className="px-5 py-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="text-white font-medium">
                            {h.product_name} · <span className="text-gray-400">{h.node_name}</span>
                          </p>
                          <p className="text-gray-500 mt-0.5">{h.message}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={SEVERITY_BADGE[h.severity] || 'badge'}>{h.severity}</span>
                          <span className="text-gray-500">{h.timestamp}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: SPOILAGE RISK ANALYZER ───────────────────────────────────── */}
      {activeTab === 'spoilage' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 pb-2 border-b border-surface-600">
              <span>🧪</span> Spoilage Risk Parameters
            </h2>

            <form onSubmit={handleRunSpoilageScan} className="space-y-3.5">
              {inventoryList.length > 0 && (
                <div>
                  <label htmlFor="alerts-inventory-sku-select" className="block text-xs font-medium text-gray-400 mb-1">
                    Quick-Fill from Current Inventory SKU
                  </label>
                  <select
                    id="alerts-inventory-sku-select"
                    aria-label="Quick-Fill from Current Inventory SKU"
                    value={spoilageForm.selected_inventory_id}
                    onChange={(e) => handleSelectInventoryItem(e.target.value)}
                    className="select-field text-xs py-1.5"
                  >
                    {inventoryList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.product?.name} ({item.node?.name}) — {item.quantity} units
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="alerts-days-to-expiry-input" className="block text-xs font-medium text-gray-400 mb-1">Days to Expiry</label>
                  <input
                    id="alerts-days-to-expiry-input"
                    type="number"
                    step="0.5"
                    value={spoilageForm.days_to_expiry}
                    onChange={(e) => setSpoilageForm((f) => ({ ...f, days_to_expiry: e.target.value }))}
                    className="input-field text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="alerts-shelf-life-input" className="block text-xs font-medium text-gray-400 mb-1">Shelf Life (Days)</label>
                  <input
                    id="alerts-shelf-life-input"
                    type="number"
                    value={spoilageForm.product_shelf_life}
                    onChange={(e) => setSpoilageForm((f) => ({ ...f, product_shelf_life: e.target.value }))}
                    className="input-field text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="alerts-batch-qty-input" className="block text-xs font-medium text-gray-400 mb-1">Batch Inventory Quantity</label>
                <input
                  id="alerts-batch-qty-input"
                  type="number"
                  value={spoilageForm.inventory_quantity}
                  onChange={(e) => setSpoilageForm((f) => ({ ...f, inventory_quantity: e.target.value }))}
                  className="input-field text-sm"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Temperature Multiplier</span>
                  <span className="text-orange-400 font-semibold">{spoilageForm.temperature_exposure}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="2.2"
                  step="0.1"
                  value={spoilageForm.temperature_exposure}
                  onChange={(e) => setSpoilageForm((f) => ({ ...f, temperature_exposure: parseFloat(e.target.value) }))}
                  className="w-full accent-orange-500 cursor-pointer"
                />
                <p className="text-[11px] text-gray-500 mt-0.5">&gt; 1.2 indicates cold-chain temperature excursion</p>
              </div>

              <div>
                <label htmlFor="alerts-storage-condition-select" className="block text-xs font-medium text-gray-400 mb-1">Storage Condition</label>
                <select
                  id="alerts-storage-condition-select"
                  aria-label="Storage Condition"
                  value={spoilageForm.storage_condition}
                  onChange={(e) => setSpoilageForm((f) => ({ ...f, storage_condition: e.target.value }))}
                  className="select-field text-sm"
                >
                  <option value="0">Optimal Cold Chain (0-4°C)</option>
                  <option value="1">Standard Chilled (5-10°C)</option>
                  <option value="2">Ambient / Elevated (&gt;15°C)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={analyzingSpoilage}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 mt-3"
              >
                {analyzingSpoilage ? 'Analyzing Decay Physics...' : 'Calculate Spoilage Probability'}
              </button>
            </form>
          </div>

          {/* Spoilage Prediction Gauge & Insights */}
          <div className="lg:col-span-2 space-y-4">
            {spoilageResult ? (
              <div className="card space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-surface-600">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>📉</span> Spoilage Risk Assessment
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Operational Decay Physics Model ({spoilageResult.model_info?.name})
                    </p>
                  </div>
                  <span className={RISK_BADGE[spoilageResult.prediction.risk_level] || 'badge'}>
                    {spoilageResult.prediction.risk_level} RISK
                  </span>
                </div>

                {/* Big Probability Card */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-surface-700/40 p-4 rounded-xl border border-surface-600 text-center">
                    <p className="text-xs text-gray-400 uppercase font-medium">Spoilage Probability</p>
                    <p className={`text-4xl font-black mt-1 ${
                      spoilageResult.prediction.risk_probability > 0.6 ? 'text-red-400' :
                      spoilageResult.prediction.risk_probability > 0.3 ? 'text-yellow-400' : 'text-emerald-400'
                    }`}>
                      {Math.round(spoilageResult.prediction.risk_probability * 100)}%
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Raw model score: {spoilageResult.prediction.risk_probability}
                    </p>
                  </div>

                  <div className="bg-surface-700/40 p-4 rounded-xl border border-surface-600 text-center">
                    <p className="text-xs text-gray-400 uppercase font-medium">Shelf Life Depleted</p>
                    <p className="text-4xl font-black text-gray-200 mt-1">
                      {spoilageResult.prediction.shelf_life_depleted_pct}%
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">Based on batch elapsed time</p>
                  </div>

                  <div className="bg-surface-700/40 p-4 rounded-xl border border-surface-600 text-center">
                    <p className="text-xs text-gray-400 uppercase font-medium">Action Priority</p>
                    <p className={`text-2xl font-bold mt-2 ${
                      spoilageResult.prediction.is_high_risk ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {spoilageResult.prediction.is_high_risk ? 'IMMEDIATE' : 'NORMAL'}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {spoilageResult.prediction.is_high_risk ? 'Redistribute or Markdown' : 'Maintain standard shelf'}
                    </p>
                  </div>
                </div>

                {/* Recommended Mitigation */}
                <div className="p-4 bg-surface-700/20 rounded-xl border border-surface-600 text-xs space-y-2">
                  <p className="font-semibold text-gray-200 flex items-center gap-1.5">
                    <span>💡</span> Recommended Operational Actions:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 pl-2">
                    {spoilageResult.prediction.risk_level === 'CRITICAL' && (
                      <li className="text-rose-300 font-medium">Trigger immediate 30-50% markdown or emergency redistribution transfer to high-velocity retail node.</li>
                    )}
                    {spoilageResult.prediction.risk_level === 'HIGH' && (
                      <li className="text-amber-300">Prioritize front-of-shelf display (FIFO) and verify cold chain storage temperature.</li>
                    )}
                    {spoilageResult.prediction.risk_level === 'MEDIUM' && (
                      <li>Monitor next 48-hour sales velocity; flag for redistribution if inventory turnover remains sluggish.</li>
                    )}
                    {spoilageResult.prediction.risk_level === 'LOW' && (
                      <li className="text-emerald-400">Inventory condition is optimal. No action required.</li>
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="card p-8 text-center bg-surface-800/60 border-dashed border-surface-600">
                <span className="text-3xl block mb-2">🔬</span>
                <p className="text-sm text-gray-300 font-medium">Ready for Spoilage Risk Analysis</p>
                <p className="text-xs text-gray-500 mt-1">Select an inventory item or adjust shelf life parameters and click Calculate</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}

export default AlertsPage
