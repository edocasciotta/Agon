import { apiClient } from './client'
import type { WaiverSignatureResponse, WaiverWithStatus } from '../types'

export const waiversApi = {
  listForClient: async (clientId: number): Promise<WaiverWithStatus[]> => {
    const res = await apiClient.get(`/api/v1/clients/${clientId}/waivers`)
    return res.data
  },
  sign: async (waiverId: number, signedName: string): Promise<WaiverSignatureResponse> => {
    const res = await apiClient.post(`/api/v1/waivers/${waiverId}/sign`, {
      signed_name: signedName,
    })
    return res.data
  },
}
