import React from 'react'
import { render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ClassDetailScreen from '../app/class/[id]'
import { classesApi } from '../src/api/classes'
import { bookingsApi } from '../src/api/bookings'
import { waiversApi } from '../src/api/waivers'
import { useAuthStore } from '../src/store/authStore'

const mockPush = jest.fn()
const mockBack = jest.fn()

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '55' }),
  useRouter: () => ({ push: mockPush, back: mockBack }),
}))

jest.mock('../src/api/classes', () => ({
  classesApi: {
    get: jest.fn(),
  },
}))

jest.mock('../src/api/bookings', () => ({
  bookingsApi: {
    create: jest.fn(),
    joinWaitlist: jest.fn(),
  },
}))

jest.mock('../src/api/waivers', () => ({
  waiversApi: {
    listForClient: jest.fn(),
  },
}))

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderScreen(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <ClassDetailScreen />
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

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.setState({
    user: { id: 42, email: 'test@test.com', full_name: 'Test Client', role: 'client', photo_url: null },
  })
  ;(classesApi.get as jest.Mock).mockResolvedValue(mockClass)
})

describe('ClassDetailScreen — waiver-required booking error', () => {
  it('books successfully on the happy path (regression guard for the render-branch refactor)', async () => {
    ;(bookingsApi.create as jest.Mock).mockResolvedValue({ id: 1 })
    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Book This Class')).toBeTruthy())
    fireEvent.press(getByText('Book This Class'))

    await waitFor(() => expect(getByText('Booked! Redirecting...')).toBeTruthy())
  })

  it('shows which waiver(s) block booking and lets the client navigate to sign them', async () => {
    ;(bookingsApi.create as jest.Mock).mockRejectedValue({
      code: 'WAIVER_SIGNATURE_REQUIRED',
      message: 'You must sign a waiver before booking.',
      details: { waiver_ids: [7] },
    })
    ;(waiversApi.listForClient as jest.Mock).mockResolvedValue([
      {
        id: 7,
        location_id: 1,
        title: 'Liability Waiver',
        body: 'body',
        version: 1,
        requires_before_booking: true,
        is_active: true,
        created_at: '2026-01-01T00:00:00',
        updated_at: '2026-01-01T00:00:00',
        is_signed: false,
        signed_at: null,
      },
    ])

    const { getByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Book This Class')).toBeTruthy())

    fireEvent.press(getByText('Book This Class'))

    await waitFor(() => expect(getByText('Signature required')).toBeTruthy())
    await waitFor(() => expect(getByText('Liability Waiver')).toBeTruthy())

    fireEvent.press(getByText('Sign Waivers'))
    expect(mockPush).toHaveBeenCalledWith('/waivers')

    // The Book button remains available so the client can retry after signing.
    expect(getByText('Book This Class')).toBeTruthy()
  })
})
