import { apiClient } from './client'
import type { GiftCard, GiftCardIssue, GiftCardValidateResponse } from '../types'

export const giftCardsApi = {
  list: async (activeOnly = false): Promise<GiftCard[]> => {
    const res = await apiClient.get('/api/v1/gift-cards', {
      params: activeOnly ? { active_only: true } : {},
    })
    return res.data
  },

  issue: async (data: GiftCardIssue): Promise<GiftCard> => {
    const res = await apiClient.post('/api/v1/gift-cards', data)
    return res.data
  },

  get: async (id: number): Promise<GiftCard> => {
    const res = await apiClient.get(`/api/v1/gift-cards/${id}`)
    return res.data
  },

  deactivate: async (id: number): Promise<GiftCard> => {
    const res = await apiClient.delete(`/api/v1/gift-cards/${id}`)
    return res.data
  },

  validate: async (code: string): Promise<GiftCardValidateResponse> => {
    const res = await apiClient.post('/api/v1/gift-cards/validate', { code })
    return res.data
  },
}
