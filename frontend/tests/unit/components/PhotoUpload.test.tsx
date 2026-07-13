import { render, fireEvent, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PhotoUpload } from '../../../src/renderer/src/components/PhotoUpload'

function makeFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

describe('PhotoUpload', () => {
  it('shows a client-side validation error and does not call onUpload for an unsupported file type', () => {
    const onUpload = vi.fn()
    render(
      <PhotoUpload
        photoUrl={null}
        fallback={<div>fallback</div>}
        onUpload={onUpload}
        inputId="test-photo-type"
        name="Jane Doe"
      />
    )

    const input = document.getElementById('test-photo-type') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('doc.pdf', 'application/pdf', 1000)] } })

    expect(onUpload).not.toHaveBeenCalled()
    expect(screen.getByText(/JPG, PNG, or WEBP/i)).toBeTruthy()
  })

  it('shows a client-side validation error and does not call onUpload for an oversized file', () => {
    const onUpload = vi.fn()
    render(
      <PhotoUpload
        photoUrl={null}
        fallback={<div>fallback</div>}
        onUpload={onUpload}
        inputId="test-photo-size"
        name="Jane Doe"
      />
    )

    const input = document.getElementById('test-photo-size') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('big.png', 'image/png', 6 * 1024 * 1024)] } })

    expect(onUpload).not.toHaveBeenCalled()
    expect(screen.getByText(/smaller than 5MB/i)).toBeTruthy()
  })

  it('calls onUpload with the file once client-side validation passes, without hitting an API', () => {
    const onUpload = vi.fn()
    render(
      <PhotoUpload
        photoUrl={null}
        fallback={<div>fallback</div>}
        onUpload={onUpload}
        inputId="test-photo-valid"
        name="Jane Doe"
      />
    )

    const input = document.getElementById('test-photo-valid') as HTMLInputElement
    const file = makeFile('good.png', 'image/png', 1000)
    fireEvent.change(input, { target: { files: [file] } })

    expect(onUpload).toHaveBeenCalledTimes(1)
    expect(onUpload).toHaveBeenCalledWith(file)
    expect(screen.queryByText(/JPG, PNG, or WEBP/i)).toBeNull()
    expect(screen.queryByText(/smaller than 5MB/i)).toBeNull()
  })

  it('renders the fallback when no photo is set, and shows the uploading state', () => {
    render(
      <PhotoUpload
        photoUrl={null}
        fallback={<div>initials-fallback</div>}
        onUpload={vi.fn()}
        isUploading
        inputId="test-photo-uploading"
        name="Jane Doe"
      />
    )

    expect(screen.getByText('initials-fallback')).toBeTruthy()
    expect(screen.getByText(/uploading/i)).toBeTruthy()
  })
})
