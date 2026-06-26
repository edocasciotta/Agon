import { getErrorMessage } from '../../src/lib/errorMessages'

describe('getErrorMessage', () => {
  it('returns mapped message for known code', () => {
    expect(getErrorMessage('BOOKING_CLASS_FULL')).toContain('full')
  })
  it('returns fallback for unknown code', () => {
    expect(getErrorMessage('XYZ_UNKNOWN')).toContain('XYZ_UNKNOWN')
  })
})
