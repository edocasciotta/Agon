import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BookAppointmentModal } from '../../../src/renderer/src/components/BookAppointmentModal'

vi.mock('../../../src/renderer/src/api/appointmentServices', () => ({
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
      },
    ]),
  },
}))

vi.mock('../../../src/renderer/src/api/instructors', () => ({
  instructorsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 1, user_id: 10, full_name: 'Maria Bianchi', email: 'maria@example.com', is_active: true },
    ]),
  },
}))

vi.mock('../../../src/renderer/src/api/appointments', () => ({
  appointmentsApi: {
    availableSlots: vi.fn().mockResolvedValue([
      { starts_at: '2099-01-01T09:00:00', ends_at: '2099-01-01T10:00:00' },
      { starts_at: '2099-01-01T10:00:00', ends_at: '2099-01-01T11:00:00' },
    ]),
    create: vi.fn().mockResolvedValue({ id: 1 }),
  },
}))

vi.mock('../../../src/renderer/src/api/clients', () => ({
  clientsApi: {
    list: vi.fn().mockResolvedValue({
      items: [{ id: 7, full_name: 'John Client', email: 'john@example.com', is_active: true, created_at: '' }],
      total: 1,
      page: 1,
      page_size: 10,
    }),
  },
}))

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <BookAppointmentModal isOpen onClose={onClose} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('BookAppointmentModal', () => {
  it('renders nothing when closed', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <BookAppointmentModal isOpen={false} onClose={vi.fn()} />
      </QueryClientProvider>
    )
    expect(container.firstChild).toBeNull()
  })

  it('walks the service -> instructor -> slot -> client flow and books', async () => {
    renderModal()

    expect(await screen.findByText('New Appointment')).toBeTruthy()

    await screen.findByText('Personal Training (60 min)')
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: '1' } }) // service
    fireEvent.change(selects[1], { target: { value: '1' } }) // instructor

    const slotButton = await screen.findByRole('button', { name: '09:00' })
    fireEvent.click(slotButton)

    const clientInput = screen.getByPlaceholderText('Search by name or email...')
    fireEvent.change(clientInput, { target: { value: 'John' } })

    const clientOption = await screen.findByText('John Client')
    fireEvent.click(clientOption)

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }))

    const { appointmentsApi } = await import('../../../src/renderer/src/api/appointments')
    await waitFor(() => {
      expect(appointmentsApi.create).toHaveBeenCalled()
    })
    expect(vi.mocked(appointmentsApi.create).mock.calls[0][0]).toEqual({
      service_id: 1,
      instructor_id: 1,
      starts_at: '2099-01-01T09:00:00',
      client_id: 7,
      notes: undefined,
    })
  })

  it('shows a validation error when submitting without a client', async () => {
    renderModal()

    await screen.findByText('New Appointment')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }))

    expect(await screen.findByText('Service is required')).toBeTruthy()
  })

  it('closes on backdrop click', async () => {
    const onClose = vi.fn()
    renderModal(onClose)
    await screen.findByText('New Appointment')

    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalled()
  })
})
