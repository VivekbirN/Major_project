import api from './axios'

export const loginUser = async (email, password) => {
  const response = await api.post('/auth/login', { email, password })
  return response.data
}

export const registerUser = async (name, email, password, role = 'VIEWER') => {
  const response = await api.post('/auth/register', { name, email, password, role })
  return response.data
}

export const googleLogin = async (idToken) => {
  const response = await api.post('/auth/google', { id_token: idToken })
  return response.data
}

export const getMe = async () => {
  const response = await api.get('/auth/me')
  return response.data
}
