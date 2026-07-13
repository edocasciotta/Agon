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
  photo_url?: string | null
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
  list: async (search?: string, includeInactive = false): Promise<Instructor[]> => {
    const res = await apiClient.get('/api/v1/instructors', {
      params: { ...(search ? { search } : {}), ...(includeInactive ? { include_inactive: true } : {}) },
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
  reactivate: async (id: number): Promise<Instructor> => {
    const res = await apiClient.patch(`/api/v1/instructors/${id}/reactivate`)
    return res.data
  },
  deactivate: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/instructors/${id}`)
  },
  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/instructors/${id}/remove`)
  },
  uploadPhoto: async (id: number, file: File): Promise<Instructor> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post(`/api/v1/instructors/${id}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}
