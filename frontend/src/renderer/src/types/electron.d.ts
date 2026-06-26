interface OllamaStatus {
  installed: boolean
  running: boolean
  modelReady: boolean
}

interface Window {
  ollamaApi?: {
    getStatus: () => Promise<OllamaStatus>
    openDownloadPage: () => Promise<void>
    startServer: () => Promise<void>
    pull: () => Promise<{ success: boolean; error?: string }>
    onPullProgress: (callback: (message: string) => void) => void
    removePullProgressListeners: () => void
  }
}
