import { apiClient } from './client'
import type { Client } from '../types'

export const clientsApi = {
  list: async (search?: string): Promise<Client[]> => {
    const res = await apiClient.get('/api/v1/clients', { params: search ? { search } : {} })
    return res.data
  },
  get: async (id: number): Promise<Client> => {
    const res = await apiClient.get(`/api/v1/clients/${id}`)
    return res.data
  },
  update: async (id: number, data: Partial<Client>) => {
    const res = await apiClient.put(`/api/v1/clients/${id}`, data)
    return res.data
  },
  bookings: async (id: number) => {
    const res = await apiClient.get(`/api/v1/clients/${id}/bookings`)
    return res.data
  },
  memberships: async (id: number) => {
    const res = await apiClient.get(`/api/v1/clients/${id}/memberships`)
    return res.data
  },
}
