import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { InstructorsPage } from '../../../src/renderer/src/pages/Instructors'

const listMock = vi.fn().mockResolvedValue([
  { id: 1, user_id: 1, full_name: 'Jane Smith', email: 'jane@example.com', bio: '', is_active: true },
])
const uploadPhotoMock = vi.fn()
const apiClientGetMock = vi.fn().mockResolvedValue({ data: new Blob(['x'], { type: 'image/png' }) })

vi.mock('../../../src/renderer/src/api/instructors', () => ({
  instructorsApi: {
    list: (...args: unknown[]) => listMock(...args),
    create: vi.fn(),
    update: vi.fn(),
    reactivate: vi.fn(),
    deactivate: vi.fn(),
    remove: vi.fn(),
    uploadPhoto: (...args: unknown[]) => uploadPhotoMock(...args),
  },
}))

vi.mock('../../../src/renderer/src/api/classes', () => ({
  classesApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}))

// AuthenticatedImage (used to display an uploaded photo) fetches through the shared apiClient.
vi.mock('../../../src/renderer/src/api/client', () => ({
  apiClient: { get: (...args: unknown[]) => apiClientGetMock(...args) },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <InstructorsPage />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  listMock.mockClear()
  uploadPhotoMock.mockReset()
  apiClientGetMock.mockClear()
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
})

describe('InstructorsPage', () => {
  it('renders the search input', async () => {
    renderPage()
    const input = await screen.findByPlaceholderText(/search by name/i)
    expect(input).toBeTruthy()
  })

  it('calls the API with the search term after typing (debounced)', async () => {
    renderPage()
    const input = await screen.findByPlaceholderText(/search by name/i)
    fireEvent.change(input, { target: { value: 'Jane' } })

    await waitFor(
      () => {
        expect(listMock).toHaveBeenCalledWith('Jane', true)
      },
      { timeout: 1000 }
    )
  })

  it('uploads a new photo from the edit modal and displays it once the upload succeeds', async () => {
    uploadPhotoMock.mockResolvedValue({
      id: 1,
      user_id: 1,
      full_name: 'Jane Smith',
      email: 'jane@example.com',
      bio: '',
      is_active: true,
      photo_url: '/api/v1/photos/jane.png',
    })

    renderPage()
    const editButton = await screen.findByText('Edit')
    fireEvent.click(editButton)

    const changePhotoButton = await screen.findByTitle('Change photo')
    fireEvent.click(changePhotoButton)

    const fileInput = document.getElementById('instructor-photo-input') as HTMLInputElement
    const file = new File([new Uint8Array(10)], 'photo.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(uploadPhotoMock).toHaveBeenCalledWith(1, file)
    })

    // Once the mutation resolves, the modal should now show the uploaded photo via AuthenticatedImage.
    expect(await screen.findByAltText("Jane Smith's profile photo")).toBeTruthy()
  })
})
