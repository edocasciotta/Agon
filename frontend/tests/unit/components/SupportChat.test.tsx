import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SupportChat } from '../../../src/renderer/src/components/SupportChat'

vi.mock('../../../src/renderer/src/i18n', () => ({
  default: {
    language: 'en',
    changeLanguage: vi.fn(),
  },
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
        'support.deleteSession': 'Delete session',
        'support.emptyHint': 'Ask me anything about Agon.',
        'support.actionExecuted': 'Action completed',
      }
      return keys[key] ?? key
    },
  }),
}))

vi.mock('../../../src/renderer/src/api/agent', () => ({
  agentApi: {
    act: vi.fn(),
  },
}))

vi.mock('../../../src/renderer/src/api/support', () => ({
  supportApi: { chat: vi.fn() },
}))

import { agentApi } from '../../../src/renderer/src/api/agent'

const mockAgentApi = vi.mocked(agentApi)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('SupportChat', () => {
  it('renders floating button', () => {
    render(<SupportChat />)
    const button = screen.getByRole('button', { name: /open support chat/i })
    expect(button).toBeTruthy()
  })

  it('opens and closes panel', () => {
    render(<SupportChat />)

    expect(screen.queryByText('Agon AI Support')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /open support chat/i }))

    expect(screen.getByText('Agon AI Support')).toBeTruthy()

    const closeBtns = screen.getAllByRole('button', { name: /close support chat/i })
    fireEvent.click(closeBtns[0])

    expect(screen.queryByText('Agon AI Support')).toBeNull()
  })

  it('shows "New Chat" button when panel is open', () => {
    render(<SupportChat />)
    fireEvent.click(screen.getByRole('button', { name: /open support chat/i }))
    const newChatBtns = screen.getAllByText('New Chat')
    expect(newChatBtns.length).toBeGreaterThan(0)
  })

  it('clicking "New Chat" creates a new session', () => {
    render(<SupportChat />)
    fireEvent.click(screen.getByRole('button', { name: /open support chat/i }))

    const initialCount = screen.getAllByText('New Chat').length

    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }))

    const newCount = screen.getAllByText('New Chat').length
    expect(newCount).toBeGreaterThan(initialCount)
  })

  it('sends a message and displays the reply', async () => {
    mockAgentApi.act.mockResolvedValueOnce({
      reply: 'Here is some helpful info!',
      action: null,
      draft: null,
    })

    render(<SupportChat />)

    fireEvent.click(screen.getByRole('button', { name: /open support chat/i }))

    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'How do I add a client?' } })

    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(screen.getAllByText('How do I add a client?').length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(screen.getAllByText('Here is some helpful info!').length).toBeGreaterThan(0)
    })

    expect((input as HTMLInputElement).value).toBe('')
  })
})
