import { useEffect, useState } from 'react'

interface OllamaSetupProps {
  onReady: () => void
}

type SetupState =
  | 'checking'
  | 'not_installed'
  | 'starting_server'
  | 'pulling_model'
  | 'ready'

export function OllamaSetup({ onReady }: OllamaSetupProps): JSX.Element {
  const [state, setState] = useState<SetupState>('checking')
  const [progressMessage, setProgressMessage] = useState<string>('')
  const [rechecking, setRechecking] = useState(false)

  const runSetup = async (): Promise<void> => {
    setState('checking')

    const status = await window.ollamaApi!.getStatus()

    if (status.installed && status.running && status.modelReady) {
      setState('ready')
      onReady()
      return
    }

    if (!status.installed) {
      setState('not_installed')
      return
    }

    if (!status.running) {
      setState('starting_server')
      await window.ollamaApi!.startServer()

      // Poll until running
      let running = false
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        const newStatus = await window.ollamaApi!.getStatus()
        if (newStatus.running) {
          running = true
          break
        }
      }

      if (!running) {
        // Server didn't start — fall back to not_installed UI
        setState('not_installed')
        return
      }
    }

    // Server is running — check model
    const freshStatus = await window.ollamaApi!.getStatus()
    if (freshStatus.modelReady) {
      setState('ready')
      onReady()
      return
    }

    // Need to pull the model
    setState('pulling_model')
    window.ollamaApi!.removePullProgressListeners()
    window.ollamaApi!.onPullProgress((msg: string) => {
      setProgressMessage(msg)
    })

    const result = await window.ollamaApi!.pull()
    window.ollamaApi!.removePullProgressListeners()

    if (result.success) {
      setState('ready')
      onReady()
    } else {
      setProgressMessage(`Pull failed: ${result.error ?? 'unknown error'}`)
    }
  }

  useEffect(() => {
    runSetup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRecheck = async (): Promise<void> => {
    setRechecking(true)
    await runSetup()
    setRechecking(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full mx-4 text-center">
        {/* Logo */}
        <div className="mb-8">
          <span className="text-4xl font-bold text-indigo-600 tracking-tight">Agon</span>
        </div>

        {state === 'checking' && (
          <>
            <Spinner />
            <p className="mt-4 text-gray-600 text-lg">Checking AI assistant status…</p>
          </>
        )}

        {state === 'not_installed' && (
          <>
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              AI assistant requires Ollama
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Agon's AI support assistant runs locally using Ollama. It's free, private, and keeps
              your studio data on your machine. You only need to install it once.
            </p>
            <button
              onClick={() => window.ollamaApi!.openDownloadPage()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg transition mb-3"
            >
              Download Ollama
            </button>
            <button
              onClick={handleRecheck}
              disabled={rechecking}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition disabled:opacity-50"
            >
              {rechecking ? 'Checking…' : "I've installed Ollama, continue"}
            </button>
          </>
        )}

        {state === 'starting_server' && (
          <>
            <Spinner />
            <p className="mt-4 text-gray-600 text-lg">Starting AI server…</p>
          </>
        )}

        {state === 'pulling_model' && (
          <>
            <Spinner />
            <p className="mt-4 text-gray-600 text-lg">
              Downloading AI model{' '}
              <span className="text-gray-400 text-sm">(first time only, ~2 GB)</span>
            </p>
            {progressMessage && (
              <p className="mt-3 text-indigo-600 text-sm font-mono bg-indigo-50 rounded-lg px-3 py-2 break-all">
                {progressMessage}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Spinner(): JSX.Element {
  return (
    <div className="flex justify-center">
      <svg
        className="animate-spin h-10 w-10 text-indigo-500"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  )
}
