import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ClientsPage } from '../../../src/renderer/src/pages/Clients'

vi.mock('../../../src/renderer/src/api/clients', () => ({
  clientsApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, full_name: 'Test User', email: 'test@example.com', is_active: true, created_at: new Date().toISOString(), email_sent: true }),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ClientsPage />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ClientsPage', () => {
  it('renders the Add Client button', async () => {
    renderPage()
    const btn = await screen.findByRole('button', { name: /add client|aggiungi|nuevo|nouveau/i })
    expect(btn).toBeTruthy()
  })

  it('opens the New Client modal when button is clicked', async () => {
    renderPage()
    const btn = await screen.findByRole('button', { name: /\+ add client/i })
    fireEvent.click(btn)

    const modalHeading = await screen.findByText(/add new client/i)
    expect(modalHeading).toBeTruthy()
  })

  it('modal shows full name, email and phone fields', async () => {
    renderPage()
    const btn = await screen.findByRole('button', { name: /\+ add client/i })
    fireEvent.click(btn)

    expect(await screen.findByText(/full name/i)).toBeTruthy()
    expect(await screen.findByText(/email address/i)).toBeTruthy()
    expect(await screen.findByText(/phone \(optional\)/i)).toBeTruthy()
  })

  it('closes modal when cancel is clicked', async () => {
    renderPage()
    const openBtn = await screen.findByRole('button', { name: /\+ add client/i })
    fireEvent.click(openBtn)

    const cancelBtn = await screen.findByRole('button', { name: /cancel/i })
    fireEvent.click(cancelBtn)

    expect(screen.queryByText(/add new client/i)).toBeNull()
  })
})
