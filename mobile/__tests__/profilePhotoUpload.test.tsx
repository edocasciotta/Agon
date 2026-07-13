import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProfileScreen from '../app/(tabs)/profile'
import { tagsApi } from '../src/api/tags'
import { calendarSyncApi } from '../src/api/calendarSync'
import { clientsApi } from '../src/api/memberships'
import { useAuthStore } from '../src/store/authStore'
import * as ImagePicker from 'expo-image-picker'

// --- module mocks ---

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('fake-token'),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}))

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}))

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}))

jest.mock('expo-image', () => ({
  Image: () => null,
}))

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))

jest.mock('../src/api/tags', () => ({
  tagsApi: {
    getClientTags: jest.fn(),
  },
}))

jest.mock('../src/api/calendarSync', () => ({
  calendarSyncApi: {
    get: jest.fn(),
    regenerate: jest.fn(),
  },
}))

jest.mock('../src/api/memberships', () => ({
  clientsApi: {
    uploadPhoto: jest.fn(),
    updatePushToken: jest.fn(),
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
      <ProfileScreen />
    </QueryClientProvider>
  )
}

const mockAsset = {
  uri: 'file:///tmp/photo.jpg',
  width: 200,
  height: 200,
  fileName: 'photo.jpg',
  mimeType: 'image/jpeg',
  fileSize: 1024 * 1024, // 1MB — under the 5MB limit
}

// --- tests ---

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.setState({
    user: { id: 42, email: 'test@test.com', full_name: 'Test Client', role: 'client', photo_url: null },
  })
  ;(tagsApi.getClientTags as jest.Mock).mockResolvedValue([])
  ;(calendarSyncApi.get as jest.Mock).mockResolvedValue({ feed_url: 'https://studio.example.com/x.ics' })
  ;(ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true })
})

describe('ProfileScreen — photo upload', () => {
  it('uploads the picked photo and updates the stored user on success', async () => {
    ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [mockAsset],
    })
    ;(clientsApi.uploadPhoto as jest.Mock).mockResolvedValue({
      photo_url: '/api/v1/photos/client_42_abc.jpg',
    })

    const { getByLabelText } = renderScreen(makeClient())

    fireEvent.press(getByLabelText('Change photo'))

    await waitFor(() =>
      expect(clientsApi.uploadPhoto).toHaveBeenCalledWith(42, expect.objectContaining({ uri: mockAsset.uri }))
    )

    await waitFor(() =>
      expect(useAuthStore.getState().user?.photo_url).toBe('/api/v1/photos/client_42_abc.jpg')
    )
  })

  it('rejects an oversized photo client-side without calling the upload API', async () => {
    ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ ...mockAsset, fileSize: 6 * 1024 * 1024 }], // 6MB — over the 5MB limit
    })

    const { getByLabelText, findByText } = renderScreen(makeClient())

    fireEvent.press(getByLabelText('Change photo'))

    expect(await findByText('This photo is too large. Please choose one under 5MB.')).toBeTruthy()
    expect(clientsApi.uploadPhoto).not.toHaveBeenCalled()
  })

  it('shows a friendly error and does not crash when the upload fails', async () => {
    ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [mockAsset],
    })
    ;(clientsApi.uploadPhoto as jest.Mock).mockRejectedValue({
      code: 'PHOTO_INVALID_TYPE',
      message: 'Unsupported file type',
    })

    const { getByLabelText, findByText } = renderScreen(makeClient())

    fireEvent.press(getByLabelText('Change photo'))

    expect(await findByText('Please choose a JPG, PNG, or WEBP photo.')).toBeTruthy()
  })

  it('does nothing when the user cancels the picker', async () => {
    ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: true,
      assets: [],
    })

    const { getByLabelText } = renderScreen(makeClient())

    fireEvent.press(getByLabelText('Change photo'))

    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled())
    expect(clientsApi.uploadPhoto).not.toHaveBeenCalled()
  })
})
