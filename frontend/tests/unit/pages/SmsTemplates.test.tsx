import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SmsTemplatesPage } from '../../../src/renderer/src/pages/SmsTemplates/index'

vi.mock('../../../src/renderer/src/api/sms', () => ({
  smsApi: {
    listTemplates: vi.fn().mockResolvedValue([]),
    createTemplate: vi.fn().mockResolvedValue({}),
    getTemplate: vi.fn().mockResolvedValue({}),
    updateTemplate: vi.fn().mockResolvedValue({}),
    deleteTemplate: vi.fn().mockResolvedValue(undefined),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SmsTemplatesPage />
    </QueryClientProvider>
  )
}

beforeEach(async () => {
  vi.clearAllMocks()
  const { smsApi } = await import('../../../src/renderer/src/api/sms')
  vi.mocked(smsApi.listTemplates).mockResolvedValue([])
})

describe('SmsTemplatesPage', () => {
  it('renders the page heading', async () => {
    renderPage()
    const heading = await screen.findByText('SMS Templates')
    expect(heading).toBeTruthy()
  })

  it('shows Create Template button', async () => {
    const { smsApi } = await import('../../../src/renderer/src/api/sms')
    vi.mocked(smsApi.listTemplates).mockResolvedValue([
      {
        id: 1,
        name: 'Booking Reminder',
        body: 'Hi {{client_name}}, see you soon!',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ])
    renderPage()
    const button = await screen.findByRole('button', { name: /create template/i })
    expect(button).toBeTruthy()
  })

  it('renders template rows when templates exist', async () => {
    const { smsApi } = await import('../../../src/renderer/src/api/sms')
    vi.mocked(smsApi.listTemplates).mockResolvedValue([
      {
        id: 1,
        name: 'Booking Reminder',
        body: 'Hi {{client_name}}, see you soon!',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ])
    renderPage()
    const name = await screen.findByText('Booking Reminder')
    expect(name).toBeTruthy()
  })

  it('shows empty state when no templates exist', async () => {
    renderPage()
    const empty = await screen.findByText('No SMS templates yet')
    expect(empty).toBeTruthy()
  })
})
