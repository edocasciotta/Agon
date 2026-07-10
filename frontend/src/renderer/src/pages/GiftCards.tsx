import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { giftCardsApi } from '../api/giftCards'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import type { GiftCard } from '../types'
import { giftCardSchema } from '../lib/formSchemas'
import { resolveApiError } from '../lib/errorMessages'

const EMPTY_FORM = {
  initial_value: '',
  recipient_name: '',
  recipient_email: '',
  message: '',
  expires_at: '',
}

function getStatus(giftCard: GiftCard): 'active' | 'inactive' | 'expired' {
  if (!giftCard.is_active) return 'inactive'
  if (giftCard.expires_at && new Date(giftCard.expires_at) < new Date()) return 'expired'
  return 'active'
}

function StatusBadge({ status }: { status: 'active' | 'inactive' | 'expired' }) {
  const { t } = useTranslation()
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-500',
    expired: 'bg-amber-100 text-amber-700',
  }
  const labels: Record<string, string> = {
    active: t('giftCards.active'),
    inactive: t('giftCards.inactive'),
    expired: t('giftCards.expired'),
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

export function GiftCardsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [showIssueModal, setShowIssueModal] = useState(false)
  const [issueError, setIssueError] = useState<string | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)

  const [confirmDeactivateId, setConfirmDeactivateId] = useState<number | null>(null)

  const { data: giftCards, isLoading } = useQuery({
    queryKey: ['gift-cards'],
    queryFn: () => giftCardsApi.list(),
  })

  const issueMutation = useMutation({
    mutationFn: giftCardsApi.issue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] })
      setShowIssueModal(false)
      setIssueError(null)
      setFormData(EMPTY_FORM)
    },
    onError: (err: unknown) => {
      setIssueError(resolveApiError(err, t('giftCards.failedIssue')))
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => giftCardsApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] })
      setConfirmDeactivateId(null)
    },
  })

  const openIssueModal = () => {
    setShowIssueModal(true)
    setIssueError(null)
    setFormData(EMPTY_FORM)
  }

  const handleIssue = () => {
    const zodResult = giftCardSchema.safeParse(formData)
    if (!zodResult.success) {
      setIssueError(zodResult.error.errors[0].message)
      return
    }
    issueMutation.mutate({
      initial_value: Number(formData.initial_value),
      recipient_name: formData.recipient_name.trim() || null,
      recipient_email: formData.recipient_email.trim() || null,
      message: formData.message.trim() || null,
      expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
    })
  }

  const confirmDeactivateCard = giftCards?.find((g) => g.id === confirmDeactivateId)

  return (
    <div>
      <PageHeader
        title={t('giftCards.title')}
        action={
          giftCards && giftCards.length > 0 ? (
            <button
              onClick={openIssueModal}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {t('giftCards.issue')}
            </button>
          ) : null
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : !giftCards || giftCards.length === 0 ? (
        <EmptyState
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
          }
          title={t('giftCards.noGiftCards')}
          description={t('giftCards.emptyDesc')}
          actionLabel={t('giftCards.issue')}
          onAction={openIssueModal}
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('giftCards.code')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('giftCards.recipient')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('giftCards.initialValue')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('giftCards.remainingBalance')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.startDate')}</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {giftCards.map((giftCard) => {
                const status = getStatus(giftCard)
                const recipient = giftCard.recipient_name || giftCard.recipient_email
                return (
                  <tr key={giftCard.id} className={status !== 'active' ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="px-6 py-4 text-sm font-mono font-medium text-gray-900">{giftCard.code}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {recipient ? (
                        <div>
                          {giftCard.recipient_name && <div className="text-gray-900">{giftCard.recipient_name}</div>}
                          {giftCard.recipient_email && <div className="text-xs text-gray-400">{giftCard.recipient_email}</div>}
                        </div>
                      ) : (
                        t('giftCards.noRecipient')
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatCurrency(giftCard.initial_value, giftCard.currency)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatCurrency(giftCard.remaining_balance, giftCard.currency)} / {formatCurrency(giftCard.initial_value, giftCard.currency)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(giftCard.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {giftCard.is_active && (
                          <button
                            onClick={() => setConfirmDeactivateId(giftCard.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            {t('giftCards.deactivate')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => { setShowIssueModal(false); setIssueError(null) }}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('giftCards.issue')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('giftCards.initialValue')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.initial_value}
                  onChange={(e) => setFormData({ ...formData, initial_value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="50.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('giftCards.recipientName')}</label>
                <input
                  type="text"
                  value={formData.recipient_name}
                  onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('giftCards.recipientNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('giftCards.recipientEmail')}</label>
                <input
                  type="email"
                  value={formData.recipient_email}
                  onChange={(e) => setFormData({ ...formData, recipient_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('giftCards.recipientEmailPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('giftCards.message')}</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('giftCards.messagePlaceholder')}
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('giftCards.expiresAt')}</label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('giftCards.expiresAtPlaceholder')}
                />
              </div>
              {issueError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{issueError}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleIssue}
                  disabled={issueMutation.isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {issueMutation.isPending ? t('giftCards.issuing') : t('giftCards.issue')}
                </button>
                <button
                  onClick={() => { setShowIssueModal(false); setIssueError(null) }}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Dialog */}
      {confirmDeactivateId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setConfirmDeactivateId(null)}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-2">{t('giftCards.deactivateConfirm')}</h2>
            {confirmDeactivateCard && (
              <p className="text-sm font-mono font-medium text-indigo-700 mb-3">"{confirmDeactivateCard.code}"</p>
            )}
            <p className="text-sm text-gray-600 mb-4">{t('giftCards.deactivateDesc')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => deactivateMutation.mutate(confirmDeactivateId)}
                disabled={deactivateMutation.isPending}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deactivateMutation.isPending ? t('common.loading') : t('giftCards.deactivate')}
              </button>
              <button
                onClick={() => setConfirmDeactivateId(null)}
                className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
