import axios from 'axios'

// Studio URL is set dynamically from QR scan — see studioStore
let studioBaseUrl = 'http://localhost:8000'

export const setStudioUrl = (url: string) => { studioBaseUrl = url }

export const apiClient = axios.create({
  headers: { 'Content-Type': 'application/json' }
})

// Attach studio URL dynamically on each request
apiClient.interceptors.request.use((config) => {
  config.baseURL = studioBaseUrl
  return config
})
