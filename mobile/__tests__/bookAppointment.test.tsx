import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BookAppointmentScreen from '../app/appointment/book'
import { appointmentServicesApi } from '../src/api/appointmentServices'
import { instructorsApi } from '../src/api/instructors'
import { appointmentsApi } from '../src/api/appointments'

const mockReplace = jest.fn()
const mockBack = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
}))

jest.mock('../src/api/appointmentServices', () => ({
  appointmentServicesApi: { list: jest.fn() },
}))

jest.mock('../src/api/instructors', () => ({
  instructorsApi: { list: jest.fn() },
}))

jest.mock('../src/api/appointments', () => ({
  appointmentsApi: {
    availableSlots: jest.fn(),
    create: jest.fn(),
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
      <BookAppointmentScreen />
    </QueryClientProvider>
  )
}

const mockServices = [
  { id: 1, location_id: 1, name: 'Personal Training', duration_minutes: 60, buffer_minutes: 0, is_active: true, created_at: '', updated_at: '' },
]

const mockInstructors = [
  { id: 5, user_id: 5, full_name: 'Elena Rossi', email: 'elena@test.com', is_active: true },
]

beforeEach(() => {
  jest.clearAllMocks()
  ;(appointmentServicesApi.list as jest.Mock).mockResolvedValue(mockServices)
  ;(instructorsApi.list as jest.Mock).mockResolvedValue(mockInstructors)
  ;(appointmentsApi.availableSlots as jest.Mock).mockResolvedValue([
    { starts_at: '2026-08-01T10:00:00', ends_at: '2026-08-01T11:00:00' },
  ])
})

describe('BookAppointmentScreen', () => {
  it('renders the service step first', async () => {
    const { getByText, getByTestId } = renderScreen(makeClient())

    await waitFor(() => {
      expect(getByText('Personal Training')).toBeTruthy()
    })
    expect(getByTestId('service-1')).toBeTruthy()
  })

  it('walks through service -> instructor -> date -> slot -> notes and books', async () => {
    ;(appointmentsApi.create as jest.Mock).mockResolvedValue({ id: 99 })

    const { getByText, getByTestId, queryByTestId } = renderScreen(makeClient())

    // Step 1: service
    await waitFor(() => expect(getByTestId('service-1')).toBeTruthy())
    fireEvent.press(getByTestId('service-1'))

    // Step 2: instructor
    await waitFor(() => expect(getByTestId('instructor-5')).toBeTruthy())
    fireEvent.press(getByTestId('instructor-5'))

    // Step 3: date — pick the first available day
    await waitFor(() => expect(getByText('Select a date')).toBeTruthy())
    const today = new Date()
    const dateKey = `date-${today.toISOString().slice(0, 10)}`
    fireEvent.press(getByTestId(dateKey))

    // Step 4: slot
    await waitFor(() => {
      expect(queryByTestId('slot-2026-08-01T10:00:00')).toBeTruthy()
    })
    fireEvent.press(getByTestId('slot-2026-08-01T10:00:00'))

    // Step 5: notes + confirm
    await waitFor(() => expect(getByTestId('confirm-booking')).toBeTruthy())
    fireEvent.press(getByTestId('confirm-booking'))

    await waitFor(() => {
      expect(appointmentsApi.create).toHaveBeenCalled()
      const [variables] = (appointmentsApi.create as jest.Mock).mock.calls[0]
      expect(variables).toEqual({
        service_id: 1,
        instructor_id: 5,
        starts_at: '2026-08-01T10:00:00',
      })
    })
  })

  it('shows a friendly error message when booking fails with a known error code', async () => {
    ;(appointmentsApi.create as jest.Mock).mockRejectedValue({
      code: 'APPOINTMENT_SLOT_CONFLICT',
      message: 'conflict',
    })

    const { getByTestId, getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByTestId('service-1')).toBeTruthy())
    fireEvent.press(getByTestId('service-1'))
    await waitFor(() => expect(getByTestId('instructor-5')).toBeTruthy())
    fireEvent.press(getByTestId('instructor-5'))

    const today = new Date()
    const dateKey = `date-${today.toISOString().slice(0, 10)}`
    await waitFor(() => expect(getByTestId(dateKey)).toBeTruthy())
    fireEvent.press(getByTestId(dateKey))

    await waitFor(() => expect(getByTestId('slot-2026-08-01T10:00:00')).toBeTruthy())
    fireEvent.press(getByTestId('slot-2026-08-01T10:00:00'))

    await waitFor(() => expect(getByTestId('confirm-booking')).toBeTruthy())
    fireEvent.press(getByTestId('confirm-booking'))

    await waitFor(() => {
      expect(getByText('This time slot was just taken. Please pick another one.')).toBeTruthy()
    })
  })
})
