import { apiClient } from './client'
import type { Tag, TagCreate, ClientTag, AutoTagRule, AutoTagRuleCreate } from '../types'

export const tagsApi = {
  // Tags CRUD
  list: async (): Promise<Tag[]> => {
    const res = await apiClient.get('/api/v1/tags')
    return res.data
  },

  create: async (data: TagCreate): Promise<Tag> => {
    const res = await apiClient.post('/api/v1/tags', data)
    return res.data
  },

  update: async (id: number, data: Partial<TagCreate>): Promise<Tag> => {
    const res = await apiClient.put(`/api/v1/tags/${id}`, data)
    return res.data
  },

  delete: async (id: number): Promise<{ status: string }> => {
    const res = await apiClient.delete(`/api/v1/tags/${id}`)
    return res.data
  },

  // Client tag assignment
  listClientTags: async (clientId: number): Promise<ClientTag[]> => {
    const res = await apiClient.get(`/api/v1/clients/${clientId}/tags`)
    return res.data
  },

  assignClientTag: async (clientId: number, tagId: number): Promise<ClientTag> => {
    const res = await apiClient.post(`/api/v1/clients/${clientId}/tags`, { tag_id: tagId })
    return res.data
  },

  removeClientTag: async (clientId: number, tagId: number): Promise<{ status: string }> => {
    const res = await apiClient.delete(`/api/v1/clients/${clientId}/tags/${tagId}`)
    return res.data
  },

  // Auto-tag rules
  listRules: async (): Promise<AutoTagRule[]> => {
    const res = await apiClient.get('/api/v1/auto-tag-rules')
    return res.data
  },

  createRule: async (data: AutoTagRuleCreate): Promise<AutoTagRule> => {
    const res = await apiClient.post('/api/v1/auto-tag-rules', data)
    return res.data
  },

  updateRule: async (id: number, data: Partial<AutoTagRuleCreate>): Promise<AutoTagRule> => {
    const res = await apiClient.put(`/api/v1/auto-tag-rules/${id}`, data)
    return res.data
  },

  deleteRule: async (id: number): Promise<{ status: string }> => {
    const res = await apiClient.delete(`/api/v1/auto-tag-rules/${id}`)
    return res.data
  },
}
