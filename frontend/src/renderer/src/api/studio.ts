import { apiClient } from './client'
import type { StudioSettings, EmailSettings } from '../types'

export const studioApi = {
  get: async (): Promise<StudioSettings> => {
    const res = await apiClient.get('/api/v1/studio')
    return res.data
  },
  update: async (data: Partial<StudioSettings>): Promise<StudioSettings> => {
    const res = await apiClient.put('/api/v1/studio', data)
    return res.data
  },
  status: async () => {
    const res = await apiClient.get('/api/v1/studio/status')
    return res.data
  },
  saveAiKey: async (apiKey: string): Promise<void> => {
    await apiClient.post('/api/v1/studio/ai', { api_key: apiKey })
  },
  getEmailSettings: async (): Promise<EmailSettings> => {
    const res = await apiClient.get('/api/v1/studio/email')
    return res.data
  },
  saveEmailSettings: async (data: Partial<EmailSettings>): Promise<EmailSettings> => {
    const res = await apiClient.put('/api/v1/studio/email', data)
    return res.data
  },
  testEmail: async (): Promise<{ message: string }> => {
    const res = await apiClient.post('/api/v1/studio/email/test', {})
    return res.data
  },
}
