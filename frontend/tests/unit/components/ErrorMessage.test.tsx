import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ErrorMessage } from '../../../src/renderer/src/components/ErrorMessage'

describe('ErrorMessage', () => {
  it('shows mapped error message for known code', () => {
    render(<ErrorMessage code="BOOKING_CLASS_FULL" />)
    expect(screen.getByText(/full/i)).toBeTruthy()
  })

  it('shows raw message when no code', () => {
    render(<ErrorMessage message="Something broke" />)
    expect(screen.getByText('Something broke')).toBeTruthy()
  })
})
