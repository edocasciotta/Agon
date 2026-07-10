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
