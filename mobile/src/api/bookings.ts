import { apiClient } from './client'
import type { Booking } from '../types'

export const bookingsApi = {
  list: async (): Promise<Booking[]> => {
    const res = await apiClient.get('/api/v1/bookings')
    return res.data
  },
  get: async (id: number): Promise<Booking> => {
    const res = await apiClient.get(`/api/v1/bookings/${id}`)
    return res.data
  },
  create: async (scheduled_class_id: number): Promise<Booking> => {
    const res = await apiClient.post('/api/v1/bookings', { scheduled_class_id })
    return res.data
  },
  cancel: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/bookings/${id}`)
  },
  getQr: async (bookingId: number) => {
    const res = await apiClient.get(`/api/v1/checkins/qr/${bookingId}`)
    return res.data as { qr_token: string; qr_image_base64: string }
  },
  checkinApp: async (bookingId: number) => {
    const res = await apiClient.post('/api/v1/checkins', { booking_id: bookingId, method: 'app' })
    return res.data
  },
  joinWaitlist: async (scheduled_class_id: number) => {
    const res = await apiClient.post('/api/v1/bookings/waitlist', { scheduled_class_id })
    return res.data
  },
}
