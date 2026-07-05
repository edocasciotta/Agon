import { apiClient } from './client'

export interface BillingSettings {
  stripe_connected: boolean
  stripe_account_id: string | null
  publishable_key: string
}

export interface SubscriptionStatus {
  subscription: {
    stripe_subscription_id: string
    status: string
    current_period_end: string | null
    stripe_price_id: string
  } | null
}

export const billingApi = {
  getSettings: () =>
    apiClient.get<BillingSettings>('/api/billing/settings').then((r) => r.data),

  saveSettings: (body: { secret_key: string; publishable_key: string; webhook_secret?: string }) =>
    apiClient
      .post<{ status: string; stripe_account_id: string }>('/api/billing/settings', body)
      .then((r) => r.data),

  getSubscription: (clientId: number) =>
    apiClient
      .get<SubscriptionStatus>(`/api/billing/members/${clientId}/subscription`)
      .then((r) => r.data),

  cancelSubscription: (clientId: number) =>
    apiClient
      .post<{ status: string; cancel_at_period_end: boolean }>(
        `/api/billing/members/${clientId}/subscription/cancel`,
        {}
      )
      .then((r) => r.data),
}
