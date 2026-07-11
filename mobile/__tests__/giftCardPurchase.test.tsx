import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Linking } from 'react-native'
import GiftCardPurchaseScreen from '../app/gift-card/purchase'
import { giftCardsApi } from '../src/api/memberships'

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
  giftCardsApi: {
    purchase: jest.fn(),
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

// --- tests ---

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GiftCardPurchaseScreen', () => {
  it('renders the form fields', () => {
    const { getByText, getByPlaceholderText } = render(<GiftCardPurchaseScreen />)
    expect(getByText('Give a Gift Card')).toBeTruthy()
    expect(getByPlaceholderText('Enter amount')).toBeTruthy()
    expect(getByPlaceholderText('Write a message...')).toBeTruthy()
  })

  it('disables the purchase button until a valid amount is entered', () => {
    const { getByText } = render(<GiftCardPurchaseScreen />)
    const button = getByText('Purchase Gift Card')
    fireEvent.press(button)
    expect(giftCardsApi.purchase).not.toHaveBeenCalled()
  })

  it('calls giftCardsApi.purchase and opens the checkout URL on submit', async () => {
    ;(giftCardsApi.purchase as jest.Mock).mockResolvedValue({
      checkout_url: 'https://checkout.stripe.com/gift-card-test',
      session_id: 'cs_gift_test',
    })
    ;(Linking.openURL as jest.Mock).mockResolvedValue(undefined)

    const { getByText, getByPlaceholderText } = render(<GiftCardPurchaseScreen />)

    fireEvent.changeText(getByPlaceholderText('Enter amount'), '50')
    fireEvent.press(getByText('Purchase Gift Card'))

    await waitFor(() => {
      expect(giftCardsApi.purchase).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50,
          success_url: expect.any(String),
          cancel_url: expect.any(String),
        })
      )
      expect(Linking.openURL).toHaveBeenCalledWith('https://checkout.stripe.com/gift-card-test')
    })
  })

  it('includes optional recipient fields only when filled in', async () => {
    ;(giftCardsApi.purchase as jest.Mock).mockResolvedValue({
      checkout_url: 'https://checkout.stripe.com/gift-card-test',
      session_id: 'cs_gift_test',
    })
    ;(Linking.openURL as jest.Mock).mockResolvedValue(undefined)

    const { getByText, getByPlaceholderText } = render(<GiftCardPurchaseScreen />)

    fireEvent.changeText(getByPlaceholderText('Enter amount'), '25')
    fireEvent.press(getByText('Purchase Gift Card'))

    await waitFor(() => {
      const call = (giftCardsApi.purchase as jest.Mock).mock.calls[0][0]
      expect(call.recipient_name).toBeUndefined()
      expect(call.recipient_email).toBeUndefined()
      expect(call.message).toBeUndefined()
    })
  })
})
