import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SmsEventsPage } from '../../../src/renderer/src/pages/SmsEvents/index'

vi.mock('../../../src/renderer/src/api/sms', () => ({
  smsApi: {
    listEvents: vi.fn().mockResolvedValue([]),
    listTemplates: vi.fn().mockResolvedValue([]),
    assignEventTemplate: vi.fn().mockResolvedValue({}),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SmsEventsPage />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SmsEventsPage', () => {
  it('renders the page heading', async () => {
    renderPage()
    const heading = await screen.findByText('SMS Events')
    expect(heading).toBeTruthy()
  })

  it('renders event rows with a template assignment dropdown', async () => {
    const { smsApi } = await import('../../../src/renderer/src/api/sms')
    vi.mocked(smsApi.listEvents).mockResolvedValue([
      { event_type: 'booking_confirmed', label: 'Booking confirmed', template: null },
    ])
    renderPage()
    const label = await screen.findByText('Booking confirmed')
    expect(label).toBeTruthy()
    const select = await screen.findByRole('combobox')
    expect(select).toBeTruthy()
  })
})
