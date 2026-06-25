import { apiClient } from './client'
import type { MembershipType, Membership } from '../types'

export const membershipTypesApi = {
  list: async (): Promise<MembershipType[]> => {
    const res = await apiClient.get('/api/v1/membership-types')
    return res.data
  },
  create: async (data: Partial<MembershipType>) => {
    const res = await apiClient.post('/api/v1/membership-types', data)
    return res.data
  },
}

export const membershipsApi = {
  list: async (clientId?: number): Promise<Membership[]> => {
    const res = await apiClient.get('/api/v1/memberships', { params: clientId ? { client_id: clientId } : {} })
    return res.data
  },
  create: async (data: Partial<Membership>) => {
    const res = await apiClient.post('/api/v1/memberships', data)
    return res.data
  },
  cancel: async (id: number) => {
    const res = await apiClient.delete(`/api/v1/memberships/${id}`)
    return res.data
  },
}
