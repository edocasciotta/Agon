import { apiClient } from './client'
import type { Checkin } from '../types'

export const checkinsApi = {
  /** Staff-only. All check-ins recorded for a class, regardless of method. */
  listForClass: async (classId: number): Promise<Checkin[]> => {
    const res = await apiClient.get(`/api/v1/checkins/class/${classId}`)
    return res.data
  },
  /** Instructor/manager marks a client present. The backend resolves the
   * confirmed booking itself from (scheduledClassId, clientId) — no booking_id
   * needed for this method. Can reject with 409 CHECKIN_BOOKING_NOT_CONFIRMED,
   * CHECKIN_ALREADY_CHECKED_IN, CHECKIN_WINDOW_NOT_OPEN, CHECKIN_WINDOW_CLOSED,
   * or 404 CHECKIN_BOOKING_NOT_FOUND. */
  manual: async (scheduledClassId: number, clientId: number): Promise<Checkin> => {
    const res = await apiClient.post('/api/v1/checkins', {
      method: 'manual',
      scheduled_class_id: scheduledClassId,
      client_id: clientId,
    })
    return res.data
  },
}
