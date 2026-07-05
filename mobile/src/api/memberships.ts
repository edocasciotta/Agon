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

export interface CheckoutSessionResponse {
  checkout_url: string
  session_id: string
}

export const billingApi = {
  createCheckoutSession: async (
    clientId: number,
    membershipTypeId: number
  ): Promise<CheckoutSessionResponse> => {
    const successUrl = 'agon://membership?status=success'
    const cancelUrl = 'agon://membership/purchase'
    const res = await apiClient.post('/api/billing/checkout-session', {
      client_id: clientId,
      membership_type_id: membershipTypeId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    })
    return res.data
  },
}
