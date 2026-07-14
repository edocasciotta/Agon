import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import LoginScreen from '../app/onboarding/login'
import { authApi } from '../src/api/auth'
import { clientsApi } from '../src/api/memberships'
import { registerForPushNotifications } from '../src/notifications'
import { useAuthStore } from '../src/store/authStore'

const mockReplace = jest.fn()
const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}))

jest.mock('../src/api/auth', () => ({
  authApi: {
    login: jest.fn(),
    saveToken: jest.fn(),
    me: jest.fn(),
  },
}))

jest.mock('../src/api/memberships', () => ({
  clientsApi: {
    updatePushToken: jest.fn(),
  },
}))

jest.mock('../src/notifications', () => ({
  registerForPushNotifications: jest.fn(),
}))

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

function fillAndSubmit(getByPlaceholderText: any, getByText: any) {
  fireEvent.changeText(getByPlaceholderText('Email'), 'user@test.com')
  fireEvent.changeText(getByPlaceholderText('Password'), 'password123')
  fireEvent.press(getByText('Sign In'))
}

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.setState({ user: null })
  ;(authApi.login as jest.Mock).mockResolvedValue({
    access_token: 'token',
    refresh_token: 'refresh',
  })
})

describe('LoginScreen role-aware routing', () => {
  it('routes an instructor to the instructor tab shell and skips push-token registration', async () => {
    ;(authApi.me as jest.Mock).mockResolvedValue({
      id: 7,
      email: 'instructor@test.com',
      full_name: 'Elena Rossi',
      role: 'instructor',
      photo_url: null,
    })

    const { getByPlaceholderText, getByText } = render(<LoginScreen />)
    fillAndSubmit(getByPlaceholderText, getByText)

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(instructor-tabs)'))
    expect(registerForPushNotifications).not.toHaveBeenCalled()
    expect(clientsApi.updatePushToken).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user?.role).toBe('instructor')
  })

  it('routes a client to the client tab shell and registers the push token', async () => {
    ;(authApi.me as jest.Mock).mockResolvedValue({
      id: 3,
      email: 'client@test.com',
      full_name: 'Jane Client',
      role: 'client',
      photo_url: null,
    })
    ;(registerForPushNotifications as jest.Mock).mockResolvedValue('expo-push-token')

    const { getByPlaceholderText, getByText } = render(<LoginScreen />)
    fillAndSubmit(getByPlaceholderText, getByText)

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'))
    expect(clientsApi.updatePushToken).toHaveBeenCalledWith('expo-push-token')
  })
})
