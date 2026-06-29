import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SmartListsPage } from '../../../src/renderer/src/pages/SmartLists/index'

vi.mock('../../../src/renderer/src/api/smartLists', () => ({
  smartListsApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
    preview: vi.fn().mockResolvedValue({ count: 0, clients: [] }),
  },
}))

vi.mock('../../../src/renderer/src/api/memberships', () => ({
  membershipTypesApi: {
    list: vi.fn().mockResolvedValue([]),
  },
  membershipsApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    cancel: vi.fn().mockResolvedValue({}),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SmartListsPage />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SmartListsPage', () => {
  it('renders the page heading', async () => {
    renderPage()
    const heading = await screen.findByText('Smart Lists')
    expect(heading).toBeTruthy()
  })

  it('shows New Smart List button', async () => {
    renderPage()
    const button = await screen.findByRole('button', { name: /new smart list/i })
    expect(button).toBeTruthy()
  })

  it('renders smart list items when lists exist', async () => {
    const { smartListsApi } = await import(
      '../../../src/renderer/src/api/smartLists'
    )
    vi.mocked(smartListsApi.list).mockResolvedValue([
      {
        id: 1,
        name: 'Active Members',
        description: 'All currently active members',
        created_at: '2024-01-01T00:00:00Z',
      },
    ])
    renderPage()
    const name = await screen.findByText('Active Members')
    expect(name).toBeTruthy()
  })
})
