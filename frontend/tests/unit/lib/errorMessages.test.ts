import { describe, it, expect } from 'vitest'
import { getErrorMessage } from '../../../src/renderer/src/lib/errorMessages'

describe('getErrorMessage', () => {
  it('returns mapped message for known code', () => {
    expect(getErrorMessage('BOOKING_CLASS_FULL')).toContain('full')
  })
  it('returns fallback for unknown code', () => {
    expect(getErrorMessage('UNKNOWN_CODE')).toContain('UNKNOWN_CODE')
  })
})
