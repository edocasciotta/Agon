import { apiClient } from './client'
import type { WaiverResponse, WaiverCreate, WaiverUpdate, WaiverWithStatus } from '../types'

export const waiversApi = {
  list: async (activeOnly = false): Promise<WaiverResponse[]> => {
    const response = await apiClient.get('/api/v1/waivers', {
      params: activeOnly ? { active_only: true } : {},
    })
    return response.data
  },

  get: async (id: number): Promise<WaiverResponse> => {
    const response = await apiClient.get(`/api/v1/waivers/${id}`)
    return response.data
  },

  create: async (data: WaiverCreate): Promise<WaiverResponse> => {
    const response = await apiClient.post('/api/v1/waivers', data)
    return response.data
  },

  update: async (id: number, data: WaiverUpdate): Promise<WaiverResponse> => {
    const response = await apiClient.put(`/api/v1/waivers/${id}`, data)
    return response.data
  },

  deactivate: async (id: number): Promise<WaiverResponse> => {
    const response = await apiClient.delete(`/api/v1/waivers/${id}`)
    return response.data
  },

  listForClient: async (clientId: number): Promise<WaiverWithStatus[]> => {
    const response = await apiClient.get(`/api/v1/clients/${clientId}/waivers`)
    return response.data
  },
}
