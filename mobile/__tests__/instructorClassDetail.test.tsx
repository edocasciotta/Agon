import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Alert } from 'react-native'
import InstructorClassDetailScreen from '../app/instructor-class/[id]'
import { classesApi } from '../src/api/classes'
import { checkinsApi } from '../src/api/checkins'

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '55' }),
  Stack: { Screen: () => null },
}))

jest.mock('../src/api/classes', () => ({
  classesApi: {
    get: jest.fn(),
    roster: jest.fn(),
    complete: jest.fn(),
  },
}))

jest.mock('../src/api/checkins', () => ({
  checkinsApi: {
    listForClass: jest.fn(),
    manual: jest.fn(),
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
      <InstructorClassDetailScreen />
    </QueryClientProvider>
  )
}

const mockClass = {
  id: 55,
  template_id: 1,
  template_name: 'Vinyasa Flow',
  instructor_id: 9,
  starts_at: '2026-08-01T10:00:00',
  ends_at: '2026-08-01T11:00:00',
  capacity: 12,
  booking_count: 2,
  status: 'scheduled' as const,
}

const mockRoster = [
  { booking_id: 1, client_id: 100, full_name: 'Jane Client', email: 'jane@test.com', status: 'confirmed' },
  { booking_id: 2, client_id: 200, full_name: 'Bob Member', email: 'bob@test.com', status: 'confirmed' },
]

const mockCheckins = [
  {
    id: 1,
    booking_id: 1,
    client_id: 100,
    scheduled_class_id: 55,
    method: 'manual',
    checked_in_at: '2026-08-01T09:50:00',
    checked_in_by: 9,
    client_name: 'Jane Client',
  },
]

beforeEach(() => {
  jest.clearAllMocks()
  ;(classesApi.get as jest.Mock).mockResolvedValue(mockClass)
  ;(classesApi.roster as jest.Mock).mockResolvedValue(mockRoster)
  ;(checkinsApi.listForClass as jest.Mock).mockResolvedValue(mockCheckins)
})

describe('InstructorClassDetailScreen', () => {
  it('shows correct checked-in state per roster row', async () => {
    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Jane Client')).toBeTruthy())
    expect(getByText('Bob Member')).toBeTruthy()
    expect(getByText('Checked in')).toBeTruthy()
    expect(getByText('Check in')).toBeTruthy()
  })

  it('checks a client in and updates their row to checked-in', async () => {
    ;(checkinsApi.manual as jest.Mock).mockResolvedValue({
      id: 2,
      booking_id: 2,
      client_id: 200,
      scheduled_class_id: 55,
      method: 'manual',
      checked_in_at: '2026-08-01T09:55:00',
      checked_in_by: 9,
      client_name: 'Bob Member',
    })

    const { getByText, queryByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Bob Member')).toBeTruthy())

    // After check-in, refetch shows Bob as checked in too.
    ;(checkinsApi.listForClass as jest.Mock).mockResolvedValue([
      ...mockCheckins,
      {
        id: 2,
        booking_id: 2,
        client_id: 200,
        scheduled_class_id: 55,
        method: 'manual',
        checked_in_at: '2026-08-01T09:55:00',
        checked_in_by: 9,
        client_name: 'Bob Member',
      },
    ])

    fireEvent.press(getByText('Check in'))

    await waitFor(() => expect(checkinsApi.manual).toHaveBeenCalledWith(55, 200))
    await waitFor(() => expect(queryByText('Check in')).toBeNull())
  })

  it('shows a friendly error when check-in fails with a known error code', async () => {
    ;(checkinsApi.manual as jest.Mock).mockRejectedValue({
      code: 'CHECKIN_WINDOW_NOT_OPEN',
      message: 'too early',
    })

    const { getByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Jane Client')).toBeTruthy())

    fireEvent.press(getByText('Check in'))

    await waitFor(() =>
      expect(getByText('Check-in has not opened yet for this class.')).toBeTruthy()
    )
  })

  it('marks the class complete after confirming the alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert')
    ;(classesApi.complete as jest.Mock).mockResolvedValue({ ...mockClass, status: 'completed' })

    const { getByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Mark Complete')).toBeTruthy())

    fireEvent.press(getByText('Mark Complete'))
    expect(alertSpy).toHaveBeenCalled()

    // Simulate the user confirming the alert
    const confirmButton = alertSpy.mock.calls[0][2]?.find(
      (b) => b.text === 'Mark Complete'
    )
    confirmButton?.onPress?.(undefined as never)

    await waitFor(() => expect(classesApi.complete).toHaveBeenCalledWith(55))
    await waitFor(() => expect(getByText('Class marked as completed.')).toBeTruthy())
  })
})
