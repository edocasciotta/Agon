import { apiClient } from './client'

export interface Instructor {
  id: number
  user_id: number
  full_name: string
  email: string
  bio?: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface InstructorCreate {
  full_name: string
  email: string
  password: string
  bio?: string
}

export interface InstructorUpdate {
  full_name?: string
  bio?: string
}

export const instructorsApi = {
  list: async (search?: string): Promise<Instructor[]> => {
    const res = await apiClient.get('/api/v1/instructors', {
      params: search ? { search } : {},
    })
    return res.data
  },
  create: async (data: InstructorCreate): Promise<Instructor> => {
    const res = await apiClient.post('/api/v1/instructors', data)
    return res.data
  },
  update: async (id: number, data: InstructorUpdate): Promise<Instructor> => {
    const res = await apiClient.put(`/api/v1/instructors/${id}`, data)
    return res.data
  },
  deactivate: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/instructors/${id}`)
  },
  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/instructors/${id}/remove`)
  },
}
