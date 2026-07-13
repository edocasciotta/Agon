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

vi.mock('../../../../src/renderer/src/api/appointmentServices', () => ({
  appointmentServicesApi: {
    list: vi.fn().mockResolvedValue([
      {
        id: 1,
        location_id: 1,
        name: 'Personal Training',
        duration_minutes: 60,
        buffer_minutes: 0,
        is_active: true,
        created_at: '',
        updated_at: '',
        establishment_ids: [],
      },
      {
        id: 2,
        location_id: 1,
        name: 'Massage',
        duration_minutes: 45,
        buffer_minutes: 15,
        is_active: true,
        created_at: '',
        updated_at: '',
        establishment_ids: [],
      },
    ]),
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

    // Self-service: no instructor-picker <select>, just their own name shown
    // as text. The per-day service scoping <select>s are a separate control
    // that's still expected to render, so assert none of them expose the
    // *other* instructor's name as an option (which would only happen if the
    // instructor picker itself were rendered).
    await waitFor(() => {
      expect(screen.getByText('Maria Bianchi')).toBeTruthy()
    })
    expect(screen.queryByText('Luca Verdi')).toBeNull()
  })

  it('denies access to a client caller', async () => {
    useAuthStore
      .getState()
      .setAuth('token', { id: 5, email: 'client@example.com', full_name: 'Client', role: 'client' })
    renderTab()

    expect(await screen.findByText("You don't have access to this tab.")).toBeTruthy()
  })

  it('adds an availability window scoped to "All services" by default', async () => {
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
      service_id: null,
    })
  })

  it('sends the selected service_id when an availability window is scoped to a specific service', async () => {
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
    const serviceSelects = screen.getAllByLabelText('Service')
    fireEvent.change(startInputs[0], { target: { value: '09:00' } })
    fireEvent.change(endInputs[0], { target: { value: '17:00' } })
    fireEvent.change(serviceSelects[0], { target: { value: '2' } })

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
      service_id: 2,
    })
  })

  it('shows a scope badge for existing availability windows', async () => {
    useAuthStore
      .getState()
      .setAuth('token', { id: 99, email: 'mgr@example.com', full_name: 'Manager', role: 'manager' })
    const { instructorAvailabilityApi } = await import(
      '../../../../src/renderer/src/api/instructorAvailability'
    )
    vi.mocked(instructorAvailabilityApi.list).mockResolvedValue([
      {
        id: 1,
        location_id: 1,
        instructor_id: 1,
        day_of_week: 0,
        start_time: '09:00:00',
        end_time: '12:00:00',
        is_active: true,
        created_at: '',
        updated_at: '',
        service_id: null,
      },
      {
        id: 2,
        location_id: 1,
        instructor_id: 1,
        day_of_week: 0,
        start_time: '13:00:00',
        end_time: '15:00:00',
        is_active: true,
        created_at: '',
        updated_at: '',
        service_id: 2,
      },
    ])
    renderTab()

    // Scope to <span> (the badge) since "All services" / "Massage" also
    // appear as <option> text inside every day's service <select>.
    expect(await screen.findByText('All services', { selector: 'span' })).toBeTruthy()
    expect(await screen.findByText('Massage', { selector: 'span' })).toBeTruthy()
  })
})
