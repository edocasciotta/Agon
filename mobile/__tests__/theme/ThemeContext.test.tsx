import React from 'react'
import { Text } from 'react-native'
import { render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SecureStore from 'expo-secure-store'
import { ThemeProvider, useTheme, DEFAULT_PRIMARY } from '../../src/theme/ThemeContext'
import { studioApi } from '../../src/api/studio'

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('../../src/api/studio', () => ({
  studioApi: {
    getBranding: jest.fn(),
  },
}))

const mockGetItem = SecureStore.getItemAsync as jest.Mock
const mockSetItem = SecureStore.setItemAsync as jest.Mock
const mockGetBranding = studioApi.getBranding as jest.Mock

function ThemeProbe() {
  const theme = useTheme()
  return (
    <>
      <Text testID="primary">{theme.primary}</Text>
      <Text testID="primaryDark">{theme.primaryDark}</Text>
      <Text testID="primaryLight">{theme.primaryLight}</Text>
      <Text testID="secondary">{theme.secondary ?? ''}</Text>
    </>
  )
}

function renderWithProvider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetItem.mockResolvedValue(null)
})

describe('ThemeContext', () => {
  it('falls back to the default indigo when the branding fetch returns no color', async () => {
    mockGetBranding.mockResolvedValue({
      studio_name: 'Test Studio',
      primary_color: null,
      secondary_color: null,
    })

    const { getByTestId } = renderWithProvider()

    await waitFor(() => {
      expect(getByTestId('primary').props.children).toBe(DEFAULT_PRIMARY)
    })
  })

  it('falls back to the default indigo when the branding fetch fails', async () => {
    mockGetBranding.mockRejectedValue(new Error('network error'))

    const { getByTestId } = renderWithProvider()

    await waitFor(() => {
      expect(getByTestId('primary').props.children).toBe(DEFAULT_PRIMARY)
    })
  })

  it('applies the fetched primary and secondary colors when present', async () => {
    mockGetBranding.mockResolvedValue({
      studio_name: 'Test Studio',
      primary_color: '#FF5733',
      secondary_color: '#00AABB',
    })

    const { getByTestId } = renderWithProvider()

    await waitFor(() => {
      expect(getByTestId('primary').props.children).toBe('#FF5733')
    })
    expect(getByTestId('secondary').props.children).toBe('#00AABB')
    // Derived shades should differ from the base color (darken/lighten applied)
    expect(getByTestId('primaryDark').props.children).not.toBe('#FF5733')
    expect(getByTestId('primaryLight').props.children).not.toBe('#FF5733')
  })

  it('persists a successfully fetched primary color to SecureStore for offline reuse', async () => {
    mockGetBranding.mockResolvedValue({
      studio_name: 'Test Studio',
      primary_color: '#123456',
      secondary_color: null,
    })

    renderWithProvider()

    await waitFor(() => {
      expect(mockSetItem).toHaveBeenCalledWith('agon_cached_primary_color', '#123456')
    })
  })

  it('uses the last cached color instead of the default when offline with no fresh data', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'agon_cached_primary_color') return Promise.resolve('#ABCDEF')
      return Promise.resolve(null)
    })
    mockGetBranding.mockRejectedValue(new Error('offline'))

    const { getByTestId } = renderWithProvider()

    await waitFor(() => {
      expect(getByTestId('primary').props.children).toBe('#ABCDEF')
    })
  })
})
