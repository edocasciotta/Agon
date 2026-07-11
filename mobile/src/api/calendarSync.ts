import { apiClient } from './client'
import type { CalendarSyncResponse } from '../types'

export const calendarSyncApi = {
  get: async (clientId: number): Promise<CalendarSyncResponse> => {
    const res = await apiClient.get(`/api/v1/clients/${clientId}/calendar-sync`)
    return res.data
  },
  regenerate: async (clientId: number): Promise<CalendarSyncResponse> => {
    const res = await apiClient.post(`/api/v1/clients/${clientId}/calendar-sync/regenerate`)
    return res.data
  },
}
