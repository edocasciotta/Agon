import { apiClient } from './client'
import type { AppointmentService } from '../types'

export const appointmentServicesApi = {
  list: async (): Promise<AppointmentService[]> => {
    const res = await apiClient.get('/api/v1/appointment-services')
    return res.data
  },
}
