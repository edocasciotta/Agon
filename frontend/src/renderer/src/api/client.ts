import axios from 'axios'

export const apiClient = axios.create({
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' }
})

// Request interceptor: attach JWT token
apiClient.interceptors.request.use((config) => {
  // Token will be attached here once auth store is implemented
  return config
})
