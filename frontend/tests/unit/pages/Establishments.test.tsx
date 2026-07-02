import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EstablishmentsPage } from '../../../src/renderer/src/pages/Establishments'

const listMock = vi.fn().mockResolvedValue([
  { id: 1, name: 'Main Studio', address: null, phone: null, is_active: true },
])

vi.mock('../../../src/renderer/src/api/locations', () => ({
  locationsApi: {
    list: (...args: unknown[]) => listMock(...args),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    remove: vi.fn(),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <EstablishmentsPage />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  listMock.mockClear()
})

describe('EstablishmentsPage', () => {
  it('renders the search input', async () => {
    renderPage()
    const input = await screen.findByPlaceholderText(/search by name/i)
    expect(input).toBeTruthy()
  })

  it('calls the API with the search term after typing (debounced)', async () => {
    renderPage()
    const input = await screen.findByPlaceholderText(/search by name/i)
    fireEvent.change(input, { target: { value: 'Downtown' } })

    await waitFor(
      () => {
        expect(listMock).toHaveBeenCalledWith(true, 'Downtown')
      },
      { timeout: 1000 }
    )
  })
})
