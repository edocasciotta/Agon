import { apiClient } from './client'
import type { StudioBranding } from '../types'

export const studioApi = {
  getBranding: async (): Promise<StudioBranding> => {
    const res = await apiClient.get('/api/v1/studio/branding')
    return res.data
  },
}
