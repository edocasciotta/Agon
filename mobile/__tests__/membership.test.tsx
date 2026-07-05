import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Alert } from 'react-native'
import MembershipScreen from '../app/(tabs)/membership'
import { clientMembershipsApi, billingApi } from '../src/api/memberships'
import { useAuthStore } from '../src/store/authStore'

// --- module mocks ---

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('../src/api/memberships', () => ({
  clientMembershipsApi: {
    getOwn: jest.fn(),
  },
  billingApi: {
    createCheckoutSession: jest.fn(),
    getSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
  },
}))

jest.mock('../src/store/connectivityStore', () => ({
  useConnectivityStore: () => ({ isOnline: true, lastOnlineAt: null }),
}))

// --- helpers ---

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function renderScreen(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <MembershipScreen />
    </QueryClientProvider>
  )
}

const mockActiveMembership = {
  id: 1,
  status: 'active',
  credits_remaining: 10,
  credits_used: 2,
  starts_at: '2026-01-01T00:00:00Z',
  expires_at: '2026-12-31T00:00:00Z',
}

const mockActiveSubscription = {
  stripe_subscription_id: 'sub_abc123',
  status: 'active',
  current_period_end: '2027-01-01T00:00:00Z',
  stripe_price_id: 'price_xyz',
}

const mockCanceledSubscription = {
  stripe_subscription_id: 'sub_abc123',
  status: 'canceled',
  current_period_end: '2026-12-31T00:00:00Z',
  stripe_price_id: 'price_xyz',
}

// --- tests ---

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.setState({
    user: { id: 42, email: 'test@test.com', full_name: 'Test User', role: 'client' },
  })
  ;(clientMembershipsApi.getOwn as jest.Mock).mockResolvedValue([mockActiveMembership])
})

describe('MembershipScreen — subscription card', () => {
  beforeAll(() => jest.setTimeout(15000))
  afterAll(() => jest.setTimeout(5000))

  it('renders subscription card when subscription is active', async () => {
    ;(billingApi.getSubscription as jest.Mock).mockResolvedValue({
      subscription: mockActiveSubscription,
    })

    const { getByText, getAllByText } = renderScreen(makeClient())

    await waitFor(() => {
      expect(getByText('STRIPE SUBSCRIPTION')).toBeTruthy()
    })
    // 'ACTIVE' appears in both the membership card badge and the subscription badge
    expect(getAllByText('ACTIVE').length).toBeGreaterThanOrEqual(2)
    expect(getByText('Jan 1, 2027')).toBeTruthy()
    expect(getByText('Cancel Subscription')).toBeTruthy()
  })

  it('hides cancel button when subscription is canceled', async () => {
    ;(billingApi.getSubscription as jest.Mock).mockResolvedValue({
      subscription: mockCanceledSubscription,
    })

    const { getByText, queryByText } = renderScreen(makeClient())

    await waitFor(() => {
      expect(getByText('STRIPE SUBSCRIPTION')).toBeTruthy()
    })
    expect(getByText('CANCELED')).toBeTruthy()
    expect(queryByText('Cancel Subscription')).toBeNull()
  })

  it('calls cancelSubscription after user confirms alert', async () => {
    ;(billingApi.getSubscription as jest.Mock).mockResolvedValue({
      subscription: mockActiveSubscription,
    })
    ;(billingApi.cancelSubscription as jest.Mock).mockResolvedValue({
      status: 'canceled',
      cancel_at_period_end: true,
    })

    const alertSpy = jest.spyOn(Alert, 'alert')

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => {
      expect(getByText('Cancel Subscription')).toBeTruthy()
    })

    fireEvent.press(getByText('Cancel Subscription'))

    // Alert.alert should have been called with the right title
    expect(alertSpy).toHaveBeenCalledWith(
      'Cancel subscription?',
      'Your access continues until the end of the current period.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: 'Confirm' }),
      ])
    )

    // Simulate pressing the "Confirm" button by calling its onPress
    const alertArgs = alertSpy.mock.calls[0]
    const buttons = alertArgs[2] as { text: string; onPress?: () => void }[]
    const confirmButton = buttons.find(b => b.text === 'Confirm')
    confirmButton?.onPress?.()

    await waitFor(() => {
      expect(billingApi.cancelSubscription).toHaveBeenCalledWith(42)
    })
  })

  it('shows dash when current_period_end is null', async () => {
    ;(billingApi.getSubscription as jest.Mock).mockResolvedValue({
      subscription: {
        ...mockActiveSubscription,
        current_period_end: null,
      },
    })

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => {
      expect(getByText('STRIPE SUBSCRIPTION')).toBeTruthy()
    })
    expect(getByText('—')).toBeTruthy()
  })

  it('does not render subscription card when subscription is null', async () => {
    ;(billingApi.getSubscription as jest.Mock).mockResolvedValue({
      subscription: null,
    })

    const { queryByText } = renderScreen(makeClient())

    await waitFor(() => {
      expect(queryByText('STRIPE SUBSCRIPTION')).toBeNull()
    })
  })
})
