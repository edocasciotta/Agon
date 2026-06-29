import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EmailTemplatesPage } from '../../../src/renderer/src/pages/EmailTemplates/index'

vi.mock('../../../src/renderer/src/api/emailTemplates', () => ({
  emailTemplatesApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <EmailTemplatesPage />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('EmailTemplatesPage', () => {
  it('renders the page heading', async () => {
    renderPage()
    const heading = await screen.findByText('Email Templates')
    expect(heading).toBeTruthy()
  })

  it('shows New Template button', async () => {
    renderPage()
    const button = await screen.findByRole('button', { name: /new template/i })
    expect(button).toBeTruthy()
  })

  it('renders template rows when templates exist', async () => {
    const { emailTemplatesApi } = await import(
      '../../../src/renderer/src/api/emailTemplates'
    )
    vi.mocked(emailTemplatesApi.list).mockResolvedValue([
      {
        id: 1,
        name: 'Welcome Email',
        subject: 'Hello {{client_name}}',
        created_at: '2024-01-01T00:00:00Z',
      },
    ])
    renderPage()
    const name = await screen.findByText('Welcome Email')
    expect(name).toBeTruthy()
  })
})
