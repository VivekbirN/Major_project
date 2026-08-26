import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, ReferenceLine, Line, ComposedChart
} from 'recharts'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import { getDemandForecast } from '../api/ml'
import { getNodes } from '../api/nodes'
import { getProducts } from '../api/products'
import { useAuth } from '../context/AuthContext'

const fmt = (n) => n == null ? '—' : Number(n).toLocaleString('en-IN')

const ForecastingPage = () => {
  const { user } = useAuth()
  const [nodes, setNodes] = useState([])
  const [products, setProducts] = useState([])
  const [selectedNode, setSelectedNode] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')

  // Contextual factors
  const [discount, setDiscount] = useState(1.0)
  const [holidayFlag, setHolidayFlag] = useState(0)
  const [activityFlag, setActivityFlag] = useState(0)
  const [stockoutHours, setStockoutHours] = useState(0.0)
  const [temperature, setTemperature] = useState(25.0)
  const [humidity, setHumidity] = useState(60.0)
  const [precipitation, setPrecipitation] = useState(0.0)

  // Forecast state
  const [loading, setLoading] = useState(false)
  const [forecastData, setForecastData] = useState(null)
  const [error, setError] = useState(null)

  // Load available nodes and products
  useEffect(() => {
    getNodes().then((r) => {
      const list = r.data.nodes || []
      setNodes(list)
      if (list.length > 0) {
        if (user?.role === 'WAREHOUSE_ADMIN' && user.node_id) {
          setSelectedNode(String(user.node_id))
        } else {
          setSelectedNode(String(list[0].id))
        }
      }
    }).catch(() => {})

    getProducts({ limit: 100 }).then((r) => {
      const list = r.data.products || []
      setProducts(list)
      if (list.length > 0) {
        setSelectedProduct(String(list[0].id))
      }
    }).catch(() => {})
  }, [user])

  // Automatically trigger initial forecast once node and product are set
  useEffect(() => {
    if (selectedNode && selectedProduct && !forecastData && !loading) {
      handleGenerateForecast()
    }
  }, [selectedNode, selectedProduct])

  const handleGenerateForecast = async (e) => {
    if (e) e.preventDefault()
    if (!selectedNode || !selectedProduct) return

    setLoading(true)
    setError(null)

    try {
      const res = await getDemandForecast({
        node_id: parseInt(selectedNode),
        product_id: parseInt(selectedProduct),
        discount: parseFloat(discount),
        holiday_flag: parseInt(holidayFlag),
        activity_flag: parseInt(activityFlag),
        stockout_hours: parseFloat(stockoutHours),
        weather: {
          temperature: parseFloat(temperature),
          humidity: parseFloat(humidity),
          precipitation: parseFloat(precipitation),
        },
      })
      setForecastData(res.data)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to generate demand forecast')
    } finally {
      setLoading(false)
    }
  }

  // Build chart dataset combining historical series and next-day predicted demand
  const chartData = []
  if (forecastData?.historical_sales) {
    const hist = forecastData.historical_sales
    hist.forEach((val, idx) => {
      const dayOffset = hist.length - idx - 1
      chartData.push({
        label: dayOffset === 0 ? 'Yesterday' : `Day -${dayOffset}`,
        historical: val,
        forecast: null,
        type: 'Historical',
      })
    })

    if (forecastData.forecast) {
      chartData.push({
        label: 'Tomorrow (AI Forecast)',
        historical: null,
        forecast: forecastData.forecast.predicted_demand,
        type: 'Forecast',
      })
    }
  }

  const pred = forecastData?.forecast
  const modelInfo = forecastData?.model_info
  const selectedProdObj = products.find((p) => String(p.id) === String(selectedProduct))
  const selectedNodeObj = nodes.find((n) => String(n.id) === String(selectedNode))

  return (
    <Layout title="AI Demand Forecasting">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">AI-Powered Demand Forecasting</h1>
            <span className="badge bg-brand-900/60 text-brand-300 border border-brand-700/50">
              FreshRetailNet-50K Trained
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Predict next-day product demand with stockout-aware gradient boosted regression
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            FastAPI Inference Engine Active
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-4 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-gray-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Control Panel + Prediction Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left Column: Input Form */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 pb-2 border-b border-surface-600">
            <span>⚙️</span> Forecast Configuration
          </h2>

          <form onSubmit={handleGenerateForecast} className="space-y-4">
            {/* Node Selection */}
            <div>
              <label htmlFor="forecasting-node-select" className="block text-xs font-medium text-gray-400 mb-1.5">Supply Chain Node</label>
              {user?.role === 'WAREHOUSE_ADMIN' ? (
                <div className="p-2.5 bg-surface-700 rounded-lg text-sm text-gray-300 border border-surface-600">
                  📍 {user.node?.name || 'Assigned Node'}
                </div>
              ) : (
                <select
                  id="forecasting-node-select"
                  aria-label="Supply Chain Node"
                  value={selectedNode}
                  onChange={(e) => setSelectedNode(e.target.value)}
                  className="select-field text-sm"
                  required
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.type})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Product Selection */}
            <div>
              <label htmlFor="forecasting-product-select" className="block text-xs font-medium text-gray-400 mb-1.5">Product SKU</label>
              <select
                id="forecasting-product-select"
                aria-label="Product SKU"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="select-field text-sm"
                required
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.sku}] — {p.category}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Discount Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Price Discount Factor</span>
                <span className="text-brand-400 font-semibold">{Math.round((1 - discount) * 100)}% Off ({discount}x)</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value))}
                className="w-full accent-brand-500 cursor-pointer"
              />
            </div>

            {/* Stockout Hours */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Stockout Duration (Hours)</span>
                <span className="text-yellow-400 font-semibold">{stockoutHours}h / 16h</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="12.0"
                step="0.5"
                value={stockoutHours}
                onChange={(e) => setStockoutHours(parseFloat(e.target.value))}
                className="w-full accent-yellow-500 cursor-pointer"
              />
              <p className="text-[11px] text-gray-500 mt-0.5">
                AI adjusts for suppressed demand when product was unavailable
              </p>
            </div>

            {/* Context Toggles */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setHolidayFlag(holidayFlag ? 0 : 1)}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                  holidayFlag ? 'bg-amber-950/60 border-amber-600 text-amber-300' : 'bg-surface-700 border-surface-600 text-gray-400'
                }`}
              >
                🎉 Holiday ({holidayFlag ? 'Yes' : 'No'})
              </button>
              <button
                type="button"
                onClick={() => setActivityFlag(activityFlag ? 0 : 1)}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                  activityFlag ? 'bg-purple-950/60 border-purple-600 text-purple-300' : 'bg-surface-700 border-surface-600 text-gray-400'
                }`}
              >
                📢 Marketing Promo ({activityFlag ? 'Yes' : 'No'})
              </button>
            </div>

            {/* Weather Inputs */}
            <div className="pt-2 border-t border-surface-700">
              <p className="text-xs text-gray-500 font-medium mb-2">Weather Condition Variables</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="forecasting-temp-input" className="block text-[11px] text-gray-400">Temp (°C)</label>
                  <input
                    id="forecasting-temp-input"
                    type="number"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="input-field text-xs py-1.5 px-2"
                  />
                </div>
                <div>
                  <label htmlFor="forecasting-humidity-input" className="block text-[11px] text-gray-400">Humidity (%)</label>
                  <input
                    id="forecasting-humidity-input"
                    type="number"
                    value={humidity}
                    onChange={(e) => setHumidity(e.target.value)}
                    className="input-field text-xs py-1.5 px-2"
                  />
                </div>
                <div>
                  <label htmlFor="forecasting-rain-input" className="block text-[11px] text-gray-400">Rain (mm)</label>
                  <input
                    id="forecasting-rain-input"
                    type="number"
                    value={precipitation}
                    onChange={(e) => setPrecipitation(e.target.value)}
                    className="input-field text-xs py-1.5 px-2"
                  />
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Predicting Demand...
                </>
              ) : (
                <>
                  <span>⚡</span> Run XGBoost Forecast
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Prediction Metrics & Details (2 columns wide) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card bg-gradient-to-br from-surface-800 to-brand-950/40 border-brand-800/40">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 font-medium">Next-Day Forecast</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-extrabold text-brand-400">
                  {pred ? fmt(pred.predicted_demand) : '—'}
                </p>
                <span className="text-xs text-gray-400 font-medium">units</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Horizon: {pred?.forecast_horizon?.replace('_', ' ') || 'Next 24 Hours'}
              </p>
            </div>

            <div className="card">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 font-medium">7-Day Baseline Avg</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-gray-200">
                  {pred ? fmt(pred.baseline_7d_avg) : '—'}
                </p>
                <span className="text-xs text-gray-400 font-medium">units/day</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">Historical moving average</p>
            </div>

            <div className="card">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 font-medium">Expected Demand Shift</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-3xl font-bold ${
                  !pred ? 'text-gray-400' : pred.expected_pct_change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {pred ? `${pred.expected_pct_change > 0 ? '+' : ''}${pred.expected_pct_change}%` : '—'}
                </p>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {pred && pred.expected_pct_change >= 0 ? '📈 Demand surge anticipated' : '📉 Demand cooling expected'}
              </p>
            </div>
          </div>

          {/* Forecast Chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-surface-600">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>📊</span> Demand Trajectory & AI Prediction
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedProdObj?.name} at {selectedNodeObj?.name}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-gray-300">
                  <span className="w-3 h-3 rounded-sm bg-indigo-500" /> Historical
                </span>
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <span className="w-3 h-3 rounded-sm bg-cyan-400" /> AI Forecast
                </span>
              </div>
            </div>

            {loading ? (
              <div className="h-64 flex items-center justify-center bg-surface-700/20 rounded-xl">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Computing feature matrix & running model inference...</span>
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <EmptyState icon="📊" title="Select product and node to visualize forecast" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const item = payload[0].payload
                      const val = item.historical ?? item.forecast
                      return (
                        <div className="bg-surface-800 border border-surface-600 rounded-lg p-2.5 shadow-xl">
                          <p className="text-xs text-gray-400">{label}</p>
                          <p className="text-sm font-bold text-white mt-0.5">
                            {val} units{' '}
                            <span className="text-xs font-normal text-brand-400">({item.type})</span>
                          </p>
                        </div>
                      )
                    }}
                  />
                  {pred && (
                    <ReferenceLine
                      y={pred.baseline_7d_avg}
                      stroke="#9ca3af"
                      strokeDasharray="4 4"
                      label={{ value: '7d Avg', fill: '#9ca3af', fontSize: 10, position: 'right' }}
                    />
                  )}
                  <Bar dataKey="historical" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={35} />
                  <Bar dataKey="forecast" fill="#22d3ee" radius={[4, 4, 0, 0]} maxBarSize={35} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Model Transparency & Academic Notes */}
          <div className="card bg-surface-800/80 border-surface-600">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Model Transparency & Technical Specifications
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-surface-700/40 p-2.5 rounded-lg border border-surface-700">
                <span className="text-gray-500 block text-[11px]">Algorithm</span>
                <span className="font-semibold text-white">{modelInfo?.name || 'XGBoost'} Regressor</span>
              </div>
              <div className="bg-surface-700/40 p-2.5 rounded-lg border border-surface-700">
                <span className="text-gray-500 block text-[11px]">Dataset</span>
                <span className="font-semibold text-white">FreshRetailNet-50K</span>
              </div>
              <div className="bg-surface-700/40 p-2.5 rounded-lg border border-surface-700">
                <span className="text-gray-500 block text-[11px]">Features</span>
                <span className="font-semibold text-white">22 Engineered Lags & Weather</span>
              </div>
              <div className="bg-surface-700/40 p-2.5 rounded-lg border border-surface-700">
                <span className="text-gray-500 block text-[11px]">Stockout Logic</span>
                <span className="font-semibold text-emerald-400">Censored Demand Aware</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default ForecastingPage
