import { apiClient } from './client'
import type { ChatMessage } from './support'

export interface AgentAction {
  type: string
  scheduled_class: {
    id: number
    template_id: number
    instructor_id: number | null
    location_id: number
    starts_at: string
    ends_at: string
    capacity: number
    status: string
  }
}

export type AgentDraft = Record<string, unknown>

export interface AgentUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface AgentActResponse {
  reply: string
  action: AgentAction | null
  draft: AgentDraft | null
  usage: AgentUsage | null
}

export const agentApi = {
  act: async (
    messages: ChatMessage[],
    language: string,
    draft?: AgentDraft | null,
  ): Promise<AgentActResponse> => {
    const response = await apiClient.post('/api/v1/agent/act', {
      messages,
      language,
      draft: draft ?? null,
    })
    return response.data
  },
}
