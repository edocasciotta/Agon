import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { appointmentsApi } from '../../api/appointments'
import { appointmentServicesApi } from '../../api/appointmentServices'
import { instructorsApi } from '../../api/instructors'
import { clientsApi } from '../../api/clients'
import { useAuthStore } from '../../store/authStore'
import type { Appointment, AppointmentStatus } from '../../types'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/EmptyState'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { BookAppointmentModal } from '../../components/BookAppointmentModal'
import { resolveApiError } from '../../lib/errorMessages'

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-indigo-100 text-indigo-700',
  no_show: 'bg-amber-100 text-amber-700',
}

export function UpcomingTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isStaff = user?.role === 'manager' || user?.role === 'instructor'

  const [bookOpen, setBookOpen] = useState(false)
  const [filterInstructor, setFilterInstructor] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [upcomingOnly, setUpcomingOnly] = useState(true)
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => instructorsApi.list(),
  })

  const { data: services = [] } = useQuery({
    queryKey: ['appointment-services', true],
    queryFn: () => appointmentServicesApi.list(true),
  })

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', filterInstructor, filterStatus, upcomingOnly],
    queryFn: () =>
      appointmentsApi.list({
        instructor_id: filterInstructor ? Number(filterInstructor) : undefined,
        status: filterStatus ? (filterStatus as AppointmentStatus) : undefined,
        start_date: upcomingOnly ? format(new Date(), 'yyyy-MM-dd') : undefined,
      }),
  })

  // Client names aren't embedded in AppointmentResponse — resolve via a light
  // client cache keyed by id, fetched on demand from the same search endpoint
  // used elsewhere (mirrors ManageBookingsModal's approach for roster names).
  const clientIds = Array.from(new Set(appointments.map((a) => a.client_id)))
  const { data: clientNames = {} } = useQuery({
    queryKey: ['appointment-client-names', clientIds],
    queryFn: async () => {
      const entries = await Promise.all(
        clientIds.map(async (id) => {
          try {
            const client = await clientsApi.get(id)
            return [id, client.full_name] as const
          } catch {
            return [id, null] as const
          }
        })
      )
      return Object.fromEntries(entries) as Record<number, string | null>
    },
    enabled: clientIds.length > 0,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => appointmentsApi.cancel(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setCancelTarget(null)
      setActionError(null)
    },
    onError: (err: unknown) => {
      setActionError(resolveApiError(err, t('appointments.cancelFailed')))
    },
  })

  const completeMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'completed' | 'no_show' }) =>
      appointmentsApi.complete(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setActionError(null)
    },
    onError: (err: unknown) => {
      setActionError(resolveApiError(err, t('appointments.completeFailed')))
    },
  })

  const serviceName = (id: number) => services.find((s) => s.id === id)?.name ?? `#${id}`
  const instructorName = (id: number) =>
    instructors.find((i) => i.id === id)?.full_name ?? `#${id}`
  const clientName = (id: number) => clientNames[id] ?? `#${id}`

  return (
    <div>
      <PageHeader
        title={t('appointments.upcomingTitle')}
        action={
          appointments.length > 0 ? (
            <button
              onClick={() => setBookOpen(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
            >
              {t('appointments.newAppointment')}
            </button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={filterInstructor}
          onChange={(e) => setFilterInstructor(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label={t('appointments.filterInstructor')}
        >
          <option value="">{t('appointments.allInstructors')}</option>
          {instructors.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.full_name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label={t('appointments.filterStatus')}
        >
          <option value="">{t('appointments.allStatuses')}</option>
          <option value="confirmed">{t('appointments.statusConfirmed')}</option>
          <option value="cancelled">{t('appointments.statusCancelled')}</option>
          <option value="completed">{t('appointments.statusCompleted')}</option>
          <option value="no_show">{t('appointments.statusNoShow')}</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={upcomingOnly}
            onChange={(e) => setUpcomingOnly(e.target.checked)}
            className="w-4 h-4"
          />
          {t('appointments.upcomingOnly')}
        </label>
      </div>

      {actionError && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {!isLoading && appointments.length === 0 && (
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
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
              />
            </svg>
          }
          title={t('appointments.noAppointments')}
          description={t('appointments.emptyDesc')}
          actionLabel={t('appointments.newAppointment')}
          onAction={() => setBookOpen(true)}
        />
      )}

      {!isLoading && appointments.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('appointments.colDateTime')}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('appointments.colService')}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('appointments.colInstructor')}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('appointments.colClient')}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('common.status')}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appointments.map((appt) => (
                <tr key={appt.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">
                    {format(new Date(appt.starts_at), 'EEE d MMM, HH:mm')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{serviceName(appt.service_id)}</td>
                  <td className="px-4 py-3 text-gray-600">{instructorName(appt.instructor_id)}</td>
                  <td className="px-4 py-3 text-gray-600">{clientName(appt.client_id)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[appt.status]}`}
                    >
                      {t(`appointments.status${appt.status === 'no_show' ? 'NoShow' : appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {appt.status === 'confirmed' && (
                      <div className="flex items-center justify-end gap-1">
                        {isStaff && (
                          <>
                            <button
                              onClick={() =>
                                completeMutation.mutate({ id: appt.id, status: 'completed' })
                              }
                              disabled={completeMutation.isPending}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
                            >
                              {t('appointments.complete')}
                            </button>
                            <button
                              onClick={() =>
                                completeMutation.mutate({ id: appt.id, status: 'no_show' })
                              }
                              disabled={completeMutation.isPending}
                              className="text-xs text-amber-600 hover:text-amber-800 font-medium px-2 py-1"
                            >
                              {t('appointments.markNoShow')}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setCancelTarget(appt)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1"
                        >
                          {t('appointments.cancel')}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BookAppointmentModal isOpen={bookOpen} onClose={() => setBookOpen(false)} />

      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
          onClick={() => setCancelTarget(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              {t('appointments.cancelConfirmTitle')}
            </h3>
            <p className="text-sm text-gray-600 mb-6">{t('appointments.cancelConfirmBody')}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                {t('appointments.cancelConfirmNo')}
              </button>
              <button
                onClick={() => cancelMutation.mutate(cancelTarget.id)}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {t('appointments.cancelConfirmYes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
