import { apiClient } from './client'

export interface Location {
  id: number
  name: string
  address?: string
  phone?: string
  is_active: boolean
}

export interface LocationCreate {
  name: string
  address?: string
  phone?: string
}

export const locationsApi = {
  list: async (includeInactive = false, search?: string): Promise<Location[]> => {
    const res = await apiClient.get('/api/v1/locations', {
      params: { ...(includeInactive ? { include_inactive: true } : {}), ...(search ? { search } : {}) },
    })
    return res.data
  },
  create: async (data: LocationCreate): Promise<Location> => {
    const res = await apiClient.post('/api/v1/locations', data)
    return res.data
  },
  update: async (id: number, data: Partial<LocationCreate & { is_active: boolean }>): Promise<Location> => {
    const res = await apiClient.put(`/api/v1/locations/${id}`, data)
    return res.data
  },
  deactivate: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/locations/${id}`)
  },
  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/locations/${id}/remove`)
  },
}
