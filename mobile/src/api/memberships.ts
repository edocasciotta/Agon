import { apiClient } from './client'
import type {
  GiftCardPurchaseRequest,
  Membership,
  MembershipType,
  PromoCodeValidateResponse,
  GiftCardValidateResponse,
} from '../types'

export const clientMembershipsApi = {
  getOwn: async (): Promise<Membership[]> => {
    const res = await apiClient.get('/api/v1/memberships', { params: { page_size: 100 } })
    return res.data.items
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
  checkout_url: string | null
  session_id: string | null
  already_completed: boolean
  membership_id: number | null
}

export interface SubscriptionDetail {
  stripe_subscription_id: string
  status: string
  current_period_end: string | null
  stripe_price_id: string
}

export interface SubscriptionResponse {
  subscription: SubscriptionDetail | null
}

export interface CancelSubscriptionResponse {
  status: string
  cancel_at_period_end: boolean
}

export const promoCodesApi = {
  validate: async (code: string, membershipTypeId: number): Promise<PromoCodeValidateResponse> => {
    const res = await apiClient.post('/api/v1/promo-codes/validate', {
      code,
      membership_type_id: membershipTypeId,
    })
    return res.data
  },
}

export interface CreateCheckoutSessionOptions {
  promoCode?: string
  giftCardCode?: string
}

export const billingApi = {
  createCheckoutSession: async (
    clientId: number,
    membershipTypeId: number,
    options?: CreateCheckoutSessionOptions
  ): Promise<CheckoutSessionResponse> => {
    const successUrl = 'agon://membership?status=success'
    const cancelUrl = 'agon://membership/purchase'
    const res = await apiClient.post('/api/billing/checkout-session', {
      client_id: clientId,
      membership_type_id: membershipTypeId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(options?.promoCode ? { promo_code: options.promoCode } : {}),
      ...(options?.giftCardCode ? { gift_card_code: options.giftCardCode } : {}),
    })
    return res.data
  },

  getSubscription: async (clientId: number): Promise<SubscriptionResponse> => {
    const res = await apiClient.get(`/api/billing/members/${clientId}/subscription`)
    return res.data
  },

  cancelSubscription: async (clientId: number): Promise<CancelSubscriptionResponse> => {
    const res = await apiClient.post(`/api/billing/members/${clientId}/subscription/cancel`, {})
    return res.data
  },
}

export const giftCardsApi = {
  validate: async (code: string): Promise<GiftCardValidateResponse> => {
    const res = await apiClient.post('/api/v1/gift-cards/validate', { code })
    return res.data
  },

  purchase: async (
    request: GiftCardPurchaseRequest
  ): Promise<{ checkout_url: string; session_id: string }> => {
    const res = await apiClient.post('/api/v1/gift-cards/checkout-session', request)
    return res.data
  },
}
