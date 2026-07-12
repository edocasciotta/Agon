import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AvailabilityTab } from '../../../../src/renderer/src/pages/Appointments/AvailabilityTab'
import { useAuthStore } from '../../../../src/renderer/src/store/authStore'

vi.mock('../../../../src/renderer/src/api/instructors', () => ({
  instructorsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 1, user_id: 10, full_name: 'Maria Bianchi', email: 'maria@example.com', is_active: true },
      { id: 2, user_id: 11, full_name: 'Luca Verdi', email: 'luca@example.com', is_active: true },
    ]),
  },
}))

vi.mock('../../../../src/renderer/src/api/instructorAvailability', () => ({
  instructorAvailabilityApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AvailabilityTab />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.getState().logout()
})

describe('AvailabilityTab', () => {
  it('shows a manager-scoped instructor picker with all instructors', async () => {
    useAuthStore
      .getState()
      .setAuth('token', { id: 99, email: 'mgr@example.com', full_name: 'Manager', role: 'manager' })
    renderTab()

    expect(await screen.findByText('Maria Bianchi')).toBeTruthy()
    expect(screen.getByText('Luca Verdi')).toBeTruthy()
    expect(await screen.findByText('Monday')).toBeTruthy()
  })

  it('restricts an instructor caller to their own availability only', async () => {
    useAuthStore.getState().setAuth('token', {
      id: 10,
      email: 'maria@example.com',
      full_name: 'Maria Bianchi',
      role: 'instructor',
    })
    renderTab()

    // Self-service: no <select> dropdown, just their own name shown as text
    await waitFor(() => {
      expect(screen.getByText('Maria Bianchi')).toBeTruthy()
    })
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('denies access to a client caller', async () => {
    useAuthStore
      .getState()
      .setAuth('token', { id: 5, email: 'client@example.com', full_name: 'Client', role: 'client' })
    renderTab()

    expect(await screen.findByText("You don't have access to this tab.")).toBeTruthy()
  })

  it('adds an availability window for the selected day', async () => {
    useAuthStore
      .getState()
      .setAuth('token', { id: 99, email: 'mgr@example.com', full_name: 'Manager', role: 'manager' })
    const { instructorAvailabilityApi } = await import(
      '../../../../src/renderer/src/api/instructorAvailability'
    )
    renderTab()

    await screen.findByText('Monday')
    const startInputs = screen.getAllByLabelText('Start time')
    const endInputs = screen.getAllByLabelText('End time')
    fireEvent.change(startInputs[0], { target: { value: '09:00' } })
    fireEvent.change(endInputs[0], { target: { value: '17:00' } })

    const addButtons = screen.getAllByRole('button', { name: 'Add window' })
    fireEvent.click(addButtons[0])

    await waitFor(() => {
      expect(instructorAvailabilityApi.create).toHaveBeenCalled()
    })
    expect(vi.mocked(instructorAvailabilityApi.create).mock.calls[0][0]).toEqual({
      instructor_id: 1,
      day_of_week: 0,
      start_time: '09:00:00',
      end_time: '17:00:00',
    })
  })
})
