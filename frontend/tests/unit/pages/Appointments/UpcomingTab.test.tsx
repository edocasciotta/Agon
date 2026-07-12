import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UpcomingTab } from '../../../../src/renderer/src/pages/Appointments/UpcomingTab'
import { useAuthStore } from '../../../../src/renderer/src/store/authStore'

vi.mock('../../../../src/renderer/src/api/instructors', () => ({
  instructorsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 1, user_id: 10, full_name: 'Maria Bianchi', email: 'maria@example.com', is_active: true },
    ]),
  },
}))

vi.mock('../../../../src/renderer/src/api/appointmentServices', () => ({
  appointmentServicesApi: {
    list: vi.fn().mockResolvedValue([
      { id: 1, location_id: 1, name: 'Personal Training', duration_minutes: 60, buffer_minutes: 0, is_active: true, created_at: '', updated_at: '' },
    ]),
  },
}))

vi.mock('../../../../src/renderer/src/api/clients', () => ({
  clientsApi: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 }),
    get: vi.fn().mockResolvedValue({ id: 7, full_name: 'John Client', email: 'john@example.com', is_active: true, created_at: '' }),
  },
}))

const sampleAppointment = {
  id: 1,
  location_id: 1,
  service_id: 1,
  instructor_id: 1,
  client_id: 7,
  starts_at: '2099-01-01T10:00:00',
  ends_at: '2099-01-01T11:00:00',
  status: 'confirmed' as const,
  credit_deducted: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

vi.mock('../../../../src/renderer/src/api/appointments', () => ({
  appointmentsApi: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    availableSlots: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    cancel: vi.fn().mockResolvedValue({}),
    complete: vi.fn().mockResolvedValue({}),
  },
}))

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <UpcomingTab />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.getState().logout()
  useAuthStore
    .getState()
    .setAuth('token', { id: 99, email: 'mgr@example.com', full_name: 'Manager', role: 'manager' })
})

describe('UpcomingTab', () => {
  it('shows empty state when there are no appointments', async () => {
    renderTab()
    expect(await screen.findByText('No appointments yet')).toBeTruthy()
  })

  it('renders an appointment row with resolved service/instructor/client names', async () => {
    const { appointmentsApi } = await import('../../../../src/renderer/src/api/appointments')
    vi.mocked(appointmentsApi.list).mockResolvedValue([sampleAppointment])
    renderTab()

    expect(await screen.findByText('Personal Training')).toBeTruthy()
    expect(screen.getAllByText('Maria Bianchi').length).toBeGreaterThan(0)
    expect(await screen.findByText('John Client')).toBeTruthy()
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0)
  })

  it('cancels an appointment via the red confirm dialog', async () => {
    const { appointmentsApi } = await import('../../../../src/renderer/src/api/appointments')
    vi.mocked(appointmentsApi.list).mockResolvedValue([sampleAppointment])
    renderTab()

    await screen.findByText('Personal Training')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByText('Cancel this appointment?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }))

    await waitFor(() => {
      expect(appointmentsApi.cancel).toHaveBeenCalledWith(1)
    })
  })

  it('marks an appointment complete', async () => {
    const { appointmentsApi } = await import('../../../../src/renderer/src/api/appointments')
    vi.mocked(appointmentsApi.list).mockResolvedValue([sampleAppointment])
    renderTab()

    await screen.findByText('Personal Training')
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }))

    await waitFor(() => {
      expect(appointmentsApi.complete).toHaveBeenCalledWith(1, 'completed')
    })
  })
})
