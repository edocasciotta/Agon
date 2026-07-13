import { apiClient } from './client'
import type { Instructor } from '../types'

export const instructorsApi = {
  list: async (): Promise<Instructor[]> => {
    const res = await apiClient.get('/api/v1/instructors')
    return res.data
  },
  get: async (id: number): Promise<Instructor> => {
    const res = await apiClient.get(`/api/v1/instructors/${id}`)
    return res.data
  },
  listAvailableForService: async (serviceId: number): Promise<Instructor[]> => {
    const res = await apiClient.get(
      `/api/v1/appointment-services/${serviceId}/available-instructors`
    )
    return res.data
  },
}
