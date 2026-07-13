import { render, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuthenticatedImage } from '../../../src/renderer/src/components/AuthenticatedImage'

const getMock = vi.fn()

vi.mock('../../../src/renderer/src/api/client', () => ({
  apiClient: { get: (...args: unknown[]) => getMock(...args) },
}))

beforeEach(() => {
  getMock.mockReset()
  // jsdom doesn't implement these; stub them so the component can create/revoke object URLs.
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  cleanup()
})

describe('AuthenticatedImage', () => {
  it('fetches the resource as a blob via the authenticated apiClient and renders it via an object URL', async () => {
    const blob = new Blob(['fake-image-data'], { type: 'image/png' })
    getMock.mockResolvedValue({ data: blob })

    const { findByAltText } = render(
      <AuthenticatedImage src="/api/v1/photos/jane.png" alt="Jane's profile photo" />
    )

    const img = (await findByAltText("Jane's profile photo")) as HTMLImageElement
    expect(getMock).toHaveBeenCalledWith('/api/v1/photos/jane.png', { responseType: 'blob' })
    expect(img.getAttribute('src')).toBe('blob:mock-url')
  })

  it('renders nothing while loading and nothing if the fetch fails', async () => {
    getMock.mockRejectedValue(new Error('network error'))

    const { container } = render(
      <AuthenticatedImage src="/api/v1/photos/missing.png" alt="Missing photo" />
    )

    // Initially nothing is rendered (no premature broken <img>).
    expect(container.firstChild).toBeNull()

    // Wait for the rejected promise to settle; still nothing rendered.
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    expect(container.querySelector('img')).toBeNull()
  })

  it('revokes the created object URL on unmount', async () => {
    const blob = new Blob(['fake-image-data'], { type: 'image/png' })
    getMock.mockResolvedValue({ data: blob })

    const { findByAltText, unmount } = render(
      <AuthenticatedImage src="/api/v1/photos/jane.png" alt="Jane's profile photo" />
    )
    await findByAltText("Jane's profile photo")

    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
