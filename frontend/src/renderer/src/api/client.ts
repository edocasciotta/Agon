import axios, { type AxiosError } from 'axios'
import { useAuthStore } from '../store/authStore'

export interface ApiError {
  code: string
  message: string
}

export const apiClient = axios.create({
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 → clear auth and redirect
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail: { error: ApiError } }>) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      useAuthStore.getState().logout()
      window.location.href = '/'
    }
    const apiError: ApiError = error.response?.data?.detail?.error ?? {
      code: 'SERVER_ERROR',
      message: error.message ?? 'An unexpected error occurred',
    }
    return Promise.reject(apiError)
  }
)
