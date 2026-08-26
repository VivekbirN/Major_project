import api from './axios'

export const getNodes = async (params = {}) => {
  const r = await api.get('/nodes', { params })
  return r.data
}

export const getNodeById = async (id) => {
  const r = await api.get(`/nodes/${id}`)
  return r.data
}
