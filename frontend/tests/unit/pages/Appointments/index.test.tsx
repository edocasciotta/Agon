import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppointmentsPage } from '../../../../src/renderer/src/pages/Appointments/index'
import { useAuthStore } from '../../../../src/renderer/src/store/authStore'

vi.mock('../../../../src/renderer/src/api/instructors', () => ({
  instructorsApi: { list: vi.fn().mockResolvedValue([]) },
}))
vi.mock('../../../../src/renderer/src/api/appointmentServices', () => ({
  appointmentServicesApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  },
}))
vi.mock('../../../../src/renderer/src/api/instructorAvailability', () => ({
  instructorAvailabilityApi: { list: vi.fn().mockResolvedValue([]), create: vi.fn(), delete: vi.fn() },
}))
vi.mock('../../../../src/renderer/src/api/appointments', () => ({
  appointmentsApi: {
    list: vi.fn().mockResolvedValue([]),
    availableSlots: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    cancel: vi.fn(),
    complete: vi.fn(),
  },
}))
vi.mock('../../../../src/renderer/src/api/clients', () => ({
  clientsApi: { list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 }), get: vi.fn() },
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AppointmentsPage />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.getState().logout()
})

describe('AppointmentsPage', () => {
  it('shows Upcoming, Services, and Availability tabs for a manager', async () => {
    useAuthStore
      .getState()
      .setAuth('token', { id: 1, email: 'mgr@example.com', full_name: 'Manager', role: 'manager' })
    renderPage()

    expect(await screen.findByRole('tab', { name: 'Upcoming' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Services' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Availability' })).toBeTruthy()
  })

  it('hides the Services tab for an instructor caller', async () => {
    useAuthStore.getState().setAuth('token', {
      id: 10,
      email: 'inst@example.com',
      full_name: 'Instructor',
      role: 'instructor',
    })
    renderPage()

    await screen.findByRole('tab', { name: 'Upcoming' })
    expect(screen.queryByRole('tab', { name: 'Services' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Availability' })).toBeTruthy()
  })

  it('switches to the Services tab on click', async () => {
    useAuthStore
      .getState()
      .setAuth('token', { id: 1, email: 'mgr@example.com', full_name: 'Manager', role: 'manager' })
    renderPage()

    const servicesTab = await screen.findByRole('tab', { name: 'Services' })
    fireEvent.click(servicesTab)

    expect(await screen.findByText('No services yet')).toBeTruthy()
  })
})
