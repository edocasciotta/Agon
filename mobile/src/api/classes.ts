import { apiClient } from './client'
import type { RosterEntry, ScheduledClass } from '../types'

export const classesApi = {
  list: async (params?: {
    start_date?: string
    end_date?: string
    instructor_id?: number
  }): Promise<ScheduledClass[]> => {
    const res = await apiClient.get('/api/v1/classes', { params })
    return res.data
  },
  get: async (id: number): Promise<ScheduledClass> => {
    const res = await apiClient.get(`/api/v1/classes/${id}`)
    return res.data
  },
  /** Confirmed bookings only — does NOT include check-in status (cross-reference
   * with `checkinsApi.listForClass` by `booking_id` for that). */
  roster: async (id: number): Promise<RosterEntry[]> => {
    const res = await apiClient.get(`/api/v1/classes/${id}/roster`)
    return res.data
  },
  /** Sets the class to 'completed' unconditionally — no backend guard against
   * double-completion, so callers should confirm with the user first. */
  complete: async (id: number): Promise<ScheduledClass> => {
    const res = await apiClient.post(`/api/v1/classes/${id}/complete`)
    return res.data
  },
}
