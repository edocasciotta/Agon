import React from 'react'
import { render, screen } from '@testing-library/react-native'

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}))

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

import IndexScreen from '../app/index'

describe('IndexScreen', () => {
  it('renders loading indicator while checking auth', () => {
    render(<IndexScreen />)
    // The splash screen shows an ActivityIndicator (no visible text)
    // Just verify it renders without crashing
    expect(screen.toJSON()).toBeTruthy()
  })
})
