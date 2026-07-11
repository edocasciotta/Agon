import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ClientDetail } from '../../../src/renderer/src/pages/Clients/ClientDetail'

const { baseClient } = vi.hoisted(() => ({
  baseClient: {
    id: 1,
    full_name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+15551234567',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
}))

vi.mock('../../../src/renderer/src/api/clients', () => ({
  clientsApi: {
    get: vi.fn().mockResolvedValue(baseClient),
    bookings: vi.fn().mockResolvedValue([]),
    memberships: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(baseClient),
  },
}))

vi.mock('../../../src/renderer/src/api/memberships', () => ({
  membershipTypesApi: { list: vi.fn().mockResolvedValue([]) },
  membershipsApi: { create: vi.fn().mockResolvedValue({}) },
}))

vi.mock('../../../src/renderer/src/api/billing', () => ({
  billingApi: {
    getSubscription: vi.fn().mockResolvedValue({ subscription: null }),
    cancelSubscription: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../../../src/renderer/src/api/tags', () => ({
  tagsApi: {
    listClientTags: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue([]),
    assignClientTag: vi.fn().mockResolvedValue({}),
    removeClientTag: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../../../src/renderer/src/api/sms', () => ({
  smsApi: { send: vi.fn().mockResolvedValue({ status: 'sent' }) },
}))

vi.mock('../../../src/renderer/src/api/calendarSync', () => ({
  calendarSyncApi: {
    get: vi.fn().mockResolvedValue({ feed_url: 'http://localhost:8000/api/v1/calendar/abc123.ics' }),
    regenerate: vi.fn().mockResolvedValue({ feed_url: 'http://localhost:8000/api/v1/calendar/newtoken456.ics' }),
  },
}))

vi.mock('../../../src/renderer/src/api/waivers', () => ({
  waiversApi: {
    listForClient: vi.fn().mockResolvedValue([]),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={['/clients/1']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/clients/:id" element={<ClientDetail />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

beforeEach(async () => {
  vi.clearAllMocks()
  const { clientsApi } = await import('../../../src/renderer/src/api/clients')
  const { tagsApi } = await import('../../../src/renderer/src/api/tags')
  const { billingApi } = await import('../../../src/renderer/src/api/billing')
  const { calendarSyncApi } = await import('../../../src/renderer/src/api/calendarSync')
  vi.mocked(clientsApi.get).mockResolvedValue(baseClient)
  vi.mocked(clientsApi.bookings).mockResolvedValue([])
  vi.mocked(clientsApi.memberships).mockResolvedValue([])
  vi.mocked(tagsApi.listClientTags).mockResolvedValue([])
  vi.mocked(tagsApi.list).mockResolvedValue([])
  vi.mocked(billingApi.getSubscription).mockResolvedValue({ subscription: null })
  vi.mocked(calendarSyncApi.get).mockResolvedValue({
    feed_url: 'http://localhost:8000/api/v1/calendar/abc123.ics',
  })
  vi.mocked(calendarSyncApi.regenerate).mockResolvedValue({
    feed_url: 'http://localhost:8000/api/v1/calendar/newtoken456.ics',
  })

  const { waiversApi } = await import('../../../src/renderer/src/api/waivers')
  vi.mocked(waiversApi.listForClient).mockResolvedValue([])

  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

describe('ClientDetail — Calendar Sync', () => {
  it('fetches and displays the feed URL', async () => {
    const { calendarSyncApi } = await import('../../../src/renderer/src/api/calendarSync')
    renderPage()

    await waitFor(() => {
      expect(calendarSyncApi.get).toHaveBeenCalledWith(1)
    })

    const input = await screen.findByDisplayValue('http://localhost:8000/api/v1/calendar/abc123.ics')
    expect(input).toBeTruthy()
  })

  it('copies the feed URL to the clipboard and shows confirmation', async () => {
    renderPage()

    await screen.findByDisplayValue('http://localhost:8000/api/v1/calendar/abc123.ics')
    const copyBtn = screen.getByRole('button', { name: /copy/i })
    fireEvent.click(copyBtn)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/calendar/abc123.ics'
    )
    expect(await screen.findByText(/copied/i)).toBeTruthy()
  })

  it('shows a confirmation prompt before regenerating, and does not call the API until confirmed', async () => {
    const { calendarSyncApi } = await import('../../../src/renderer/src/api/calendarSync')
    renderPage()

    await screen.findByDisplayValue('http://localhost:8000/api/v1/calendar/abc123.ics')
    const regenerateBtn = screen.getByRole('button', { name: /regenerate/i })
    fireEvent.click(regenerateBtn)

    expect(await screen.findByText(/regenerate calendar link/i)).toBeTruthy()
    expect(calendarSyncApi.regenerate).not.toHaveBeenCalled()
  })

  it('regenerates the feed URL after confirming, and updates the displayed URL', async () => {
    const { calendarSyncApi } = await import('../../../src/renderer/src/api/calendarSync')
    renderPage()

    await screen.findByDisplayValue('http://localhost:8000/api/v1/calendar/abc123.ics')
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }))
    await screen.findByText(/regenerate calendar link/i)

    // The confirm panel has its own "Regenerate Link" action button distinct from the
    // trigger button that was just clicked (which the panel now covers/replaces).
    const confirmButtons = screen.getAllByRole('button', { name: /regenerate/i })
    fireEvent.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => {
      expect(calendarSyncApi.regenerate).toHaveBeenCalledWith(1)
    })

    const input = await screen.findByDisplayValue('http://localhost:8000/api/v1/calendar/newtoken456.ics')
    expect(input).toBeTruthy()
  })
})

describe('ClientDetail — Waivers', () => {
  it('fetches and shows a message when the client has no active waivers', async () => {
    const { waiversApi } = await import('../../../src/renderer/src/api/waivers')
    renderPage()

    await waitFor(() => {
      expect(waiversApi.listForClient).toHaveBeenCalledWith(1)
    })

    expect(await screen.findByText('No active waivers for this studio')).toBeTruthy()
  })

  it('shows a signed waiver with its signed date, and no action buttons', async () => {
    const { waiversApi } = await import('../../../src/renderer/src/api/waivers')
    vi.mocked(waiversApi.listForClient).mockResolvedValue([
      {
        id: 1,
        location_id: 1,
        title: 'Liability Waiver',
        body: 'Terms...',
        version: 1,
        requires_before_booking: true,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_signed: true,
        signed_at: '2024-02-15T00:00:00Z',
      },
    ])
    renderPage()

    expect(await screen.findByText('Liability Waiver')).toBeTruthy()
    expect(await screen.findByText('Signed on Feb 15, 2024')).toBeTruthy()
    expect(screen.getByText('Signed')).toBeTruthy()
    // No "sign for client" action should ever be rendered.
    expect(screen.queryByRole('button', { name: /sign/i })).toBeNull()
  })

  it('flags an unsigned required waiver with the blocks-booking badge', async () => {
    const { waiversApi } = await import('../../../src/renderer/src/api/waivers')
    vi.mocked(waiversApi.listForClient).mockResolvedValue([
      {
        id: 2,
        location_id: 1,
        title: 'Injury Release',
        body: 'Terms...',
        version: 2,
        requires_before_booking: true,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_signed: false,
        signed_at: null,
      },
    ])
    renderPage()

    expect(await screen.findByText('Injury Release')).toBeTruthy()
    expect(screen.getByText('Blocks booking')).toBeTruthy()
    expect(screen.getByText('Not signed')).toBeTruthy()
  })
})
