import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Linking, Alert } from 'react-native'
import MembershipCheckoutScreen from '../app/membership/checkout/[typeId]'
import { membershipTypesApi, billingApi, promoCodesApi, giftCardsApi } from '../src/api/memberships'
import { useAuthStore } from '../src/store/authStore'

// --- module mocks ---

const mockRouterReplace = jest.fn()

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockRouterReplace, push: jest.fn() }),
  useLocalSearchParams: () => ({ typeId: '1' }),
  Stack: { Screen: () => null },
}))

jest.mock('../src/api/memberships', () => ({
  membershipTypesApi: {
    list: jest.fn(),
  },
  billingApi: {
    createCheckoutSession: jest.fn(),
  },
  promoCodesApi: {
    validate: jest.fn(),
  },
  giftCardsApi: {
    validate: jest.fn(),
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
      <MembershipCheckoutScreen />
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
  is_intro_offer: false,
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
  is_intro_offer: false,
}

// --- tests ---

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.setState({
    user: { id: 42, email: 'test@test.com', full_name: 'Test', role: 'client', photo_url: null },
  })
})

describe('MembershipCheckoutScreen', () => {
  it('renders loading state', () => {
    ;(membershipTypesApi.list as jest.Mock).mockReturnValue(new Promise(() => {}))
    const { getByText } = renderScreen(makeClient())
    expect(getByText('Loading membership options...')).toBeTruthy()
  })

  it('shows a not-found message when the route typeId does not match any type', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([mockTypeB])
    const { getByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Membership plan not found.')).toBeTruthy())
  })

  it('shows the full details for the matching membership type', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([mockTypeA, mockTypeB])
    const { getByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Monthly Unlimited')).toBeTruthy())
    expect(getByText('EUR 49.90')).toBeTruthy()
    expect(getByText('Promo Code')).toBeTruthy()
    expect(getByText('Gift Card Code')).toBeTruthy()
    expect(getByText('Purchase')).toBeTruthy()
  })

  it('calls createCheckoutSession and opens URL on purchase', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([mockTypeA])
    ;(billingApi.createCheckoutSession as jest.Mock).mockResolvedValue({
      checkout_url: 'https://checkout.stripe.com/test',
      session_id: 'cs_test',
      already_completed: false,
      membership_id: null,
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

  it('validates and applies a promo code, then passes it to createCheckoutSession', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([mockTypeA])
    ;(promoCodesApi.validate as jest.Mock).mockResolvedValue({
      valid: true,
      discount_type: 'percentage',
      discount_value: 10,
      discount_amount: 4.99,
      original_price: 49.9,
      final_price: 44.91,
    })
    ;(billingApi.createCheckoutSession as jest.Mock).mockResolvedValue({
      checkout_url: 'https://checkout.stripe.com/test',
      session_id: 'cs_test',
      already_completed: false,
      membership_id: null,
    })
    ;(Linking.openURL as jest.Mock).mockResolvedValue(undefined)

    const { getByText, getAllByText, getByPlaceholderText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Monthly Unlimited')).toBeTruthy())

    fireEvent.changeText(getByPlaceholderText('Enter promo code'), 'SAVE10')
    // Both the promo and gift-card "Apply" buttons share the same label —
    // the promo section renders first, so it's the first one.
    fireEvent.press(getAllByText('Apply')[0])

    await waitFor(() => expect(getByText('Discount applied!')).toBeTruthy())

    fireEvent.press(getByText('Purchase'))

    await waitFor(() => {
      expect(billingApi.createCheckoutSession).toHaveBeenCalledWith(42, 1, { promoCode: 'SAVE10' })
      expect(Linking.openURL).toHaveBeenCalledWith('https://checkout.stripe.com/test')
    })
  })

  it('validates and applies a gift card code, then passes it to createCheckoutSession', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([mockTypeA])
    ;(giftCardsApi.validate as jest.Mock).mockResolvedValue({
      valid: true,
      remaining_balance: 30,
      currency: 'eur',
    })
    ;(billingApi.createCheckoutSession as jest.Mock).mockResolvedValue({
      checkout_url: 'https://checkout.stripe.com/test',
      session_id: 'cs_test',
      already_completed: false,
      membership_id: null,
    })
    ;(Linking.openURL as jest.Mock).mockResolvedValue(undefined)

    const { getByText, getAllByText, getByPlaceholderText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Monthly Unlimited')).toBeTruthy())

    fireEvent.changeText(getByPlaceholderText('Enter gift card code'), 'GIFT123')
    // Both the promo and gift-card "Apply" buttons share the same label —
    // the gift-card section renders after the promo section, so it's the last one.
    const applyButtons = getAllByText('Apply')
    fireEvent.press(applyButtons[applyButtons.length - 1])

    await waitFor(() => expect(getByText('Gift card applied!')).toBeTruthy())

    fireEvent.press(getByText('Purchase'))

    await waitFor(() => {
      expect(billingApi.createCheckoutSession).toHaveBeenCalledWith(42, 1, {
        giftCardCode: 'GIFT123',
      })
      expect(Linking.openURL).toHaveBeenCalledWith('https://checkout.stripe.com/test')
    })
  })

  it('shows the purchase-complete state and does not open a URL when already_completed is true', async () => {
    ;(membershipTypesApi.list as jest.Mock).mockResolvedValue([mockTypeA])
    ;(giftCardsApi.validate as jest.Mock).mockResolvedValue({
      valid: true,
      remaining_balance: 100,
      currency: 'eur',
    })
    ;(billingApi.createCheckoutSession as jest.Mock).mockResolvedValue({
      checkout_url: null,
      session_id: null,
      already_completed: true,
      membership_id: 7,
    })
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

    const { getByText, getAllByText, getByPlaceholderText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Monthly Unlimited')).toBeTruthy())

    fireEvent.changeText(getByPlaceholderText('Enter gift card code'), 'FULLCOVER')
    // Both the promo and gift-card "Apply" buttons share the same label —
    // the gift-card section renders after the promo section, so it's the last one.
    const applyButtons = getAllByText('Apply')
    fireEvent.press(applyButtons[applyButtons.length - 1])
    await waitFor(() => expect(getByText('Gift card applied!')).toBeTruthy())

    fireEvent.press(getByText('Purchase'))

    await waitFor(() => {
      expect(billingApi.createCheckoutSession).toHaveBeenCalledWith(42, 1, {
        giftCardCode: 'FULLCOVER',
      })
      expect(alertSpy).toHaveBeenCalledWith('Purchase complete! Your membership is now active.')
      expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/membership')
      expect(Linking.openURL).not.toHaveBeenCalled()
    })
  })
})
