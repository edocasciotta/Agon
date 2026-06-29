import { apiClient } from './client'
import type { SmartListItem, SmartListResponse, SmartListCreate } from '../types'

export const smartListsApi = {
  list: async (): Promise<SmartListItem[]> => {
    const response = await apiClient.get('/api/v1/smartlists')
    return response.data
  },

  create: async (data: SmartListCreate): Promise<SmartListResponse> => {
    const response = await apiClient.post('/api/v1/smartlists', data)
    return response.data
  },

  get: async (id: number): Promise<SmartListResponse> => {
    const response = await apiClient.get(`/api/v1/smartlists/${id}`)
    return response.data
  },

  update: async (id: number, data: SmartListCreate): Promise<SmartListResponse> => {
    const response = await apiClient.put(`/api/v1/smartlists/${id}`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/smartlists/${id}`)
  },

  preview: async (
    id: number
  ): Promise<{ count: number; clients: { id: number; full_name: string; email: string }[] }> => {
    const response = await apiClient.get(`/api/v1/smartlists/${id}/preview`)
    return response.data
  },
}
