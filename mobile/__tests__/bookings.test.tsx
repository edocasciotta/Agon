import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BookingsScreen from '../app/(tabs)/bookings'
import { bookingsApi } from '../src/api/bookings'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('../src/api/bookings', () => ({
  bookingsApi: {
    list: jest.fn(),
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
      <BookingsScreen />
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

describe('BookingsScreen', () => {
  it('shows the class type name, start time, instructor, and location instead of raw ids', async () => {
    ;(bookingsApi.list as jest.Mock).mockResolvedValue([mockBooking])

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => {
      expect(getByText('Vinyasa Flow')).toBeTruthy()
    })
    expect(getByText('with Elena Rossi')).toBeTruthy()
    expect(getByText('Downtown Studio')).toBeTruthy()
  })

  it('falls back to "Class #{id}" when class_type_name is null and omits missing optional fields', async () => {
    ;(bookingsApi.list as jest.Mock).mockResolvedValue([
      {
        ...mockBooking,
        class_type_name: null,
        instructor_name: null,
        location_name: null,
        class_starts_at: null,
        class_ends_at: null,
      },
    ])

    const { getByText, queryByText } = renderScreen(makeClient())

    await waitFor(() => {
      expect(getByText('Class #7')).toBeTruthy()
    })
    expect(queryByText(/^with /)).toBeNull()
  })

  it('navigates to the booking detail screen when a card is pressed', async () => {
    ;(bookingsApi.list as jest.Mock).mockResolvedValue([mockBooking])

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Vinyasa Flow')).toBeTruthy())
    fireEvent.press(getByText('Vinyasa Flow'))
    expect(mockPush).toHaveBeenCalledWith('/booking/1')
  })

  it('still shows the cancel action for upcoming bookings', async () => {
    ;(bookingsApi.list as jest.Mock).mockResolvedValue([mockBooking])

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Cancel')).toBeTruthy())
  })
})
