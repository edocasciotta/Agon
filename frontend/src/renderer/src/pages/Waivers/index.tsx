import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { waiversApi } from '../../api/waivers'
import type { WaiverResponse } from '../../types'
import { waiverSchema, type WaiverFormData } from '../../lib/formSchemas'
import { resolveApiError } from '../../lib/errorMessages'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/EmptyState'
import { LoadingSpinner } from '../../components/LoadingSpinner'

const emptyForm: WaiverFormData = { title: '', body: '', requires_before_booking: false }

interface WaiverModalProps {
  initial: WaiverFormData
  title: string
  onSave: (data: WaiverFormData) => void
  onClose: () => void
  saving: boolean
  error: string | null
  isEdit: boolean
  originalBody?: string
}

function WaiverModal({
  initial,
  title,
  onSave,
  onClose,
  saving,
  error,
  isEdit,
  originalBody,
}: WaiverModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<WaiverFormData>(initial)
  const [validationError, setValidationError] = useState<string | null>(null)

  const bodyChanged = isEdit && originalBody !== undefined && form.body !== originalBody

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = waiverSchema.safeParse(form)
    if (!result.success) {
      setValidationError(result.error.errors[0].message)
      return
    }
    setValidationError(null)
    onSave(form)
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('waivers.formTitle')} *
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={t('waivers.titlePlaceholder')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('waivers.body')} *
            </label>
            <textarea
              required
              rows={10}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder={t('waivers.bodyPlaceholder')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {isEdit && (
              <p className="mt-1 text-xs text-gray-500">
                {bodyChanged ? (
                  <span className="text-amber-600 font-medium">{t('waivers.versionBumpWarning')}</span>
                ) : (
                  t('waivers.versionBumpNote')
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requires_before_booking"
              checked={form.requires_before_booking}
              onChange={(e) =>
                setForm((f) => ({ ...f, requires_before_booking: e.target.checked }))
              }
              className="w-4 h-4"
            />
            <label htmlFor="requires_before_booking" className="text-sm text-gray-700">
              {t('waivers.requiresBeforeBooking')}
            </label>
          </div>
          {(validationError || error) && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {validationError ?? error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function WaiversPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<WaiverResponse | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<WaiverResponse | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    data: waivers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['waivers'],
    queryFn: () => waiversApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: waiversApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['waivers'] })
      setCreateOpen(false)
      setFormError(null)
    },
    onError: (err: unknown) => {
      setFormError(resolveApiError(err, t('waivers.failedCreate')))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: WaiverFormData }) =>
      waiversApi.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['waivers'] })
      setEditItem(null)
      setFormError(null)
    },
    onError: (err: unknown) => {
      setFormError(resolveApiError(err, t('waivers.failedEdit')))
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => waiversApi.deactivate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['waivers'] })
      setDeactivateTarget(null)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return <p className="text-red-500 text-sm">{t('common.error')}</p>
  }

  return (
    <div>
      <PageHeader
        title={t('waivers.title')}
        action={
          !createOpen && waivers.length > 0 ? (
            <button
              onClick={() => {
                setCreateOpen(true)
                setFormError(null)
              }}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
            >
              {t('waivers.newWaiver')}
            </button>
          ) : null
        }
      />

      {waivers.length === 0 && !createOpen ? (
        <EmptyState
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-8 h-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
          }
          title={t('waivers.noWaivers')}
          description={t('waivers.emptyDesc')}
          actionLabel={t('waivers.newWaiver')}
          onAction={() => {
            setCreateOpen(true)
            setFormError(null)
          }}
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('waivers.formTitle')}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('waivers.version')}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('waivers.requiresBeforeBooking')}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('common.status')}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {waivers.map((waiver) => (
                <tr
                  key={waiver.id}
                  className={`hover:bg-gray-50 cursor-pointer ${!waiver.is_active ? 'opacity-60' : ''}`}
                  onClick={() => {
                    setEditItem(waiver)
                    setFormError(null)
                  }}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{waiver.title}</td>
                  <td className="px-4 py-3 text-gray-600">
                    v{waiver.version}
                  </td>
                  <td className="px-4 py-3">
                    {waiver.requires_before_booking && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                        {t('waivers.requiredBadge')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        waiver.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {waiver.is_active ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {waiver.is_active && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeactivateTarget(waiver)
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
                      >
                        {t('waivers.deactivate')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <WaiverModal
          title={t('waivers.newWaiver')}
          initial={emptyForm}
          isEdit={false}
          onSave={(data) => createMutation.mutate(data)}
          onClose={() => {
            setCreateOpen(false)
            setFormError(null)
          }}
          saving={createMutation.isPending}
          error={formError}
        />
      )}

      {editItem && (
        <WaiverModal
          title={t('waivers.editWaiver')}
          initial={{
            title: editItem.title,
            body: editItem.body,
            requires_before_booking: editItem.requires_before_booking,
          }}
          isEdit
          originalBody={editItem.body}
          onSave={(data) => updateMutation.mutate({ id: editItem.id, data })}
          onClose={() => {
            setEditItem(null)
            setFormError(null)
          }}
          saving={updateMutation.isPending}
          error={formError}
        />
      )}

      {deactivateTarget && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
          onClick={() => setDeactivateTarget(null)}
        >
          <div
            className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              {t('waivers.deactivateConfirmTitle')}
            </h2>
            <p className="text-sm text-gray-600 mb-4">{t('waivers.deactivateConfirmDesc')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => deactivateMutation.mutate(deactivateTarget.id)}
                disabled={deactivateMutation.isPending}
                className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {deactivateMutation.isPending ? t('common.saving') : t('waivers.deactivate')}
              </button>
              <button
                onClick={() => setDeactivateTarget(null)}
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
