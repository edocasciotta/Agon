import { apiClient } from './client'
import type {
  SmsSettings,
  SmsTemplateListItem,
  SmsTemplateResponse,
  SmsTemplateCreate,
  SmsEventAssignment,
} from '../types'

export const smsApi = {
  getSettings: async (): Promise<SmsSettings> => {
    const res = await apiClient.get('/api/v1/sms/settings')
    return res.data
  },
  saveSettings: async (data: {
    account_sid?: string
    auth_token?: string
    from_number?: string
    enabled?: boolean
  }): Promise<SmsSettings> => {
    const res = await apiClient.put('/api/v1/sms/settings', data)
    return res.data
  },
  testSettings: async (toPhone: string): Promise<{ message: string }> => {
    const res = await apiClient.post('/api/v1/sms/settings/test', { to_phone: toPhone })
    return res.data
  },

  listTemplates: async (): Promise<SmsTemplateListItem[]> => {
    const response = await apiClient.get('/api/v1/sms/templates')
    return response.data
  },
  createTemplate: async (data: SmsTemplateCreate): Promise<SmsTemplateResponse> => {
    const response = await apiClient.post('/api/v1/sms/templates', data)
    return response.data
  },
  getTemplate: async (id: number): Promise<SmsTemplateResponse> => {
    const response = await apiClient.get(`/api/v1/sms/templates/${id}`)
    return response.data
  },
  updateTemplate: async (id: number, data: SmsTemplateCreate): Promise<SmsTemplateResponse> => {
    const response = await apiClient.put(`/api/v1/sms/templates/${id}`, data)
    return response.data
  },
  deleteTemplate: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/sms/templates/${id}`)
  },

  listEvents: async (): Promise<SmsEventAssignment[]> => {
    const response = await apiClient.get('/api/v1/sms/events')
    return response.data
  },
  assignEventTemplate: async (
    eventType: string,
    templateId: number | null
  ): Promise<SmsEventAssignment> => {
    const response = await apiClient.put(`/api/v1/sms/events/${eventType}`, {
      template_id: templateId,
    })
    return response.data
  },

  send: async (clientId: number, body: string): Promise<{ status: string }> => {
    const response = await apiClient.post('/api/v1/sms/send', { client_id: clientId, body })
    return response.data
  },
}
