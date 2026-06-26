import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OllamaSetup } from '../../../src/renderer/src/components/OllamaSetup'

const mockGetStatus = vi.fn()
const mockOnPullProgress = vi.fn()
const mockRemovePullProgressListeners = vi.fn()
const mockPull = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'ollamaApi', {
    writable: true,
    value: {
      getStatus: mockGetStatus,
      openDownloadPage: vi.fn(),
      startServer: vi.fn(),
      pull: mockPull,
      onPullProgress: mockOnPullProgress,
      removePullProgressListeners: mockRemovePullProgressListeners,
    },
  })
})

describe('OllamaSetup', () => {
  it('renders checking state on mount', async () => {
    // Return a promise that never resolves so we stay in checking state
    mockGetStatus.mockReturnValue(new Promise(() => {}))

    render(<OllamaSetup onReady={vi.fn()} />)

    expect(screen.getByText('Checking AI assistant status…')).toBeInTheDocument()
  })

  it('renders not_installed when ollama is missing', async () => {
    mockGetStatus.mockResolvedValue({ installed: false, running: false, modelReady: false })

    render(<OllamaSetup onReady={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('AI assistant requires Ollama')).toBeInTheDocument()
    })

    expect(screen.getByText('Download Ollama')).toBeInTheDocument()
    expect(screen.getByText("I've installed Ollama, continue")).toBeInTheDocument()
  })

  it('calls onReady when already ready', async () => {
    mockGetStatus.mockResolvedValue({ installed: true, running: true, modelReady: true })
    const onReady = vi.fn()

    render(<OllamaSetup onReady={onReady} />)

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledTimes(1)
    })
  })
})
