import api from './axios'

// ── Inventory ─────────────────────────────────────────────────────────────────

export const getInventoryOverview = async () => {
  const r = await api.get('/inventory/overview')
  return r.data
}

export const getInventory = async (params = {}) => {
  const r = await api.get('/inventory', { params })
  return r.data
}

export const getInventoryById = async (id) => {
  const r = await api.get(`/inventory/${id}`)
  return r.data
}

export const adjustInventory = async (id, payload) => {
  const r = await api.patch(`/inventory/${id}`, payload)
  return r.data
}

export const incomingShipment = async (payload) => {
  const r = await api.post('/inventory/incoming', payload)
  return r.data
}

export const outgoingShipment = async (payload) => {
  const r = await api.post('/inventory/outgoing', payload)
  return r.data
}

export const getTransactions = async (params = {}) => {
  const r = await api.get('/inventory/transactions', { params })
  return r.data
}

// Backward compatibility re-exports
export { getProducts } from './products'
export { getNodes } from './nodes'

