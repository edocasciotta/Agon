import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Linking } from 'react-native'
import PurchaseScreen from '../app/membership/purchase'
import { membershipTypesApi, billingApi } from '../src/api/memberships'
import { useAuthStore } from '../src/store/authStore'

// --- module mocks ---

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  Stack: { Screen: () => null },
}))

jest.mock('../src/api/memberships', () => ({
  membershipTypesApi: {
    list: jest.fn(),
  },
  billingApi: {
    createCheckoutSession: jest.fn(),
  },
}))

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  default: {
    openURL: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    canOpenURL: jest.fn(),
    getInitialURL: jest.fn(),
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
      <PurchaseScreen />
    </QueryClientProvider>
  )
}

const mockTypeA = {
  id: 1,
  name: 'Monthly Unlimited',
  type: 'recurring',
  price: 49.9,
  currency: 'eur',
  credits_included: undefined,
  unlimited: true,
  is_active: true,
  sellable_online: true,
}

const mockTypeB = {
  id: 2,
  name: 'Class Pack 10',
  type: 'credit_pack',
  price: 30.0,
  currency: 'eur',
  credits_included: 10,
  unlimited: false,
  is_active: true,
  sellable_online: true,
}

const mockTypeInactive = {
  id: 3,
  name: 'Old Plan',
  type: 'credit_pack',
  price: 20.0,
  currency: 'eur',
  credits_included: 5,
  unlimited: false,
  is_active: false,
  sellable_online: true,
}

const mockTypeNotOnline = {
  id: 4,
  name: 'In-Studio Only',
  type: 'credit_pack',
  price: 25.0,
  currency: 'eur',
  credits_included: 5,
  unlimited: false,
  is_active: true,
  sellable_online: false,
}

// --- tests ---

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.setState({
    user: { id: 42, email: 'test@test.com', full_name: 'Test', role: 'client' },
  })
})

describe('PurchaseScreen', () => {
  it('renders loading state', () => {
    ;(membershipTypesApi.list as jest.Mock).mockReturnValue(new Promise(() => {}))
    const { getByText } = renderScreen(makeClient())
    expect(getByText('Loading membership options...')).toBeTruthy()
  })

  it('shows all active membership types', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([mockTypeA, mockTypeB])
    const { getByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Monthly Unlimited')).toBeTruthy())
    expect(getByText('Class Pack 10')).toBeTruthy()
  })

  it('hides inactive types', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([mockTypeA, mockTypeInactive])
    const { getByText, queryByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Monthly Unlimited')).toBeTruthy())
    expect(queryByText('Old Plan')).toBeNull()
  })

  it('hides types not available for online purchase', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([mockTypeA, mockTypeNotOnline])
    const { getByText, queryByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Monthly Unlimited')).toBeTruthy())
    expect(queryByText('In-Studio Only')).toBeNull()
  })

  it('shows empty message when no active types', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([])
    const { getByText } = renderScreen(makeClient())
    await waitFor(() =>
      expect(getByText('No membership plans are currently available. Contact your studio.')).toBeTruthy()
    )
  })

  it('calls createCheckoutSession and opens URL on purchase', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([mockTypeA])
    ;(billingApi.createCheckoutSession as jest.Mock).mockResolvedValue({
      checkout_url: 'https://checkout.stripe.com/test',
      session_id: 'cs_test',
    })
    ;(Linking.openURL as jest.Mock).mockResolvedValue(undefined)

    const { getByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Purchase')).toBeTruthy())

    fireEvent.press(getByText('Purchase'))

    await waitFor(() => {
      expect(billingApi.createCheckoutSession).toHaveBeenCalledWith(42, 1)
      expect(Linking.openURL).toHaveBeenCalledWith('https://checkout.stripe.com/test')
    })
  })
})
