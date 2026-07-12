import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { appointmentServicesApi } from '../api/appointmentServices'
import { instructorsApi } from '../api/instructors'
import { appointmentsApi } from '../api/appointments'
import { clientsApi } from '../api/clients'
import { bookAppointmentSchema } from '../lib/formSchemas'
import { resolveApiError } from '../lib/errorMessages'

interface BookAppointmentModalProps {
  isOpen: boolean
  onClose: () => void
}

export function BookAppointmentModal({ isOpen, onClose }: BookAppointmentModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [serviceId, setServiceId] = useState<number | null>(null)
  const [instructorId, setInstructorId] = useState<number | null>(null)
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [selectedClientLabel, setSelectedClientLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const { data: services = [] } = useQuery({
    queryKey: ['appointment-services', false],
    queryFn: () => appointmentServicesApi.list(false),
    enabled: isOpen,
  })

  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => instructorsApi.list(),
    enabled: isOpen,
  })

  const { data: slots = [], isFetching: slotsLoading } = useQuery({
    queryKey: ['available-slots', serviceId, instructorId, date],
    queryFn: () =>
      appointmentsApi.availableSlots({
        service_id: serviceId as number,
        instructor_id: instructorId as number,
        date,
      }),
    enabled: isOpen && serviceId !== null && instructorId !== null && date.length > 0,
  })

  const { data: clientsPage } = useQuery({
    queryKey: ['clients', clientSearch, 1, 10],
    queryFn: () => clientsApi.list(clientSearch || undefined, 1, 10),
    enabled: isOpen && clientSearch.length >= 2,
  })

  const clients = clientsPage?.items ?? []

  const bookMutation = useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      handleClose()
    },
    onError: (err: unknown) => {
      setApiError(resolveApiError(err, t('appointments.bookingFailed')))
    },
  })

  function handleClose() {
    setServiceId(null)
    setInstructorId(null)
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setSelectedSlot(null)
    setClientSearch('')
    setSelectedClientId(null)
    setSelectedClientLabel('')
    setNotes('')
    setValidationError(null)
    setApiError(null)
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = bookAppointmentSchema.safeParse({
      service_id: serviceId ?? 0,
      instructor_id: instructorId ?? 0,
      starts_at: selectedSlot ?? '',
      client_id: selectedClientId ?? 0,
      notes: notes || undefined,
    })
    if (!result.success) {
      setValidationError(result.error.issues[0].message)
      return
    }
    setValidationError(null)
    setApiError(null)
    bookMutation.mutate({
      service_id: result.data.service_id,
      instructor_id: result.data.instructor_id,
      starts_at: result.data.starts_at,
      client_id: result.data.client_id,
      notes: result.data.notes,
    })
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('appointments.newAppointment')}</h2>
          <button
            onClick={handleClose}
            aria-label={t('editModal.close')}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('appointments.service')} *
            </label>
            <select
              value={serviceId ?? ''}
              onChange={(e) => {
                setServiceId(e.target.value ? Number(e.target.value) : null)
                setSelectedSlot(null)
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{t('appointments.selectService')}</option>
              {services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name} ({svc.duration_minutes} {t('appointmentServices.min')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('appointments.instructor')} *
            </label>
            <select
              value={instructorId ?? ''}
              onChange={(e) => {
                setInstructorId(e.target.value ? Number(e.target.value) : null)
                setSelectedSlot(null)
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{t('appointments.selectInstructor')}</option>
              {instructors.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('appointments.date')} *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                setSelectedSlot(null)
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {serviceId !== null && instructorId !== null && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('appointments.availableSlots')}
              </label>
              {slotsLoading ? (
                <p className="text-xs text-gray-400">{t('common.loading')}</p>
              ) : slots.length === 0 ? (
                <p className="text-xs text-gray-400">{t('appointments.noSlots')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.starts_at}
                      type="button"
                      onClick={() => setSelectedSlot(slot.starts_at)}
                      className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                        selectedSlot === slot.starts_at
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {format(new Date(slot.starts_at), 'HH:mm')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('appointments.client')} *
            </label>
            <input
              type="text"
              value={selectedClientId ? selectedClientLabel : clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value)
                setSelectedClientLabel(e.target.value)
                setSelectedClientId(null)
              }}
              placeholder={t('appointments.searchClient')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {clientSearch.length >= 2 && !selectedClientId && (
              <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
                {clients.length === 0 ? (
                  <p className="text-xs text-gray-400 px-3 py-2">
                    {t('appointments.noClientsFound')}
                  </p>
                ) : (
                  clients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setSelectedClientId(client.id)
                        setSelectedClientLabel(client.full_name)
                        setClientSearch(client.full_name)
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium text-gray-800">{client.full_name}</div>
                      <div className="text-xs text-gray-500">{client.email}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('appointments.notes')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('appointments.notesPlaceholder')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {(validationError || apiError) && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {validationError ?? apiError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={bookMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {bookMutation.isPending ? t('appointments.booking') : t('appointments.confirmBooking')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
