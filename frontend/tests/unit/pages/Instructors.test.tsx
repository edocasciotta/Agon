import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { InstructorsPage } from '../../../src/renderer/src/pages/Instructors'

const listMock = vi.fn().mockResolvedValue([
  { id: 1, user_id: 1, full_name: 'Jane Smith', email: 'jane@example.com', bio: '', is_active: true },
])

vi.mock('../../../src/renderer/src/api/instructors', () => ({
  instructorsApi: {
    list: (...args: unknown[]) => listMock(...args),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('../../../src/renderer/src/api/classes', () => ({
  classesApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <InstructorsPage />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  listMock.mockClear()
})

describe('InstructorsPage', () => {
  it('renders the search input', async () => {
    renderPage()
    const input = await screen.findByPlaceholderText(/search by name or email/i)
    expect(input).toBeTruthy()
  })

  it('calls the API with the search term after typing (debounced)', async () => {
    renderPage()
    const input = await screen.findByPlaceholderText(/search by name or email/i)
    fireEvent.change(input, { target: { value: 'Jane' } })

    await waitFor(
      () => {
        expect(listMock).toHaveBeenCalledWith('Jane')
      },
      { timeout: 1000 }
    )
  })
})
