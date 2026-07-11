import { apiClient } from './client'
import type { ClientTag } from '../types'

export const tagsApi = {
  getClientTags: async (clientId: number): Promise<ClientTag[]> => {
    const res = await apiClient.get(`/api/v1/clients/${clientId}/tags`)
    return res.data
  },
}
