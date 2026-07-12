import { apiClient } from './client'
import type { InstructorAvailability, InstructorAvailabilityCreate } from '../types'

export const instructorAvailabilityApi = {
  list: async (instructorId?: number): Promise<InstructorAvailability[]> => {
    const response = await apiClient.get('/api/v1/instructor-availability', {
      params: instructorId !== undefined ? { instructor_id: instructorId } : {},
    })
    return response.data
  },

  create: async (data: InstructorAvailabilityCreate): Promise<InstructorAvailability> => {
    const response = await apiClient.post('/api/v1/instructor-availability', data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/instructor-availability/${id}`)
  },
}
