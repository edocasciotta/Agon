import React from 'react'
import { render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WaiversListScreen from '../app/waivers/index'
import { waiversApi } from '../src/api/waivers'
import { useAuthStore } from '../src/store/authStore'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  Stack: { Screen: () => null },
}))

jest.mock('../src/api/waivers', () => ({
  waiversApi: {
    listForClient: jest.fn(),
    sign: jest.fn(),
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
      <WaiversListScreen />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.setState({
    user: { id: 42, email: 'test@test.com', full_name: 'Test Client', role: 'client', photo_url: null },
  })
})

describe('WaiversListScreen', () => {
  it('shows the empty state when the client has no waivers', async () => {
    ;(waiversApi.listForClient as jest.Mock).mockResolvedValue([])
    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('No waivers to sign yet.')).toBeTruthy())
  })

  it('shows signed and unsigned status per waiver, plus the required-before-booking badge', async () => {
    ;(waiversApi.listForClient as jest.Mock).mockResolvedValue([
      {
        id: 1,
        location_id: 1,
        title: 'Liability Waiver',
        body: 'body text',
        version: 2,
        requires_before_booking: true,
        is_active: true,
        created_at: '2026-01-01T00:00:00',
        updated_at: '2026-01-01T00:00:00',
        is_signed: false,
        signed_at: null,
      },
      {
        id: 2,
        location_id: 1,
        title: 'Photo Release',
        body: 'body text 2',
        version: 1,
        requires_before_booking: false,
        is_active: true,
        created_at: '2026-01-01T00:00:00',
        updated_at: '2026-01-01T00:00:00',
        is_signed: true,
        signed_at: '2026-02-01T00:00:00',
      },
    ])

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Liability Waiver')).toBeTruthy())
    expect(getByText('Photo Release')).toBeTruthy()
    expect(getByText('Not signed')).toBeTruthy()
    expect(getByText('Required before booking')).toBeTruthy()
    expect(getByText(/Signed —/)).toBeTruthy()
  })

  it('navigates to the waiver detail screen when a card is tapped', async () => {
    ;(waiversApi.listForClient as jest.Mock).mockResolvedValue([
      {
        id: 7,
        location_id: 1,
        title: 'Liability Waiver',
        body: 'body text',
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
    await waitFor(() => expect(getByText('Liability Waiver')).toBeTruthy())

    fireEvent.press(getByText('Liability Waiver'))
    expect(mockPush).toHaveBeenCalledWith('/waivers/7')
  })
})
