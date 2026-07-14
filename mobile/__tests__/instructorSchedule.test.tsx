import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InstructorScheduleScreen from '../app/(instructor-tabs)/schedule'
import { classesApi } from '../src/api/classes'
import { instructorsApi } from '../src/api/instructors'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('../src/api/instructors', () => ({
  instructorsApi: {
    getMe: jest.fn(),
  },
}))

jest.mock('../src/api/classes', () => ({
  classesApi: {
    list: jest.fn(),
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
      <InstructorScheduleScreen />
    </QueryClientProvider>
  )
}

const mockInstructor = {
  id: 9,
  user_id: 9,
  full_name: 'Elena Rossi',
  email: 'elena@test.com',
  is_active: true,
  photo_url: null,
}

const now = new Date()
const future = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

const upcomingClass = {
  id: 101,
  template_id: 1,
  template_name: 'Vinyasa Flow',
  instructor_id: 9,
  starts_at: future,
  ends_at: future,
  capacity: 12,
  booking_count: 8,
  status: 'scheduled' as const,
}

const pastClass = {
  id: 102,
  template_id: 2,
  template_name: 'Power Yoga',
  instructor_id: 9,
  starts_at: pastDate,
  ends_at: pastDate,
  capacity: 10,
  booking_count: 10,
  status: 'completed' as const,
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(instructorsApi.getMe as jest.Mock).mockResolvedValue(mockInstructor)
})

describe('InstructorScheduleScreen', () => {
  it('fetches its own instructor id, then classes scoped to that instructor, and splits upcoming/past', async () => {
    ;(classesApi.list as jest.Mock).mockResolvedValue([upcomingClass, pastClass])

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Vinyasa Flow')).toBeTruthy())
    expect(getByText('Power Yoga')).toBeTruthy()
    expect(getByText('Upcoming')).toBeTruthy()
    expect(getByText('Past')).toBeTruthy()
    expect(getByText('8/12 booked')).toBeTruthy()

    expect(instructorsApi.getMe).toHaveBeenCalled()
    expect(classesApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ instructor_id: 9 })
    )
  })

  it('shows an empty state when there are no classes', async () => {
    ;(classesApi.list as jest.Mock).mockResolvedValue([])

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('No classes scheduled.')).toBeTruthy())
  })

  it('navigates to the class detail screen when a card is pressed', async () => {
    ;(classesApi.list as jest.Mock).mockResolvedValue([upcomingClass])

    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Vinyasa Flow')).toBeTruthy())
    fireEvent.press(getByText('Vinyasa Flow'))
    expect(mockPush).toHaveBeenCalledWith('/instructor-class/101')
  })
})
