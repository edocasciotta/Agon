import { validateStudioUrl, isPrivateHost } from '../../src/lib/validateStudioUrl'

describe('validateStudioUrl', () => {
  it('accepts https public URLs and normalises to origin', () => {
    const result = validateStudioUrl('https://studio.example.com/path/')
    expect(result).toEqual({ ok: true, url: 'https://studio.example.com' })
  })

  it('accepts http on localhost', () => {
    expect(validateStudioUrl('http://localhost:8000')).toEqual({
      ok: true,
      url: 'http://localhost:8000',
    })
  })

  it('accepts http on private LAN ranges', () => {
    expect(validateStudioUrl('http://192.168.1.50:8000').ok).toBe(true)
    expect(validateStudioUrl('http://10.0.0.5:8000').ok).toBe(true)
    expect(validateStudioUrl('http://172.16.4.4:8000').ok).toBe(true)
  })

  it('rejects http on public hosts (cleartext credential leak)', () => {
    expect(validateStudioUrl('http://studio.example.com').ok).toBe(false)
  })

  it('rejects non-http(s) schemes', () => {
    expect(validateStudioUrl('javascript:alert(1)').ok).toBe(false)
    expect(validateStudioUrl('file:///etc/passwd').ok).toBe(false)
    expect(validateStudioUrl('ftp://example.com').ok).toBe(false)
  })

  it('rejects unparseable input', () => {
    expect(validateStudioUrl('not a url').ok).toBe(false)
    expect(validateStudioUrl('').ok).toBe(false)
  })

  it('isPrivateHost distinguishes private vs public hosts', () => {
    expect(isPrivateHost('127.0.0.1')).toBe(true)
    expect(isPrivateHost('192.168.0.1')).toBe(true)
    expect(isPrivateHost('8.8.8.8')).toBe(false)
    expect(isPrivateHost('studio.example.com')).toBe(false)
  })
})
