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
  validateInvite: async (token: string) => {
    const res = await apiClient.get(`/api/v1/auth/invite/${token}`)
    return res.data as { client_id: number; email: string; full_name: string; token_valid: boolean }
  },
  resetPassword: async (token: string, new_password: string) => {
    const res = await apiClient.post('/api/v1/auth/reset-password', { token, new_password })
    return res.data as { message: string }
  },
}
