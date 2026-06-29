import { apiClient } from './client'
import type {
  EmailTemplateListItem,
  EmailTemplateResponse,
  EmailTemplateCreate,
} from '../types'

export const emailTemplatesApi = {
  list: async (): Promise<EmailTemplateListItem[]> => {
    const response = await apiClient.get('/api/v1/email/templates')
    return response.data
  },

  create: async (data: EmailTemplateCreate): Promise<EmailTemplateResponse> => {
    const response = await apiClient.post('/api/v1/email/templates', data)
    return response.data
  },

  get: async (id: number): Promise<EmailTemplateResponse> => {
    const response = await apiClient.get(`/api/v1/email/templates/${id}`)
    return response.data
  },

  update: async (id: number, data: EmailTemplateCreate): Promise<EmailTemplateResponse> => {
    const response = await apiClient.put(`/api/v1/email/templates/${id}`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/email/templates/${id}`)
  },
}
