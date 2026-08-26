import api from './axios'

/**
 * Predict demand for a specific node and product using FastAPI via Express proxy
 */
export const getDemandForecast = async (payload) => {
  const r = await api.post('/ml/demand', payload)
  return r.data
}

/**
 * Analyze spoilage risk probability and category for an inventory item
 */
export const getSpoilagePrediction = async (payload) => {
  const r = await api.post('/ml/spoilage', payload)
  return r.data
}

/**
 * Detect operational pattern anomalies using Isolation Forest
 */
export const detectAnomaly = async (payload) => {
  const r = await api.post('/ml/anomaly', payload)
  return r.data
}

/**
 * Check ML service health status
 */
export const getMLHealth = async () => {
  const r = await api.get('/ml/health')
  return r.data
}
