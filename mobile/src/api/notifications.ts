import { apiClient } from './client'
import type { NotificationLog } from '../types'

export const notificationsApi = {
  list: async (): Promise<NotificationLog[]> => {
    const res = await apiClient.get('/api/v1/notifications')
    return res.data
  },
  markRead: async (id: number) => {
    await apiClient.put(`/api/v1/notifications/${id}/read`)
  },
}
