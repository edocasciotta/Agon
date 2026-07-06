import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '../api/auth'
import type { ApiError } from '../api/client'

type PageState = 'validating' | 'form' | 'invalid' | 'expired' | 'success'

export function SetPassword() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const token = searchParams.get('token') ?? ''

  const [pageState, setPageState] = useState<PageState>('validating')
  const [clientEmail, setClientEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setPageState('invalid')
      return
    }
    authApi
      .validateInvite(token)
      .then((data) => {
        setClientEmail(data.email)
        setPageState('form')
      })
      .catch((err: ApiError) => {
        const code = err.code ?? ''
        if (code === 'INVITATION_EXPIRED' || code === 'RESET_TOKEN_EXPIRED') {
          setPageState('expired')
        } else {
          setPageState('invalid')
        }
      })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError(null)
    setSubmitError(null)

    if (password.length < 8) {
      setFieldError(t('setPassword.errorTooShort'))
      return
    }
    if (password !== confirm) {
      setFieldError(t('setPassword.errorMismatch'))
      return
    }

    setSubmitting(true)
    try {
      await authApi.resetPassword(token, password)
      setPageState('success')
    } catch (err) {
      const apiErr = err as ApiError
      const code = apiErr.code ?? ''
      if (code === 'RESET_TOKEN_EXPIRED' || code === 'INVITATION_EXPIRED') {
        setPageState('expired')
      } else if (
        code === 'RESET_TOKEN_NOT_FOUND' ||
        code === 'RESET_TOKEN_ALREADY_USED' ||
        code === 'INVITATION_NOT_FOUND' ||
        code === 'INVITATION_ALREADY_USED'
      ) {
        setPageState('invalid')
      } else {
        setSubmitError(t('setPassword.errorGeneric'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-indigo-600">Agon</h1>
          </div>

          {pageState === 'validating' && (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-500">{t('setPassword.loading')}</p>
            </div>
          )}

          {pageState === 'invalid' && (
            <div className="text-center py-4 space-y-4">
              <div className="rounded-md bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-700">{t('setPassword.errorInvalidToken')}</p>
              </div>
            </div>
          )}

          {pageState === 'expired' && (
            <div className="text-center py-4 space-y-4">
              <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm text-amber-700">{t('setPassword.errorExpiredToken')}</p>
              </div>
            </div>
          )}

          {pageState === 'form' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{t('setPassword.title')}</h2>
              <p className="text-gray-500 text-sm mb-1">{t('setPassword.subtitle')}</p>
              {clientEmail && (
                <p className="text-gray-400 text-xs mb-6 truncate">{clientEmail}</p>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('setPassword.passwordLabel')}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t('setPassword.passwordPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('setPassword.confirmLabel')}
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t('setPassword.confirmPlaceholder')}
                  />
                </div>
                {fieldError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                    {fieldError}
                  </div>
                )}
                {submitError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                    {submitError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? t('setPassword.submitting') : t('setPassword.submit')}
                </button>
              </form>
            </div>
          )}

          {pageState === 'success' && (
            <div className="text-center py-4 space-y-4">
              <div className="rounded-md bg-green-50 border border-green-200 p-4 space-y-2">
                <p className="text-sm font-medium text-green-700">{t('setPassword.successTitle')}</p>
                <p className="text-sm text-green-600">{t('setPassword.successMsg')}</p>
              </div>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                {t('setPassword.goToLogin')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
