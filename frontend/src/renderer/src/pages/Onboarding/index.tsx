import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { studioApi } from '../../api/studio'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [studioName, setStudioName] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStep1Next = async () => {
    if (!studioName.trim()) {
      setError('Studio name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await studioApi.update({ studio_name: studioName, timezone })
      setStep(2)
    } catch {
      setError('Failed to save studio settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    s < step
                      ? 'bg-indigo-600 text-white'
                      : s === step
                      ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {s < step ? '✓' : s}
                </div>
                {s < 5 && <div className={`flex-1 h-0.5 ${s < step ? 'bg-indigo-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Studio Info */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome to Agon</h2>
              <p className="text-gray-500 text-sm mb-6">Let's set up your studio.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Studio Name</label>
                  <input
                    type="text"
                    value={studioName}
                    onChange={(e) => setStudioName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="My Fitness Studio"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="UTC"
                  />
                  <p className="text-xs text-gray-400 mt-1">e.g. Europe/London, America/New_York</p>
                </div>
                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{error}</div>
                )}
                <button
                  onClick={handleStep1Next}
                  disabled={saving}
                  className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Next'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Manager account */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Manager Account</h2>
              <p className="text-gray-500 text-sm mb-6">Your admin account is ready.</p>
              <div className="rounded-md bg-green-50 border border-green-200 p-4 mb-6">
                <p className="text-green-700 text-sm font-medium">Manager account ready</p>
                <p className="text-green-600 text-sm mt-1">
                  You are already logged in as the studio manager. No additional setup is required.
                </p>
              </div>
              <button
                onClick={() => setStep(3)}
                className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Next
              </button>
            </div>
          )}

          {/* Step 3: Connectivity */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Connectivity</h2>
              <p className="text-gray-500 text-sm mb-6">Setting up your secure tunnel.</p>
              <div className="rounded-md bg-blue-50 border border-blue-200 p-4 mb-6 flex items-start gap-3">
                <LoadingSpinner size="sm" />
                <div>
                  <p className="text-blue-700 text-sm font-medium">Cloudflare Tunnel will start automatically</p>
                  <p className="text-blue-600 text-sm mt-1">
                    A secure tunnel allows the mobile app to connect to your studio. It starts automatically when Agon launches.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStep(4)}
                className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 4: Stripe */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Payments</h2>
              <p className="text-gray-500 text-sm mb-6">Connect Stripe to accept payments online.</p>
              <div className="rounded-md bg-gray-50 border border-gray-200 p-4 mb-6">
                <p className="text-gray-700 text-sm">
                  Stripe allows you to collect membership payments and one-time purchases from clients.
                  You can connect it now or skip and set it up later in Settings.
                </p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => setStep(5)}
                  className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Connect Stripe (optional)
                </button>
                <button
                  onClick={() => setStep(5)}
                  className="w-full py-2 px-4 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Setup complete!</h2>
              <p className="text-gray-500 text-sm mb-6">Your studio is ready. Connect the mobile app to get started.</p>
              <div className="rounded-md bg-gray-100 border border-gray-200 p-8 mb-6 flex flex-col items-center gap-2">
                <div className="w-32 h-32 bg-gray-300 rounded-md flex items-center justify-center text-gray-500 text-xs text-center">
                  QR code will appear here — scan to connect mobile app
                </div>
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
