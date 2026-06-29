import { apiClient } from './client'
import type { EmailEventAssignment } from '../types'

export const emailEventsApi = {
  list: async (): Promise<EmailEventAssignment[]> => {
    const response = await apiClient.get('/api/v1/email/events')
    return response.data
  },

  assign: async (eventType: string, templateId: number | null): Promise<EmailEventAssignment> => {
    const response = await apiClient.put(`/api/v1/email/events/${eventType}`, {
      template_id: templateId,
    })
    return response.data
  },
}
