import { apiClient } from './client'
import type { Membership, MembershipType } from '../types'

export const clientMembershipsApi = {
  getOwn: async (): Promise<Membership[]> => {
    const res = await apiClient.get('/api/v1/memberships')
    return res.data
  },
}

export const membershipTypesApi = {
  list: async (): Promise<MembershipType[]> => {
    const res = await apiClient.get('/api/v1/membership-types')
    return res.data
  },
}

export const clientsApi = {
  updatePushToken: async (pushToken: string) => {
    await apiClient.put('/api/v1/clients/me/push-token', { push_token: pushToken })
  },
}
