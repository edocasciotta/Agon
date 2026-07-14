import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InstructorProfileScreen from '../app/(instructor-tabs)/profile'
import { instructorsApi } from '../src/api/instructors'
import { useAuthStore } from '../src/store/authStore'

const mockReplace = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

jest.mock('../src/api/instructors', () => ({
  instructorsApi: {
    getMe: jest.fn(),
    uploadPhoto: jest.fn(),
  },
}))

jest.mock('../src/store/connectivityStore', () => ({
  useConnectivityStore: () => ({ isOnline: true, lastOnlineAt: null }),
}))

jest.mock('../src/store/studioStore', () => ({
  useStudioStore: (selector: (s: { studioUrl: string | null }) => unknown) =>
    selector({ studioUrl: 'http://localhost:8000' }),
}))

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('fake-token'),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderScreen(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <InstructorProfileScreen />
    </QueryClientProvider>
  )
}

const mockInstructor = {
  id: 9,
  user_id: 9,
  full_name: 'Elena Rossi',
  email: 'elena@test.com',
  bio: 'Certified yoga instructor with 10 years of experience.',
  is_active: true,
  photo_url: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(instructorsApi.getMe as jest.Mock).mockResolvedValue(mockInstructor)
})

describe('InstructorProfileScreen', () => {
  it('renders full name, bio, and email', async () => {
    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Elena Rossi')).toBeTruthy())
    expect(getByText('elena@test.com')).toBeTruthy()
    expect(getByText('Certified yoga instructor with 10 years of experience.')).toBeTruthy()
  })

  it('renders without a bio section when the instructor has none', async () => {
    ;(instructorsApi.getMe as jest.Mock).mockResolvedValue({ ...mockInstructor, bio: undefined })

    const { getByText, queryByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Elena Rossi')).toBeTruthy())
    expect(queryByText('Certified yoga instructor with 10 years of experience.')).toBeNull()
  })

  it('signs out and navigates to login when Sign Out is pressed', async () => {
    const logoutSpy = jest.spyOn(useAuthStore.getState(), 'logout').mockResolvedValue(undefined)

    const { getByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Sign Out')).toBeTruthy())

    fireEvent.press(getByText('Sign Out'))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding/login'))
    expect(logoutSpy).toHaveBeenCalled()
  })
})
