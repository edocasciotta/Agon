import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WaiversPage } from '../../../src/renderer/src/pages/Waivers/index'

vi.mock('../../../src/renderer/src/api/waivers', () => ({
  waiversApi: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    deactivate: vi.fn().mockResolvedValue({}),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <WaiversPage />
    </QueryClientProvider>
  )
}

const sampleWaiver = {
  id: 1,
  location_id: 1,
  title: 'Liability Waiver',
  body: 'I agree to the terms.',
  version: 1,
  requires_before_booking: true,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('WaiversPage', () => {
  it('renders the page heading', async () => {
    renderPage()
    const heading = await screen.findByText('Waivers')
    expect(heading).toBeTruthy()
  })

  it('shows empty state when there are no waivers', async () => {
    renderPage()
    const empty = await screen.findByText('No waivers yet')
    expect(empty).toBeTruthy()
  })

  it('renders waiver rows when waivers exist, with version and required badge', async () => {
    const { waiversApi } = await import('../../../src/renderer/src/api/waivers')
    vi.mocked(waiversApi.list).mockResolvedValue([sampleWaiver])
    renderPage()

    const name = await screen.findByText('Liability Waiver')
    expect(name).toBeTruthy()
    expect(screen.getByText('v1')).toBeTruthy()
    expect(screen.getByText('Required')).toBeTruthy()
    expect(screen.getByText('Active')).toBeTruthy()
  })

  it('creates a new waiver via the modal', async () => {
    const { waiversApi } = await import('../../../src/renderer/src/api/waivers')
    vi.mocked(waiversApi.list).mockResolvedValue([sampleWaiver])
    vi.mocked(waiversApi.create).mockResolvedValue({ ...sampleWaiver, id: 2, title: 'New Waiver' })
    renderPage()

    await screen.findByText('Liability Waiver')
    fireEvent.click(screen.getByRole('button', { name: /new waiver/i }))

    fireEvent.change(screen.getByPlaceholderText('e.g. Liability Waiver'), {
      target: { value: 'New Waiver' },
    })
    fireEvent.change(
      screen.getByPlaceholderText(
        'Enter the full text of the waiver that clients will read and sign.'
      ),
      { target: { value: 'Some waiver text' } }
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(waiversApi.create).toHaveBeenCalled()
    })
    expect(vi.mocked(waiversApi.create).mock.calls[0][0]).toEqual({
      title: 'New Waiver',
      body: 'Some waiver text',
      requires_before_booking: false,
    })
  })

  it('shows a version-bump warning when editing and changing the body', async () => {
    const { waiversApi } = await import('../../../src/renderer/src/api/waivers')
    vi.mocked(waiversApi.list).mockResolvedValue([sampleWaiver])
    renderPage()

    const row = await screen.findByText('Liability Waiver')
    fireEvent.click(row)

    // Note is shown before any edit
    expect(
      screen.getByText('Editing the text creates a new version and clients must re-sign.')
    ).toBeTruthy()

    const bodyField = screen.getByDisplayValue('I agree to the terms.')
    fireEvent.change(bodyField, { target: { value: 'Updated terms.' } })

    expect(
      await screen.findByText(
        "You changed the body — saving will create a new version and clients must re-sign."
      )
    ).toBeTruthy()
  })

  it('deactivates a waiver using the non-destructive confirm dialog', async () => {
    const { waiversApi } = await import('../../../src/renderer/src/api/waivers')
    vi.mocked(waiversApi.list).mockResolvedValue([sampleWaiver])
    vi.mocked(waiversApi.deactivate).mockResolvedValue({ ...sampleWaiver, is_active: false })
    renderPage()

    await screen.findByText('Liability Waiver')
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))

    expect(await screen.findByText('Deactivate this waiver?')).toBeTruthy()
    expect(waiversApi.deactivate).not.toHaveBeenCalled()

    const confirmButtons = screen.getAllByRole('button', { name: 'Deactivate' })
    fireEvent.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => {
      expect(waiversApi.deactivate).toHaveBeenCalledWith(1)
    })
  })
})
