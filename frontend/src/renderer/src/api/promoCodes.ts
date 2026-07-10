import { apiClient } from './client'
import type { PromoCode, PromoCodeCreate, PromoCodeValidateResponse } from '../types'

export const promoCodesApi = {
  list: async (activeOnly = false): Promise<PromoCode[]> => {
    const res = await apiClient.get('/api/v1/promo-codes', {
      params: activeOnly ? { active_only: true } : {},
    })
    return res.data
  },

  create: async (data: PromoCodeCreate): Promise<PromoCode> => {
    const res = await apiClient.post('/api/v1/promo-codes', data)
    return res.data
  },

  get: async (id: number): Promise<PromoCode> => {
    const res = await apiClient.get(`/api/v1/promo-codes/${id}`)
    return res.data
  },

  update: async (id: number, data: Partial<PromoCodeCreate>): Promise<PromoCode> => {
    const res = await apiClient.put(`/api/v1/promo-codes/${id}`, data)
    return res.data
  },

  deactivate: async (id: number): Promise<PromoCode> => {
    const res = await apiClient.delete(`/api/v1/promo-codes/${id}`)
    return res.data
  },

  validate: async (code: string, membershipTypeId: number): Promise<PromoCodeValidateResponse> => {
    const res = await apiClient.post('/api/v1/promo-codes/validate', {
      code,
      membership_type_id: membershipTypeId,
    })
    return res.data
  },
}
