import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { classesApi } from '../api/classes'
import { classTemplatesApi } from '../api/classTemplates'
import { clientsApi } from '../api/clients'
import { bookingsApi } from '../api/bookings'
import type { RosterEntry } from '../api/bookings'
import type { ScheduledClass, ClassTemplate } from '../types'
import { resolveApiError } from '../lib/errorMessages'

interface ManageBookingsModalProps {
  isOpen: boolean
  onClose: () => void
  scheduledClass: ScheduledClass
}

export function ManageBookingsModal({
  isOpen,
  onClose,
  scheduledClass,
}: ManageBookingsModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [showClientPicker, setShowClientPicker] = useState(false)

  const { data: roster = [], isLoading: rosterLoading } = useQuery({
    queryKey: ['roster', scheduledClass.id],
    queryFn: () => classesApi.roster(scheduledClass.id),
    enabled: isOpen,
  })

  const { data: templates = [] } = useQuery({
    queryKey: ['class-templates'],
    queryFn: classTemplatesApi.list,
    enabled: isOpen,
  })

  const templateName = (templates as ClassTemplate[]).find(
    (tpl) => tpl.id === scheduledClass.template_id
  )?.name

  const { data: clientsPage } = useQuery({
    queryKey: ['clients', clientSearch, 1, 10],
    queryFn: () => clientsApi.list(clientSearch || undefined, 1, 10),
    enabled: isOpen && showClientPicker && clientSearch.length >= 2,
  })

  const clients = clientsPage?.items ?? []

  const bookedClientIds = new Set(
    (roster as RosterEntry[]).map((r) => r.client_id)
  )

  const bookMutation = useMutation({
    mutationFn: (clientId: number) =>
      bookingsApi.create({
        scheduled_class_id: scheduledClass.id,
        client_id: clientId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', scheduledClass.id] })
      setSelectedClientId(null)
      setClientSearch('')
      setShowClientPicker(false)
      setApiError(null)
    },
    onError: (err: unknown) => {
      setApiError(resolveApiError(err, t('manageBookings.bookingFailed')))
    },
  })

  const cancelBookingMutation = useMutation({
    mutationFn: (bookingId: number) => bookingsApi.cancel(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', scheduledClass.id] })
      setApiError(null)
    },
    onError: (err: unknown) => {
      setApiError(resolveApiError(err, t('manageBookings.cancelFailed')))
    },
  })

  if (!isOpen) return null

  const confirmedCount = (roster as RosterEntry[]).length
  const spotsLeft = scheduledClass.capacity - confirmedCount

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {t('manageBookings.title')}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {templateName ?? `#${scheduledClass.id}`} ·{' '}
              {format(new Date(scheduledClass.starts_at), 'EEE d MMM, HH:mm')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('editModal.close')}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4">
          {/* Capacity bar */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-600">
              {t('manageBookings.booked')}: {confirmedCount} /{' '}
              {scheduledClass.capacity}
            </span>
            <span
              className={`text-sm font-medium ${spotsLeft > 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {spotsLeft > 0
                ? t('manageBookings.spotsLeft', { count: spotsLeft })
                : t('manageBookings.full')}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-5">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(100, (confirmedCount / scheduledClass.capacity) * 100)}%`,
              }}
            />
          </div>

          {apiError && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {apiError}
            </div>
          )}

          {/* Roster list */}
          {rosterLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              {t('manageBookings.loading')}
            </div>
          ) : (roster as RosterEntry[]).length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              {t('manageBookings.noBookings')}
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {(roster as RosterEntry[]).map((entry) => (
                <div
                  key={entry.booking_id}
                  className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {entry.full_name ?? t('manageBookings.unknownClient')}
                    </div>
                    {entry.email && (
                      <div className="text-xs text-gray-500">{entry.email}</div>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      cancelBookingMutation.mutate(entry.booking_id)
                    }
                    disabled={cancelBookingMutation.isPending}
                    className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                  >
                    {t('manageBookings.removeBooking')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add booking */}
          {!showClientPicker ? (
            <button
              onClick={() => setShowClientPicker(true)}
              disabled={spotsLeft <= 0}
              className="w-full px-4 py-2.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              + {t('manageBookings.addBooking')}
            </button>
          ) : (
            <div className="border border-gray-200 rounded-lg p-3 space-y-3">
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value)
                  setSelectedClientId(null)
                }}
                placeholder={t('manageBookings.searchClient')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />

              {clientSearch.length >= 2 && clients.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {clients
                    .filter((c) => !bookedClientIds.has(c.id))
                    .map((client) => (
                      <button
                        key={client.id}
                        onClick={() => {
                          setSelectedClientId(client.id)
                          setClientSearch(client.full_name)
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          selectedClientId === client.id
                            ? 'bg-indigo-50 text-indigo-700 font-medium'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="font-medium">{client.full_name}</div>
                        <div className="text-xs text-gray-500">
                          {client.email}
                        </div>
                      </button>
                    ))}
                </div>
              )}

              {clientSearch.length >= 2 &&
                clients.filter((c) => !bookedClientIds.has(c.id)).length ===
                  0 && (
                  <div className="text-xs text-gray-400 text-center py-2">
                    {t('manageBookings.noClientsFound')}
                  </div>
                )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowClientPicker(false)
                    setClientSearch('')
                    setSelectedClientId(null)
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  {t('editModal.cancel')}
                </button>
                <button
                  onClick={() => {
                    if (selectedClientId) bookMutation.mutate(selectedClientId)
                  }}
                  disabled={!selectedClientId || bookMutation.isPending}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {bookMutation.isPending
                    ? t('manageBookings.booking')
                    : t('manageBookings.confirmBooking')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
