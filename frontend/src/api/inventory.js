import api from './axios'

export const getInventory = async (params = {}) => {
  const response = await api.get('/inventory', { params })
  return response.data
}

export const getProducts = async (params = {}) => {
  const response = await api.get('/inventory/products', { params })
  return response.data
}

export const getNodes = async () => {
  const response = await api.get('/inventory/nodes')
  return response.data
}
