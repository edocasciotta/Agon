import { apiClient } from './client'
import type { Appointment, AppointmentCreate, AppointmentStatus, AvailableSlot } from '../types'

export interface AppointmentListParams {
  status?: AppointmentStatus
  start_date?: string
  end_date?: string
}

export const appointmentsApi = {
  list: async (params?: AppointmentListParams): Promise<Appointment[]> => {
    const res = await apiClient.get('/api/v1/appointments', { params })
    return res.data
  },
  availableSlots: async (params: {
    service_id: number
    instructor_id: number
    date: string
  }): Promise<AvailableSlot[]> => {
    const res = await apiClient.get('/api/v1/appointments/available-slots', { params })
    return res.data
  },
  create: async (data: AppointmentCreate): Promise<Appointment> => {
    const res = await apiClient.post('/api/v1/appointments', data)
    return res.data
  },
  cancel: async (id: number, reason?: string): Promise<Appointment> => {
    const res = await apiClient.patch(`/api/v1/appointments/${id}/cancel`, { reason })
    return res.data
  },
}
