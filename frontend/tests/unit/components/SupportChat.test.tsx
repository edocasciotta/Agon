import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SupportChat } from '../../../src/renderer/src/components/SupportChat'

// Mock i18n
vi.mock('../../../src/renderer/src/i18n', () => ({
  default: {
    language: 'en',
    changeLanguage: vi.fn(),
  },
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const keys: Record<string, string> = {
        'support.title': 'Agon AI Support',
        'support.welcome': "Hi! I'm your Agon assistant. Ask me anything about managing your studio.",
        'support.placeholder': 'Ask a question...',
        'support.send': 'Send',
        'support.newChat': 'New Chat',
        'support.errorConnect': "I'm sorry, I couldn't connect right now. Please try again.",
        'support.close': 'Close support chat',
        'support.open': 'Open support chat',
      }
      return keys[key] ?? key
    },
  }),
}))

// Mock the support API module
vi.mock('../../../src/renderer/src/api/support', () => ({
  supportApi: {
    chat: vi.fn(),
  },
}))

import { supportApi } from '../../../src/renderer/src/api/support'

const mockSupportApi = vi.mocked(supportApi)

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

    // Panel should not be visible initially
    expect(screen.queryByText('Agon AI Support')).toBeNull()

    // Click the floating button to open
    fireEvent.click(screen.getByRole('button', { name: /open support chat/i }))

    // Panel header should now be visible
    expect(screen.getByText('Agon AI Support')).toBeTruthy()

    // Welcome message should appear
    expect(screen.getByText(/Hi! I'm your Agon assistant/)).toBeTruthy()

    // Click the close button inside the panel header (first one found)
    const closeBtns = screen.getAllByRole('button', { name: /close support chat/i })
    fireEvent.click(closeBtns[0])

    // Panel should be hidden again
    expect(screen.queryByText('Agon AI Support')).toBeNull()
  })

  it('shows "New Chat" button when panel is open', () => {
    render(<SupportChat />)
    fireEvent.click(screen.getByRole('button', { name: /open support chat/i }))
    // The New Chat button is in the sidebar
    const newChatBtns = screen.getAllByText('New Chat')
    expect(newChatBtns.length).toBeGreaterThan(0)
  })

  it('clicking "New Chat" creates a new session', () => {
    render(<SupportChat />)
    fireEvent.click(screen.getByRole('button', { name: /open support chat/i }))

    // Initially count all "New Chat" text occurrences
    const initialCount = screen.getAllByText('New Chat').length

    // Click New Chat button (button role in sidebar)
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }))

    // Now there should be one more "New Chat" entry in sidebar
    const newCount = screen.getAllByText('New Chat').length
    expect(newCount).toBeGreaterThan(initialCount)
  })

  it('sends a message and displays the reply', async () => {
    mockSupportApi.chat.mockResolvedValueOnce({ reply: 'Here is some helpful info!' })

    render(<SupportChat />)

    // Open the panel
    fireEvent.click(screen.getByRole('button', { name: /open support chat/i }))

    // Type a message
    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'How do I add a client?' } })

    // Click Send
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    // User message should appear in history (may appear in sidebar title + chat)
    expect(screen.getAllByText('How do I add a client?').length).toBeGreaterThan(0)

    // Wait for the assistant reply
    await waitFor(() => {
      expect(screen.getAllByText('Here is some helpful info!').length).toBeGreaterThan(0)
    })

    // Input should be cleared
    expect((input as HTMLInputElement).value).toBe('')
  })
})
