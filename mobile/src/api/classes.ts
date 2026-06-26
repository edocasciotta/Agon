import { apiClient } from './client'
import type { ScheduledClass } from '../types'

export const classesApi = {
  list: async (params?: { start_date?: string; end_date?: string }): Promise<ScheduledClass[]> => {
    const res = await apiClient.get('/api/v1/classes', { params })
    return res.data
  },
  get: async (id: number): Promise<ScheduledClass> => {
    const res = await apiClient.get(`/api/v1/classes/${id}`)
    return res.data
  },
}
