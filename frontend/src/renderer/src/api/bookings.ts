import { apiClient } from './client'

export interface BookingResponse {
  id: number
  client_id: number
  scheduled_class_id: number
  status: string
  credit_deducted: boolean
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
}

export interface RosterEntry {
  booking_id: number
  client_id: number
  full_name: string | null
  email: string | null
  status: string
}

export const bookingsApi = {
  create: async (data: {
    scheduled_class_id: number
    client_id: number
  }): Promise<BookingResponse> => {
    const res = await apiClient.post('/api/v1/bookings', data)
    return res.data
  },
  cancel: async (bookingId: number): Promise<BookingResponse> => {
    const res = await apiClient.delete(`/api/v1/bookings/${bookingId}`)
    return res.data
  },
  list: async (params?: {
    client_id?: number
    class_id?: number
  }): Promise<BookingResponse[]> => {
    const res = await apiClient.get('/api/v1/bookings', { params })
    return res.data
  },
}
