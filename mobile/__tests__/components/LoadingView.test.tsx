import React from 'react'
import { render } from '@testing-library/react-native'
import { LoadingView } from '../../src/components/LoadingView'

describe('LoadingView', () => {
  it('renders without crashing', () => {
    const { getByText } = render(<LoadingView />)
    expect(getByText('Loading...')).toBeTruthy()
  })

  it('shows custom message', () => {
    const { getByText } = render(<LoadingView message="Please wait" />)
    expect(getByText('Please wait')).toBeTruthy()
  })
})
