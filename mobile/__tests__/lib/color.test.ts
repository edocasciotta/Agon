import { darken, lighten, isValidHexColor } from '../../src/lib/color'

describe('color utils', () => {
  it('darken() reduces each RGB channel', () => {
    expect(darken('#4F46E5')).toBe('#463eca')
  })

  it('lighten() increases each RGB channel toward white', () => {
    expect(lighten('#4F46E5')).toBe('#8d87ee')
  })

  it('isValidHexColor() accepts well-formed 6-digit hex strings', () => {
    expect(isValidHexColor('#4F46E5')).toBe(true)
    expect(isValidHexColor('#abc123')).toBe(true)
  })

  it('isValidHexColor() rejects null, undefined, and malformed input', () => {
    expect(isValidHexColor(null)).toBe(false)
    expect(isValidHexColor(undefined)).toBe(false)
    expect(isValidHexColor('not-a-color')).toBe(false)
    expect(isValidHexColor('#FFF')).toBe(false)
  })
})
