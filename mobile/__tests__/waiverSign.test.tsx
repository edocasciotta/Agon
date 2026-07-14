import React from 'react'
import { render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WaiverDetailScreen from '../app/waivers/[id]'
import { waiversApi } from '../src/api/waivers'
import { useAuthStore } from '../src/store/authStore'

const mockBack = jest.fn()
let mockIsOnline = true

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '1' }),
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  Stack: { Screen: () => null },
}))

jest.mock('../src/api/waivers', () => ({
  waiversApi: {
    listForClient: jest.fn(),
    sign: jest.fn(),
  },
}))

jest.mock('../src/store/connectivityStore', () => ({
  useConnectivityStore: () => ({ isOnline: mockIsOnline, lastOnlineAt: null }),
}))

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderScreen(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <WaiverDetailScreen />
    </QueryClientProvider>
  )
}

const unsignedWaiver = {
  id: 1,
  location_id: 1,
  title: 'Liability Waiver',
  body: 'By signing you agree to the studio terms.',
  version: 2,
  requires_before_booking: true,
  is_active: true,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
  is_signed: false,
  signed_at: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockIsOnline = true
  useAuthStore.setState({
    user: { id: 42, email: 'test@test.com', full_name: 'Test Client', role: 'client', photo_url: null },
  })
})

describe('WaiverDetailScreen', () => {
  it('renders the waiver body and blocks submit until name and consent are provided', async () => {
    ;(waiversApi.listForClient as jest.Mock).mockResolvedValue([unsignedWaiver])
    const { getByText, getByLabelText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('By signing you agree to the studio terms.')).toBeTruthy())

    fireEvent.press(getByText('Sign & Submit'))
    expect(getByText('Enter your full name (at least 2 characters).')).toBeTruthy()
    expect(waiversApi.sign).not.toHaveBeenCalled()

    fireEvent.changeText(getByLabelText('Full legal name'), 'Jane Client')
    fireEvent.press(getByText('Sign & Submit'))
    expect(getByText('Please confirm you agree before signing.')).toBeTruthy()
    expect(waiversApi.sign).not.toHaveBeenCalled()
  })

  it('signs the waiver with the typed name once consent is checked, and refreshes on success', async () => {
    ;(waiversApi.listForClient as jest.Mock).mockResolvedValue([unsignedWaiver])
    ;(waiversApi.sign as jest.Mock).mockResolvedValue({
      id: 9,
      waiver_id: 1,
      client_id: 42,
      waiver_version: 2,
      signed_name: 'Jane Client',
      signed_at: '2026-07-14T10:00:00',
    })

    const { getByText, getByLabelText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('By signing you agree to the studio terms.')).toBeTruthy())

    fireEvent.changeText(getByLabelText('Full legal name'), 'Jane Client')
    fireEvent.press(getByText(/I have read and agree/))
    fireEvent.press(getByText('Sign & Submit'))

    await waitFor(() => expect(waiversApi.sign).toHaveBeenCalledWith(1, 'Jane Client'))
    await waitFor(() => expect(getByText('Waiver signed successfully.')).toBeTruthy())
  })

  it('disables signing while offline', async () => {
    mockIsOnline = false
    ;(waiversApi.listForClient as jest.Mock).mockResolvedValue([unsignedWaiver])

    const { getByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText("You're offline — reconnect to sign this waiver.")).toBeTruthy())
    expect(waiversApi.sign).not.toHaveBeenCalled()
  })

  it('shows an already-signed state for a waiver signed at the current version', async () => {
    ;(waiversApi.listForClient as jest.Mock).mockResolvedValue([
      { ...unsignedWaiver, is_signed: true, signed_at: '2026-03-01T00:00:00' },
    ])

    const { getByText } = renderScreen(makeClient())
    await waitFor(() =>
      expect(getByText(/You already signed the current version of this waiver\./)).toBeTruthy()
    )
  })
})
