import { apiClient } from './client'
import type { ScheduledClass } from '../types'

export const classesApi = {
  list: async (params?: { start_date?: string; end_date?: string; status?: string }): Promise<ScheduledClass[]> => {
    const res = await apiClient.get('/api/v1/classes', { params })
    return res.data
  },
  create: async (data: Partial<ScheduledClass>) => {
    const res = await apiClient.post('/api/v1/classes', data)
    return res.data
  },
  get: async (id: number) => {
    const res = await apiClient.get(`/api/v1/classes/${id}`)
    return res.data
  },
  update: async (id: number, data: Partial<ScheduledClass>) => {
    const res = await apiClient.put(`/api/v1/classes/${id}`, data)
    return res.data
  },
  createRecurring: async (data: {
    template_id: number
    instructor_id?: number
    first_starts_at: string
    duration_minutes: number
    capacity: number
    recurrence_days: number[]
    end_date: string
    notes?: string
  }): Promise<{ count: number }> => {
    const res = await apiClient.post('/api/v1/classes/recurring', data)
    return res.data
  },
  cancel: async (id: number) => {
    const res = await apiClient.delete(`/api/v1/classes/${id}`)
    return res.data
  },
  roster: async (id: number) => {
    const res = await apiClient.get(`/api/v1/classes/${id}/roster`)
    return res.data
  },
}
