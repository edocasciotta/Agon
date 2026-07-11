import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GiftCardsPage } from '../../../src/renderer/src/pages/GiftCards'

vi.mock('../../../src/renderer/src/api/giftCards', () => ({
  giftCardsApi: {
    list: vi.fn().mockResolvedValue([]),
    issue: vi.fn().mockResolvedValue({}),
    get: vi.fn(),
    deactivate: vi.fn().mockResolvedValue({}),
    validate: vi.fn(),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <GiftCardsPage />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GiftCardsPage', () => {
  it('shows empty state when no gift cards', async () => {
    const { giftCardsApi } = await import('../../../src/renderer/src/api/giftCards')
    vi.mocked(giftCardsApi.list).mockResolvedValue([])

    renderPage()

    const message = await screen.findByText('No gift cards yet')
    expect(message).toBeTruthy()
  })

  it('renders gift card rows with code and recipient', async () => {
    const { giftCardsApi } = await import('../../../src/renderer/src/api/giftCards')
    vi.mocked(giftCardsApi.list).mockResolvedValue([
      {
        id: 1,
        location_id: 1,
        code: 'GIFT-ABC123',
        initial_value: 50,
        remaining_balance: 35,
        currency: 'EUR',
        purchaser_client_id: null,
        recipient_name: 'Maria Rossi',
        recipient_email: 'maria@example.com',
        message: null,
        is_active: true,
        expires_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ])

    renderPage()

    const code = await screen.findByText('GIFT-ABC123')
    expect(code).toBeTruthy()
    expect(screen.getByText('Maria Rossi')).toBeTruthy()
  })

  it('shows the — placeholder when a gift card has no recipient', async () => {
    const { giftCardsApi } = await import('../../../src/renderer/src/api/giftCards')
    vi.mocked(giftCardsApi.list).mockResolvedValue([
      {
        id: 2,
        location_id: 1,
        code: 'GIFT-XYZ789',
        initial_value: 25,
        remaining_balance: 25,
        currency: 'EUR',
        purchaser_client_id: null,
        recipient_name: null,
        recipient_email: null,
        message: null,
        is_active: true,
        expires_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ])

    renderPage()

    await screen.findByText('GIFT-XYZ789')
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('opens the issue modal when the header button is clicked', async () => {
    const { giftCardsApi } = await import('../../../src/renderer/src/api/giftCards')
    vi.mocked(giftCardsApi.list).mockResolvedValue([
      {
        id: 1,
        location_id: 1,
        code: 'GIFT-ABC123',
        initial_value: 50,
        remaining_balance: 50,
        currency: 'EUR',
        purchaser_client_id: null,
        recipient_name: null,
        recipient_email: null,
        message: null,
        is_active: true,
        expires_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ])

    renderPage()

    const button = await screen.findByRole('button', { name: /issue gift card/i })
    fireEvent.click(button)

    const heading = await screen.findByRole('heading', { name: /issue gift card/i })
    expect(heading).toBeTruthy()
  })

  it('shows the deactivate confirmation dialog with red styling', async () => {
    const { giftCardsApi } = await import('../../../src/renderer/src/api/giftCards')
    vi.mocked(giftCardsApi.list).mockResolvedValue([
      {
        id: 1,
        location_id: 1,
        code: 'GIFT-ABC123',
        initial_value: 50,
        remaining_balance: 50,
        currency: 'EUR',
        purchaser_client_id: null,
        recipient_name: null,
        recipient_email: null,
        message: null,
        is_active: true,
        expires_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ])

    renderPage()

    const deactivateLink = await screen.findByText('Deactivate')
    fireEvent.click(deactivateLink)

    const confirmHeading = await screen.findByText('Deactivate this gift card?')
    expect(confirmHeading).toBeTruthy()

    const confirmButton = screen
      .getAllByText('Deactivate')
      .find((el) => el.tagName === 'BUTTON' && el.className.includes('bg-red-600'))
    expect(confirmButton).toBeTruthy()
  })
})
