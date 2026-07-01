import { apiClient } from './client'

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await apiClient.post('/api/v1/auth/login', { email, password })
    return res.data as { access_token: string; refresh_token: string; token_type: string }
  },
  me: async (token?: string) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await apiClient.get('/api/v1/auth/me', { headers })
    return res.data
  },
}
