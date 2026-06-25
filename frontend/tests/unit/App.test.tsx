import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from '../../src/renderer/src/App'

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />)
    expect(container).toBeTruthy()
  })
})
