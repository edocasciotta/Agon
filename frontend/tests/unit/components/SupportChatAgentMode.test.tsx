import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SupportChat } from '../../../src/renderer/src/components/SupportChat'

vi.mock('../../../src/renderer/src/i18n', () => ({
  default: { language: 'en', changeLanguage: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const keys: Record<string, string> = {
        'support.title': 'Agon AI Support',
        'support.placeholder': 'Ask a question...',
        'support.send': 'Send',
        'support.newChat': 'New Chat',
        'support.errorConnect': "I'm sorry, I couldn't connect right now. Please try again.",
        'support.close': 'Close support chat',
        'support.open': 'Open support chat',
        'support.emptyHint': 'Ask me anything about Agon.',
        'support.actionExecuted': 'Action completed',
        'support.deleteSession': 'Delete session',
      }
      return keys[key] ?? key
    },
  }),
}))

vi.mock('../../../src/renderer/src/api/support', () => ({
  supportApi: { chat: vi.fn() },
}))

vi.mock('../../../src/renderer/src/api/agent', () => ({
  agentApi: { act: vi.fn() },
}))

import { agentApi } from '../../../src/renderer/src/api/agent'

const mockAgentApi = vi.mocked(agentApi)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('SupportChat — agent integration', () => {
  it('shows the action banner when the agent performs an action', async () => {
    mockAgentApi.act.mockResolvedValueOnce({
      reply: 'Done. Created Yoga Flow on Wednesday at 18:00.',
      action: {
        type: 'created_class',
        scheduled_class: {
          id: 1,
          template_id: 1,
          instructor_id: null,
          location_id: 1,
          starts_at: '2026-07-08T18:00:00',
          ends_at: '2026-07-08T19:00:00',
          capacity: 20,
          status: 'scheduled',
        },
      },
      draft: null,
    })

    render(<SupportChat />)
    fireEvent.click(screen.getByRole('button', { name: /open support chat/i }))

    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'create a yoga class on wednesday' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(mockAgentApi.act).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getByText(/Action completed/)).toBeTruthy()
    })
    expect(screen.getByText(/Created Yoga Flow/)).toBeTruthy()
  })

  it('does not show an action banner when the agent only replies with a clarifying question', async () => {
    mockAgentApi.act.mockResolvedValueOnce({
      reply: 'Which location?',
      action: null,
      draft: { class_type: 'Yoga Flow' },
    })

    render(<SupportChat />)
    fireEvent.click(screen.getByRole('button', { name: /open support chat/i }))

    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'create a class' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(screen.getByText('Which location?')).toBeTruthy()
    })
    expect(screen.queryByText('Action completed')).toBeNull()
  })

  it('carries the draft forward to the next message in the same conversation', async () => {
    mockAgentApi.act.mockResolvedValueOnce({
      reply: 'Which location?',
      action: null,
      draft: { class_type: 'Yoga Flow' },
    })

    render(<SupportChat />)
    fireEvent.click(screen.getByRole('button', { name: /open support chat/i }))

    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'create a class' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(mockAgentApi.act).toHaveBeenCalledTimes(1)
    })
    // First call: language is 'en', draft is null
    expect(mockAgentApi.act.mock.calls[0][1]).toBe('en')
    expect(mockAgentApi.act.mock.calls[0][2]).toBeNull()

    mockAgentApi.act.mockResolvedValueOnce({
      reply: 'What time?',
      action: null,
      draft: { class_type: 'Yoga Flow', location: 'Milano' },
    })

    fireEvent.change(input, { target: { value: 'Milano' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(mockAgentApi.act).toHaveBeenCalledTimes(2)
    })
    // Second call: draft carries forward from first response
    expect(mockAgentApi.act.mock.calls[1][2]).toEqual({ class_type: 'Yoga Flow' })
  })
})
