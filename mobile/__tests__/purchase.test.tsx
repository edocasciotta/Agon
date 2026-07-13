import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PurchaseScreen from '../app/membership/purchase'
import { membershipTypesApi } from '../src/api/memberships'

// --- module mocks ---

const mockRouterPush = jest.fn()

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: mockRouterPush }),
  Stack: { Screen: () => null },
}))

jest.mock('../src/api/memberships', () => ({
  membershipTypesApi: {
    list: jest.fn(),
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
})

describe('PurchaseScreen', () => {
  it('renders loading state', () => {
    ;(membershipTypesApi.list as jest.Mock).mockReturnValue(new Promise(() => {}))
    const { getByText } = renderScreen(makeClient())
    expect(getByText('Loading membership options...')).toBeTruthy()
  })

  it('shows all active membership types as compact cards', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([mockTypeA, mockTypeB])
    const { getByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Monthly Unlimited')).toBeTruthy())
    expect(getByText('Class Pack 10')).toBeTruthy()
    // Compact card shows a one-line metadata summary, price, but no promo/gift-card inputs
    // or inline purchase button (those moved to the checkout screen).
    expect(getByText('Unlimited classes · recurring')).toBeTruthy()
    expect(getByText('10 credits · credit_pack')).toBeTruthy()
    expect(getByText('EUR 49.90')).toBeTruthy()
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

  it('navigates to the checkout screen for the tapped type', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([mockTypeA, mockTypeB])
    const { getByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Monthly Unlimited')).toBeTruthy())

    fireEvent.press(getByText('Class Pack 10'))

    expect(mockRouterPush).toHaveBeenCalledWith('/membership/checkout/2')
  })
})
