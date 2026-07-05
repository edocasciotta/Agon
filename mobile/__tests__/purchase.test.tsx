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

jest.mock('../src/api/memberships', () => ({
  membershipTypesApi: {
    list: jest.fn(),
  },
  billingApi: {
    createCheckoutSession: jest.fn(),
  },
}))

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(),
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

const mockTypeSellable = {
  id: 1,
  name: 'Monthly Unlimited',
  type: 'recurring',
  price: 49.9,
  currency: 'eur',
  credits_included: undefined,
  unlimited: true,
  sellable_online: true,
}

const mockTypeNotSellable = {
  id: 2,
  name: 'In-Studio Pack',
  type: 'pack',
  price: 30.0,
  currency: 'eur',
  credits_included: 10,
  unlimited: false,
  sellable_online: false,
}

// --- tests ---

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.setState({ user: { id: 42, email: 'test@test.com', full_name: 'Test', role: 'client' } })
})

describe('PurchaseScreen', () => {
  it('renders loading state', () => {
    ;(membershipTypesApi.list as jest.Mock).mockReturnValue(new Promise(() => {}))

    const { getByText } = renderScreen(makeClient())

    expect(getByText('Loading membership options...')).toBeTruthy()
  })

  it('renders membership type cards for sellable_online types', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([mockTypeSellable])

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => {
      expect(getByText('Monthly Unlimited')).toBeTruthy()
    })
    expect(getByText('Purchase')).toBeTruthy()
  })

  it('hides non-online types and only shows sellable_online types', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([
      mockTypeSellable,
      mockTypeNotSellable,
    ])

    const { getByText, queryByText } = renderScreen(makeClient())

    await waitFor(() => {
      expect(getByText('Monthly Unlimited')).toBeTruthy()
    })
    expect(queryByText('In-Studio Pack')).toBeNull()
  })

  it('shows empty message when no types are sellable online', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([mockTypeNotSellable])

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => {
      expect(
        getByText('No membership options are available for online purchase.')
      ).toBeTruthy()
    })
  })

  it('calls createCheckoutSession and opens URL on purchase', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([mockTypeSellable])
    ;(billingApi.createCheckoutSession as jest.Mock).mockResolvedValue({
      checkout_url: 'https://checkout.stripe.com/test',
      session_id: 'cs_test',
    })
    ;(Linking.openURL as jest.Mock).mockResolvedValue(undefined)

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => {
      expect(getByText('Purchase')).toBeTruthy()
    })

    fireEvent.press(getByText('Purchase'))

    await waitFor(() => {
      expect(billingApi.createCheckoutSession).toHaveBeenCalledWith(42, 1)
      expect(Linking.openURL).toHaveBeenCalledWith('https://checkout.stripe.com/test')
    })
  })
})
