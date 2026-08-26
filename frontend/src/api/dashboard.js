import api from './axios'

export const getDashboardOverview = async () => {
  const r = await api.get('/dashboard/overview')
  return r.data
}
