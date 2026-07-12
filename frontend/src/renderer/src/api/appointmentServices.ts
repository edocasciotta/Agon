import { apiClient } from './client'
import type {
  AppointmentService,
  AppointmentServiceCreate,
  AppointmentServiceUpdate,
} from '../types'

export const appointmentServicesApi = {
  list: async (includeInactive = false): Promise<AppointmentService[]> => {
    const response = await apiClient.get('/api/v1/appointment-services', {
      params: includeInactive ? { include_inactive: true } : {},
    })
    return response.data
  },

  get: async (id: number): Promise<AppointmentService> => {
    const response = await apiClient.get(`/api/v1/appointment-services/${id}`)
    return response.data
  },

  create: async (data: AppointmentServiceCreate): Promise<AppointmentService> => {
    const response = await apiClient.post('/api/v1/appointment-services', data)
    return response.data
  },

  update: async (id: number, data: AppointmentServiceUpdate): Promise<AppointmentService> => {
    const response = await apiClient.patch(`/api/v1/appointment-services/${id}`, data)
    return response.data
  },

  deactivate: async (id: number): Promise<AppointmentService> => {
    const response = await apiClient.delete(`/api/v1/appointment-services/${id}`)
    return response.data
  },
}
