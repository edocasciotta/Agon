import { apiClient } from './client'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SupportChatResponse {
  reply: string
}

export const supportApi = {
  chat: async (messages: ChatMessage[], language?: string): Promise<SupportChatResponse> => {
    const response = await apiClient.post('/api/v1/support/chat', { messages, language })
    return response.data
  },
}
