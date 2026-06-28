import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { studioApi } from '../../api/studio'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [studioName, setStudioName] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geminiKey, setGeminiKey] = useState('')
  const [savingAi, setSavingAi] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const handleStep1Next = async () => {
    if (!studioName.trim()) {
      setError(t('onboarding.studioNameRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await studioApi.update({ studio_name: studioName, timezone })
      setStep(2)
    } catch {
      setError(t('onboarding.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAiKey = async () => {
    setSavingAi(true)
    setAiError(null)
    try {
      await studioApi.saveAiKey(geminiKey)
      setStep(6)
    } catch {
      setAiError(t('onboarding.saveKeyError'))
    } finally {
      setSavingAi(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3, 4, 5, 6].map((s) => (
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
                {s < 6 && <div className={`flex-1 h-0.5 ${s < step ? 'bg-indigo-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Studio Info */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{t('onboarding.step1Title')}</h2>
              <p className="text-gray-500 text-sm mb-6">{t('onboarding.step1Subtitle')}</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('onboarding.studioName')}</label>
                  <input
                    type="text"
                    value={studioName}
                    onChange={(e) => setStudioName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t('onboarding.studioNamePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('onboarding.timezone')}</label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t('onboarding.timezonePlaceholder')}
                  />
                  <p className="text-xs text-gray-400 mt-1">{t('onboarding.timezoneHint')}</p>
                </div>
                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{error}</div>
                )}
                <button
                  onClick={handleStep1Next}
                  disabled={saving}
                  className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? t('onboarding.saving') : t('onboarding.next')}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Manager account */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{t('onboarding.step2Title')}</h2>
              <p className="text-gray-500 text-sm mb-6">{t('onboarding.step2Subtitle')}</p>
              <div className="rounded-md bg-green-50 border border-green-200 p-4 mb-6">
                <p className="text-green-700 text-sm font-medium">{t('onboarding.step2Ready')}</p>
                <p className="text-green-600 text-sm mt-1">{t('onboarding.step2ReadyDetail')}</p>
              </div>
              <button
                onClick={() => setStep(3)}
                className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                {t('onboarding.next')}
              </button>
            </div>
          )}

          {/* Step 3: Connectivity */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{t('onboarding.step3Title')}</h2>
              <p className="text-gray-500 text-sm mb-6">{t('onboarding.step3Subtitle')}</p>
              <div className="rounded-md bg-blue-50 border border-blue-200 p-4 mb-6 flex items-start gap-3">
                <LoadingSpinner size="sm" />
                <div>
                  <p className="text-blue-700 text-sm font-medium">{t('onboarding.step3Info')}</p>
                  <p className="text-blue-600 text-sm mt-1">{t('onboarding.step3InfoDetail')}</p>
                </div>
              </div>
              <button
                onClick={() => setStep(4)}
                className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                {t('onboarding.continue')}
              </button>
            </div>
          )}

          {/* Step 4: Stripe */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{t('onboarding.step4Title')}</h2>
              <p className="text-gray-500 text-sm mb-6">{t('onboarding.step4Subtitle')}</p>
              <div className="rounded-md bg-gray-50 border border-gray-200 p-4 mb-6">
                <p className="text-gray-700 text-sm">{t('onboarding.step4Detail')}</p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => setStep(5)}
                  className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  {t('onboarding.connectStripe')}
                </button>
                <button
                  onClick={() => setStep(5)}
                  className="w-full py-2 px-4 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  {t('onboarding.skipForNow')}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: AI Assistant */}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{t('onboarding.step5Title')}</h2>
              <p className="text-gray-500 text-sm mb-6">{t('onboarding.step5Subtitle')}</p>
              <div className="rounded-md bg-blue-50 border border-blue-200 p-4 mb-4">
                <p className="text-blue-700 text-sm">{t('onboarding.step5Info')}</p>
              </div>
              <a
                href="https://aistudio.google.com"
                target="_blank"
                rel="noreferrer"
                className="inline-block text-indigo-600 text-sm font-medium hover:text-indigo-700 mb-6"
              >
                {t('onboarding.step5Link')}
              </a>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('onboarding.geminiApiKey')}</label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t('onboarding.geminiPlaceholder')}
                  />
                </div>
                {aiError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{aiError}</div>
                )}
                <button
                  onClick={handleSaveAiKey}
                  disabled={savingAi}
                  className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {savingAi ? t('onboarding.savingKey') : t('onboarding.saveAndContinue')}
                </button>
                <button
                  onClick={() => setStep(6)}
                  className="w-full py-2 px-4 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  {t('onboarding.skipForNow')}
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Complete */}
          {step === 6 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{t('onboarding.step6Title')}</h2>
              <p className="text-gray-500 text-sm mb-6">{t('onboarding.step6Subtitle')}</p>
              <div className="rounded-md bg-gray-100 border border-gray-200 p-8 mb-6 flex flex-col items-center gap-2">
                <div className="w-32 h-32 bg-gray-300 rounded-md flex items-center justify-center text-gray-500 text-xs text-center">
                  {t('onboarding.qrPlaceholder')}
                </div>
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                {t('onboarding.goToDashboard')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
