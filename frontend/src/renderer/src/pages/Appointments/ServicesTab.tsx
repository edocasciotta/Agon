import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { appointmentServicesApi } from '../../api/appointmentServices'
import type { AppointmentService } from '../../types'
import {
  appointmentServiceSchema,
  type AppointmentServiceFormData,
} from '../../lib/formSchemas'
import { resolveApiError } from '../../lib/errorMessages'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/EmptyState'
import { LoadingSpinner } from '../../components/LoadingSpinner'

const emptyForm: AppointmentServiceFormData = {
  name: '',
  description: '',
  duration_minutes: 60,
  buffer_minutes: 0,
}

interface ServiceModalProps {
  initial: AppointmentServiceFormData
  title: string
  onSave: (data: AppointmentServiceFormData) => void
  onClose: () => void
  saving: boolean
  error: string | null
}

function ServiceModal({ initial, title, onSave, onClose, saving, error }: ServiceModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<AppointmentServiceFormData>(initial)
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = appointmentServiceSchema.safeParse(form)
    if (!result.success) {
      setValidationError(result.error.issues[0].message)
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
        className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('appointmentServices.name')} *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('appointmentServices.namePlaceholder')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('appointmentServices.description')}
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('appointmentServices.descriptionPlaceholder')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('appointmentServices.durationMinutes')} *
              </label>
              <input
                type="number"
                min={1}
                value={form.duration_minutes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('appointmentServices.bufferMinutes')}
              </label>
              <input
                type="number"
                min={0}
                value={form.buffer_minutes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, buffer_minutes: Number(e.target.value) }))
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
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

export function ServicesTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<AppointmentService | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<AppointmentService | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    data: services = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['appointment-services', true],
    queryFn: () => appointmentServicesApi.list(true),
  })

  const createMutation = useMutation({
    mutationFn: appointmentServicesApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointment-services'] })
      setCreateOpen(false)
      setFormError(null)
    },
    onError: (err: unknown) => {
      setFormError(resolveApiError(err, t('appointmentServices.failedCreate')))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AppointmentServiceFormData }) =>
      appointmentServicesApi.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointment-services'] })
      setEditItem(null)
      setFormError(null)
    },
    onError: (err: unknown) => {
      setFormError(resolveApiError(err, t('appointmentServices.failedEdit')))
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => appointmentServicesApi.deactivate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointment-services'] })
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
        title={t('appointmentServices.title')}
        action={
          !createOpen && services.length > 0 ? (
            <button
              onClick={() => {
                setCreateOpen(true)
                setFormError(null)
              }}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
            >
              {t('appointmentServices.newService')}
            </button>
          ) : null
        }
      />

      {services.length === 0 && !createOpen ? (
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
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          }
          title={t('appointmentServices.noServices')}
          description={t('appointmentServices.emptyDesc')}
          actionLabel={t('appointmentServices.newService')}
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
                  {t('appointmentServices.name')}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('appointmentServices.durationMinutes')}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('appointmentServices.bufferMinutes')}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('common.status')}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.map((service) => (
                <tr
                  key={service.id}
                  className={`hover:bg-gray-50 cursor-pointer ${!service.is_active ? 'opacity-60' : ''}`}
                  onClick={() => {
                    setEditItem(service)
                    setFormError(null)
                  }}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{service.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {t('appointmentServices.minutesValue', { count: service.duration_minutes })}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {t('appointmentServices.minutesValue', { count: service.buffer_minutes })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        service.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {service.is_active ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {service.is_active && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeactivateTarget(service)
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
                      >
                        {t('appointmentServices.deactivate')}
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
        <ServiceModal
          title={t('appointmentServices.newService')}
          initial={emptyForm}
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
        <ServiceModal
          title={t('appointmentServices.editService')}
          initial={{
            name: editItem.name,
            description: editItem.description ?? '',
            duration_minutes: editItem.duration_minutes,
            buffer_minutes: editItem.buffer_minutes,
          }}
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
              {t('appointmentServices.deactivateConfirmTitle')}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {t('appointmentServices.deactivateConfirmDesc')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => deactivateMutation.mutate(deactivateTarget.id)}
                disabled={deactivateMutation.isPending}
                className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {deactivateMutation.isPending
                  ? t('common.saving')
                  : t('appointmentServices.deactivate')}
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
