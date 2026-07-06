import axios, { type AxiosError } from 'axios'
import * as SecureStore from 'expo-secure-store'
import { useSessionStore } from '../store/sessionStore'

export interface ApiError {
  code: string
  message: string
}

export const TOKEN_KEY = 'agon_access_token'
export const STUDIO_URL_KEY = 'agon_studio_url'
export const STUDIO_NAME_KEY = 'agon_studio_name'

export const apiClient = axios.create({
  headers: { 'Content-Type': 'application/json' },
})

// Attach studio URL + JWT token dynamically
apiClient.interceptors.request.use(async (config) => {
  const studioUrl = await SecureStore.getItemAsync(STUDIO_URL_KEY)
  config.baseURL = studioUrl ?? 'http://localhost:8000'

  const token = await SecureStore.getItemAsync(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Normalise error shape + handle 401 (expired token → redirect to login without losing studio)
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ detail: { error: ApiError } }>) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY)
      useSessionStore.getState().setNeedsReauth(true)
    }
    const apiError: ApiError = error.response?.data?.detail?.error ?? {
      code: 'SERVER_ERROR',
      message: error.message ?? 'An unexpected error occurred',
    }
    return Promise.reject(apiError)
  }
)
