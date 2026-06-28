import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClassTypesPage } from '../../../src/renderer/src/pages/ClassTypes'

vi.mock('../../../src/renderer/src/api/classTemplates', () => ({
  classTemplatesApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../../src/renderer/src/api/instructors', () => ({
  instructorsApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ClassTypesPage />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ClassTypesPage', () => {
  it('shows empty state when no class types', async () => {
    const { classTemplatesApi } = await import('../../../src/renderer/src/api/classTemplates')
    vi.mocked(classTemplatesApi.list).mockResolvedValue([])

    renderPage()

    const message = await screen.findByText(
      'No class types yet. Create your first one to start scheduling classes.'
    )
    expect(message).toBeTruthy()
  })

  it('renders class type cards', async () => {
    const { classTemplatesApi } = await import('../../../src/renderer/src/api/classTemplates')
    vi.mocked(classTemplatesApi.list).mockResolvedValue([
      {
        id: 1,
        name: 'Yoga Flow',
        duration_minutes: 60,
        default_capacity: 20,
        color: '#4F46E5',
        is_active: true,
      },
    ])

    renderPage()

    const name = await screen.findByText('Yoga Flow')
    expect(name).toBeTruthy()
  })

  it('shows new class type form when button clicked', async () => {
    const { classTemplatesApi } = await import('../../../src/renderer/src/api/classTemplates')
    vi.mocked(classTemplatesApi.list).mockResolvedValue([])

    renderPage()

    // Wait for the empty state to appear with the New Class Type button
    const button = await screen.findByRole('button', { name: /new class type/i })
    fireEvent.click(button)

    const heading = await screen.findByRole('heading', { name: /new class type/i })
    expect(heading).toBeTruthy()
  })
})
