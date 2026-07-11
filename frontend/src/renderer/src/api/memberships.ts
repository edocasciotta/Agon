import { apiClient } from './client'
import type { MembershipType, Membership } from '../types'

export const membershipTypesApi = {
  list: async (includeInactive = false): Promise<MembershipType[]> => {
    const res = await apiClient.get('/api/v1/membership-types', {
      params: includeInactive ? { include_inactive: true } : {},
    })
    return res.data
  },
  create: async (data: Partial<MembershipType>) => {
    const res = await apiClient.post('/api/v1/membership-types', data)
    return res.data
  },
  update: async (id: number, data: Partial<MembershipType>): Promise<MembershipType> => {
    const res = await apiClient.put(`/api/v1/membership-types/${id}`, data)
    return res.data
  },
  deactivate: async (id: number): Promise<MembershipType> => {
    const res = await apiClient.delete(`/api/v1/membership-types/${id}`)
    return res.data
  },
  reactivate: async (id: number): Promise<MembershipType> => {
    const res = await apiClient.patch(`/api/v1/membership-types/${id}/reactivate`)
    return res.data
  },
  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/membership-types/${id}/remove`)
  },
}

export interface MembershipListPage {
  items: Membership[]
  total: number
  page: number
  page_size: number
}

export const membershipsApi = {
  list: async (
    clientId?: number,
    page = 1,
    pageSize = 50,
    status?: string
  ): Promise<MembershipListPage> => {
    const res = await apiClient.get('/api/v1/memberships', {
      params: {
        ...(clientId ? { client_id: clientId } : {}),
        ...(status ? { status } : {}),
        page,
        page_size: pageSize,
      },
    })
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
