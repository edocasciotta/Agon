import { apiClient } from './client'
import * as SecureStore from 'expo-secure-store'
import { TOKEN_KEY } from './client'

export const authApi = {
  register: async (email: string, password: string, full_name: string) => {
    const res = await apiClient.post('/api/v1/auth/register/client', { email, password, full_name })
    return res.data as { access_token: string; refresh_token: string }
  },
  login: async (email: string, password: string) => {
    const res = await apiClient.post('/api/v1/auth/login', { email, password })
    return res.data as { access_token: string; refresh_token: string }
  },
  me: async () => {
    const res = await apiClient.get('/api/v1/auth/me')
    return res.data
  },
  saveToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
}
