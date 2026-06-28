import { apiClient } from './client'
import type { ClassTemplate } from '../types'

export const classTemplatesApi = {
  list: async (): Promise<ClassTemplate[]> => {
    const res = await apiClient.get('/api/v1/class-templates')
    return res.data
  },
}
