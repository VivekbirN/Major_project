import api from './axios'

export const getDashboardOverview = async () => {
  const response = await api.get('/dashboard/overview')
  return response.data
}
