import { apiClient } from './client'

export interface Instructor {
  id: number
  user_id: number
  full_name: string
  bio?: string
  photo_path?: string
  created_at?: string
  updated_at?: string
}

export const instructorsApi = {
  list: async (): Promise<Instructor[]> => {
    const res = await apiClient.get('/api/v1/instructors')
    return res.data
  },
}
