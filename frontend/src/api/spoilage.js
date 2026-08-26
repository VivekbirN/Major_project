import api from './axios'

export const getSpoilageEvents = async (params = {}) => {
  const r = await api.get('/spoilage', { params })
  return r.data
}

export const recordSpoilage = async (payload) => {
  const r = await api.post('/spoilage', payload)
  return r.data
}
