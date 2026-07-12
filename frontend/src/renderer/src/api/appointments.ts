import { apiClient } from './client'
import type { Appointment, AppointmentCreate, AppointmentStatus, AvailableSlot } from '../types'

export interface AppointmentListParams {
  instructor_id?: number
  client_id?: number
  start_date?: string
  end_date?: string
  status?: AppointmentStatus
}

export const appointmentsApi = {
  list: async (params?: AppointmentListParams): Promise<Appointment[]> => {
    const response = await apiClient.get('/api/v1/appointments', { params })
    return response.data
  },

  get: async (id: number): Promise<Appointment> => {
    const response = await apiClient.get(`/api/v1/appointments/${id}`)
    return response.data
  },

  availableSlots: async (params: {
    service_id: number
    instructor_id: number
    date: string
  }): Promise<AvailableSlot[]> => {
    const response = await apiClient.get('/api/v1/appointments/available-slots', { params })
    return response.data
  },

  create: async (data: AppointmentCreate): Promise<Appointment> => {
    const response = await apiClient.post('/api/v1/appointments', data)
    return response.data
  },

  cancel: async (id: number, reason?: string): Promise<Appointment> => {
    const response = await apiClient.patch(`/api/v1/appointments/${id}/cancel`, { reason })
    return response.data
  },

  complete: async (id: number, status: 'completed' | 'no_show'): Promise<Appointment> => {
    const response = await apiClient.patch(`/api/v1/appointments/${id}/complete`, { status })
    return response.data
  },
}
