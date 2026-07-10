import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Linking, Alert } from 'react-native'
import ProfileScreen from '../app/(tabs)/profile'
import { tagsApi } from '../src/api/tags'
import { calendarSyncApi } from '../src/api/calendarSync'
import { useAuthStore } from '../src/store/authStore'
import * as Clipboard from 'expo-clipboard'

// --- module mocks ---

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
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
      <ProfileScreen />
    </QueryClientProvider>
  )
}

const mockFeedUrl = 'https://studio.example.com/api/v1/calendar/abc123.ics'

// --- tests ---

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.setState({
    user: { id: 42, email: 'test@test.com', full_name: 'Test Client', role: 'client' },
  })
  ;(tagsApi.getClientTags as jest.Mock).mockResolvedValue([])
})

describe('ProfileScreen — Calendar Sync section', () => {
  it('shows a loading indicator while the feed URL is loading', () => {
    ;(calendarSyncApi.get as jest.Mock).mockReturnValue(new Promise(() => {}))
    const { getByText } = renderScreen(makeClient())
    expect(getByText('Sync to Calendar')).toBeTruthy()
  })

  it('shows the description and actions once the feed URL loads', async () => {
    ;(calendarSyncApi.get as jest.Mock).mockResolvedValue({ feed_url: mockFeedUrl })
    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Add to Calendar')).toBeTruthy())
    expect(getByText("See your upcoming bookings in your phone's calendar app.")).toBeTruthy()
    expect(getByText('Copy Link')).toBeTruthy()
    expect(getByText('Regenerate Link')).toBeTruthy()
  })

  it('shows an error message when the feed URL fails to load', async () => {
    ;(calendarSyncApi.get as jest.Mock).mockRejectedValue({
      code: 'SERVER_ERROR',
      message: 'boom',
    })
    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Failed to load calendar link')).toBeTruthy())
  })

  it('opens the feed URL with the webcal:// scheme when "Add to Calendar" is pressed', async () => {
    ;(calendarSyncApi.get as jest.Mock).mockResolvedValue({ feed_url: mockFeedUrl })
    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Add to Calendar')).toBeTruthy())
    fireEvent.press(getByText('Add to Calendar'))

    expect(Linking.openURL).toHaveBeenCalledWith(
      'webcal://studio.example.com/api/v1/calendar/abc123.ics'
    )
  })

  it('copies the raw https:// feed URL to the clipboard and shows confirmation', async () => {
    ;(calendarSyncApi.get as jest.Mock).mockResolvedValue({ feed_url: mockFeedUrl })
    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Copy Link')).toBeTruthy())
    fireEvent.press(getByText('Copy Link'))

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(mockFeedUrl)
      expect(getByText('Link copied!')).toBeTruthy()
    })
  })

  it('shows a confirmation alert before regenerating, and does not call the API on cancel', async () => {
    ;(calendarSyncApi.get as jest.Mock).mockResolvedValue({ feed_url: mockFeedUrl })
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByText } = renderScreen(makeClient())

    await waitFor(() => expect(getByText('Regenerate Link')).toBeTruthy())
    fireEvent.press(getByText('Regenerate Link'))

    expect(alertSpy).toHaveBeenCalledWith(
      'Regenerate calendar link?',
      "Your current calendar subscription will stop updating. You'll need to add the new link to your calendar app again.",
      expect.any(Array)
    )
    expect(calendarSyncApi.regenerate).not.toHaveBeenCalled()
  })

  it('regenerates the link and updates the displayed feed URL on confirm', async () => {
    ;(calendarSyncApi.get as jest.Mock).mockResolvedValue({ feed_url: mockFeedUrl })
    const newFeedUrl = 'https://studio.example.com/api/v1/calendar/newtoken456.ics'
    ;(calendarSyncApi.regenerate as jest.Mock).mockResolvedValue({ feed_url: newFeedUrl })

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      // Simulate the user pressing the "Regenerate" (confirm) button.
      const confirmButton = buttons?.find((b) => b.text === 'Regenerate')
      confirmButton?.onPress?.()
    })

    const { getByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Regenerate Link')).toBeTruthy())
    fireEvent.press(getByText('Regenerate Link'))

    await waitFor(() => expect(calendarSyncApi.regenerate).toHaveBeenCalledWith(42))
    expect(alertSpy).toHaveBeenCalled()

    // Copying now sends the newly regenerated URL, confirming state was replaced.
    fireEvent.press(getByText('Copy Link'))
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith(newFeedUrl))
  })

  it('shows an error alert when regeneration fails', async () => {
    ;(calendarSyncApi.get as jest.Mock).mockResolvedValue({ feed_url: mockFeedUrl })
    ;(calendarSyncApi.regenerate as jest.Mock).mockRejectedValue({
      code: 'SERVER_ERROR',
      message: 'Could not regenerate.',
    })

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      if (buttons) {
        const confirmButton = buttons.find((b) => b.text === 'Regenerate')
        confirmButton?.onPress?.()
      }
    })

    const { getByText } = renderScreen(makeClient())
    await waitFor(() => expect(getByText('Regenerate Link')).toBeTruthy())
    fireEvent.press(getByText('Regenerate Link'))

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Failed to regenerate calendar link', 'Could not regenerate.')
    )
  })
})
