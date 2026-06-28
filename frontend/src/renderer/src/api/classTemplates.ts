import { apiClient } from './client'
import type { ClassTemplate } from '../types'

export type ClassTemplateCreate = Omit<ClassTemplate, 'id' | 'is_active'>
export type ClassTemplateUpdate = Partial<ClassTemplateCreate>

export const classTemplatesApi = {
  list: async (): Promise<ClassTemplate[]> => {
    const res = await apiClient.get('/api/v1/class-templates')
    return res.data
  },

  create: async (data: ClassTemplateCreate): Promise<ClassTemplate> => {
    const res = await apiClient.post('/api/v1/class-templates', data)
    return res.data
  },

  update: async (id: number, data: ClassTemplateUpdate): Promise<ClassTemplate> => {
    const res = await apiClient.put(`/api/v1/class-templates/${id}`, data)
    return res.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/class-templates/${id}`)
  },
}
