import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InstructorDetailScreen from '../app/instructor/[id]'
import { instructorsApi } from '../src/api/instructors'

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '5' }),
  Stack: { Screen: () => null },
}))

jest.mock('../src/api/instructors', () => ({
  instructorsApi: {
    get: jest.fn(),
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
      <InstructorDetailScreen />
    </QueryClientProvider>
  )
}

const mockInstructor = {
  id: 5,
  user_id: 5,
  full_name: 'Elena Rossi',
  email: 'elena@test.com',
  bio: 'Certified yoga instructor with 10 years of experience.',
  is_active: true,
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('InstructorDetailScreen', () => {
  it('renders full name, bio, and email (no photo)', async () => {
    ;(instructorsApi.get as jest.Mock).mockResolvedValue(mockInstructor)

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Elena Rossi')).toBeTruthy())
    expect(getByText('elena@test.com')).toBeTruthy()
    expect(getByText('Certified yoga instructor with 10 years of experience.')).toBeTruthy()
    expect(instructorsApi.get).toHaveBeenCalledWith(5)
  })

  it('renders without a bio section when the instructor has none', async () => {
    ;(instructorsApi.get as jest.Mock).mockResolvedValue({ ...mockInstructor, bio: undefined })

    const { getByText, queryByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Elena Rossi')).toBeTruthy())
    expect(queryByText('Certified yoga instructor with 10 years of experience.')).toBeNull()
  })
})
