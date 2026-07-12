import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Alert } from 'react-native'
import AppointmentsScreen from '../app/(tabs)/appointments'
import { appointmentsApi } from '../src/api/appointments'
import { appointmentServicesApi } from '../src/api/appointmentServices'
import { instructorsApi } from '../src/api/instructors'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('../src/api/appointments', () => ({
  appointmentsApi: {
    list: jest.fn(),
    cancel: jest.fn(),
  },
}))

jest.mock('../src/api/appointmentServices', () => ({
  appointmentServicesApi: {
    list: jest.fn(),
  },
}))

jest.mock('../src/api/instructors', () => ({
  instructorsApi: {
    list: jest.fn(),
  },
}))

jest.mock('../src/store/connectivityStore', () => ({
  useConnectivityStore: () => ({ isOnline: true, lastOnlineAt: null }),
}))

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderScreen(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <AppointmentsScreen />
    </QueryClientProvider>
  )
}

const mockServices = [
  { id: 1, location_id: 1, name: 'Personal Training', duration_minutes: 60, buffer_minutes: 0, is_active: true, created_at: '', updated_at: '' },
]

const mockInstructors = [
  { id: 5, user_id: 5, full_name: 'Elena Rossi', email: 'elena@test.com', is_active: true },
]

const mockAppointment = {
  id: 1,
  location_id: 1,
  service_id: 1,
  instructor_id: 5,
  client_id: 42,
  starts_at: '2026-08-01T10:00:00',
  ends_at: '2026-08-01T11:00:00',
  status: 'confirmed' as const,
  credit_deducted: true,
  created_at: '2026-07-01T00:00:00',
  updated_at: '2026-07-01T00:00:00',
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(appointmentServicesApi.list as jest.Mock).mockResolvedValue(mockServices)
  ;(instructorsApi.list as jest.Mock).mockResolvedValue(mockInstructors)
})

describe('AppointmentsScreen', () => {
  it('shows empty state when there are no appointments', async () => {
    ;(appointmentsApi.list as jest.Mock).mockResolvedValue([])

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => {
      expect(getByText('No appointments yet.')).toBeTruthy()
    })
  })

  it('renders an upcoming appointment with service and instructor names', async () => {
    ;(appointmentsApi.list as jest.Mock).mockResolvedValue([mockAppointment])

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => {
      expect(getByText('Personal Training')).toBeTruthy()
    })
    expect(getByText('with Elena Rossi')).toBeTruthy()
    expect(getByText('Upcoming')).toBeTruthy()
  })

  it('navigates to the booking flow when "Book an Appointment" is pressed', async () => {
    ;(appointmentsApi.list as jest.Mock).mockResolvedValue([])

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => {
      expect(getByText('Book an Appointment')).toBeTruthy()
    })
    fireEvent.press(getByText('Book an Appointment'))
    expect(mockPush).toHaveBeenCalledWith('/appointment/book')
  })

  it('cancels an appointment after confirming the alert', async () => {
    ;(appointmentsApi.list as jest.Mock).mockResolvedValue([mockAppointment])
    ;(appointmentsApi.cancel as jest.Mock).mockResolvedValue({ ...mockAppointment, status: 'cancelled' })

    const alertSpy = jest.spyOn(Alert, 'alert')

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => {
      expect(getByText('Cancel Appointment')).toBeTruthy()
    })
    fireEvent.press(getByText('Cancel Appointment'))

    expect(alertSpy).toHaveBeenCalled()
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[]
    const confirmButton = buttons.find((b) => b.text === 'Cancel Appointment')
    confirmButton?.onPress?.()

    await waitFor(() => {
      expect(appointmentsApi.cancel).toHaveBeenCalledWith(1)
    })
  })
})
