import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ServicesTab } from '../../../../src/renderer/src/pages/Appointments/ServicesTab'

vi.mock('../../../../src/renderer/src/api/appointmentServices', () => ({
  appointmentServicesApi: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    deactivate: vi.fn().mockResolvedValue({}),
  },
}))

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ServicesTab />
    </QueryClientProvider>
  )
}

const sampleService = {
  id: 1,
  location_id: 1,
  name: 'Personal Training',
  description: 'One-on-one strength coaching',
  duration_minutes: 60,
  buffer_minutes: 15,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ServicesTab', () => {
  it('shows empty state when there are no services', async () => {
    renderTab()
    expect(await screen.findByText('No services yet')).toBeTruthy()
  })

  it('renders service rows when services exist', async () => {
    const { appointmentServicesApi } = await import(
      '../../../../src/renderer/src/api/appointmentServices'
    )
    vi.mocked(appointmentServicesApi.list).mockResolvedValue([sampleService])
    renderTab()

    expect(await screen.findByText('Personal Training')).toBeTruthy()
    expect(screen.getByText('Active')).toBeTruthy()
  })

  it('creates a new service via the modal', async () => {
    const { appointmentServicesApi } = await import(
      '../../../../src/renderer/src/api/appointmentServices'
    )
    vi.mocked(appointmentServicesApi.list).mockResolvedValue([sampleService])
    vi.mocked(appointmentServicesApi.create).mockResolvedValue({
      ...sampleService,
      id: 2,
      name: 'Massage',
    })
    renderTab()

    await screen.findByText('Personal Training')
    fireEvent.click(screen.getByRole('button', { name: /new service/i }))

    fireEvent.change(screen.getByPlaceholderText('e.g. Personal Training'), {
      target: { value: 'Massage' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(appointmentServicesApi.create).toHaveBeenCalled()
    })
    expect(vi.mocked(appointmentServicesApi.create).mock.calls[0][0]).toMatchObject({
      name: 'Massage',
      duration_minutes: 60,
      buffer_minutes: 0,
    })
  })

  it('deactivates a service using the non-destructive confirm dialog', async () => {
    const { appointmentServicesApi } = await import(
      '../../../../src/renderer/src/api/appointmentServices'
    )
    vi.mocked(appointmentServicesApi.list).mockResolvedValue([sampleService])
    vi.mocked(appointmentServicesApi.deactivate).mockResolvedValue({
      ...sampleService,
      is_active: false,
    })
    renderTab()

    await screen.findByText('Personal Training')
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))

    expect(await screen.findByText('Deactivate this service?')).toBeTruthy()
    expect(appointmentServicesApi.deactivate).not.toHaveBeenCalled()

    const confirmButtons = screen.getAllByRole('button', { name: 'Deactivate' })
    fireEvent.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => {
      expect(appointmentServicesApi.deactivate).toHaveBeenCalledWith(1)
    })
  })
})
