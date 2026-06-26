import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SupportChat } from '../../../src/renderer/src/components/SupportChat'

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

    // Click the close button inside the panel header
    fireEvent.click(screen.getByRole('button', { name: /close support chat/i }))

    // Panel should be hidden again
    expect(screen.queryByText('Agon AI Support')).toBeNull()
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

    // User message should appear in history
    expect(screen.getByText('How do I add a client?')).toBeTruthy()

    // Wait for the assistant reply
    await waitFor(() => {
      expect(screen.getByText('Here is some helpful info!')).toBeTruthy()
    })

    // Input should be cleared
    expect((input as HTMLInputElement).value).toBe('')
  })
})
