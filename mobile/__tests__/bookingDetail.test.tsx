import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Alert } from 'react-native'
import BookingDetailScreen from '../app/booking/[id]'
import { bookingsApi } from '../src/api/bookings'

const mockBack = jest.fn()

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '1' }),
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  Stack: { Screen: () => null },
}))

jest.mock('../src/api/bookings', () => ({
  bookingsApi: {
    get: jest.fn(),
    cancel: jest.fn(),
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
      <BookingDetailScreen />
    </QueryClientProvider>
  )
}

const mockBooking = {
  id: 1,
  client_id: 42,
  scheduled_class_id: 7,
  status: 'confirmed' as const,
  credit_deducted: true,
  created_at: '2026-07-01T00:00:00',
  class_type_name: 'Vinyasa Flow',
  location_name: 'Downtown Studio',
  instructor_name: 'Elena Rossi',
  class_starts_at: '2026-08-01T10:00:00',
  class_ends_at: '2026-08-01T11:00:00',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('BookingDetailScreen', () => {
  it('renders class name, location, instructor, and status', async () => {
    ;(bookingsApi.get as jest.Mock).mockResolvedValue(mockBooking)

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Vinyasa Flow')).toBeTruthy())
    expect(getByText('Downtown Studio')).toBeTruthy()
    expect(getByText('Elena Rossi')).toBeTruthy()
    expect(getByText('Confirmed')).toBeTruthy()
    expect(bookingsApi.get).toHaveBeenCalledWith(1)
  })

  it('cancels the booking after confirming the alert', async () => {
    ;(bookingsApi.get as jest.Mock).mockResolvedValue(mockBooking)
    ;(bookingsApi.cancel as jest.Mock).mockResolvedValue(undefined)
    const alertSpy = jest.spyOn(Alert, 'alert')

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Cancel Booking')).toBeTruthy())
    fireEvent.press(getByText('Cancel Booking'))

    expect(alertSpy).toHaveBeenCalled()
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[]
    const confirmButton = buttons.find((b) => b.text === 'Cancel Booking')
    confirmButton?.onPress?.()

    await waitFor(() => {
      expect(bookingsApi.cancel).toHaveBeenCalledWith(1)
    })
    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })
  })

  it('does not show a cancel action for a cancelled booking', async () => {
    ;(bookingsApi.get as jest.Mock).mockResolvedValue({ ...mockBooking, status: 'cancelled' as const })

    const { getByText, queryByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Vinyasa Flow')).toBeTruthy())
    expect(queryByText('Cancel Booking')).toBeNull()
  })
})
