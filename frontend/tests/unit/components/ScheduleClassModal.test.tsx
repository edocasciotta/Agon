import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ScheduleClassModal } from '../../../src/renderer/src/components/ScheduleClassModal'

vi.mock('../../../src/renderer/src/api/classTemplates', () => ({
  classTemplatesApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('../../../src/renderer/src/api/instructors', () => ({
  instructorsApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}))

function renderModal(props: Partial<React.ComponentProps<typeof ScheduleClassModal>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <ScheduleClassModal {...defaultProps} {...props} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ScheduleClassModal', () => {
  it('renders modal when open', () => {
    renderModal({ isOpen: true })
    // The modal header is an h2 with exactly this text
    const heading = screen.getByRole('heading', { name: 'Schedule Class' })
    expect(heading).toBeTruthy()
  })

  it('does not render when closed', () => {
    renderModal({ isOpen: false })
    expect(screen.queryByText('Schedule Class')).toBeNull()
  })

  it('shows both tabs', () => {
    renderModal({ isOpen: true })
    expect(screen.getByText('Single class')).toBeTruthy()
    expect(screen.getByText('Recurring class')).toBeTruthy()
  })
})
