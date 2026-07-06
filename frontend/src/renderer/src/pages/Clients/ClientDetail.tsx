import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ChevronLeft } from 'lucide-react'
import { clientsApi } from '../../api/clients'
import { membershipTypesApi, membershipsApi } from '../../api/memberships'
import { billingApi } from '../../api/billing'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { ErrorMessage } from '../../components/ErrorMessage'
import { PageHeader } from '../../components/PageHeader'
import type { ApiError } from '../../api/client'

export function ClientDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const clientId = Number(id)

  const [activeTab, setActiveTab] = useState<'bookings' | 'memberships'>('bookings')
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [cancelSubscriptionConfirm, setCancelSubscriptionConfirm] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignTypeId, setAssignTypeId] = useState<number | ''>('')
  const [assignStartDate, setAssignStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [assignError, setAssignError] = useState<string | null>(null)

  const { data: client, isLoading: clientLoading, error: clientError } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.get(clientId),
  })

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['client-bookings', clientId],
    queryFn: () => clientsApi.bookings(clientId),
    enabled: activeTab === 'bookings',
  })

  const { data: memberships, isLoading: membershipsLoading } = useQuery({
    queryKey: ['client-memberships', clientId],
    queryFn: () => clientsApi.memberships(clientId),
    enabled: activeTab === 'memberships',
  })

  const { data: membershipTypes } = useQuery({
    queryKey: ['membership-types'],
    queryFn: () => membershipTypesApi.list(),
    enabled: showAssignModal,
  })

  const { data: subscriptionData } = useQuery({
    queryKey: ['client-subscription', clientId],
    queryFn: () => billingApi.getSubscription(clientId),
    enabled: activeTab === 'memberships',
  })

  const cancelSubscriptionMutation = useMutation({
    mutationFn: () => billingApi.cancelSubscription(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-subscription', clientId] })
      setCancelSubscriptionConfirm(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { full_name: string; phone?: string }) => clientsApi.update(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      setEditing(false)
    },
  })

  const assignMutation = useMutation({
    mutationFn: (data: { client_id: number; membership_type_id: number; starts_at: string }) =>
      membershipsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-memberships', clientId] })
      setShowAssignModal(false)
      setAssignError(null)
    },
    onError: (err: ApiError) => {
      setAssignError(err.message ?? t('clientDetail.failedAssign'))
    },
  })

  const startEditing = () => {
    if (client) {
      setEditName(client.full_name)
      setEditPhone(client.phone ?? '')
      setEditing(true)
    }
  }

  const handleSave = () => {
    updateMutation.mutate({ full_name: editName, phone: editPhone || undefined })
  }

  const handleAssign = () => {
    if (!assignTypeId) {
      setAssignError(t('clientDetail.assignError'))
      return
    }
    assignMutation.mutate({
      client_id: clientId,
      membership_type_id: Number(assignTypeId),
      starts_at: assignStartDate,
    })
  }

  if (clientLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  if (clientError) return <ErrorMessage code={(clientError as ApiError).code} message={(clientError as ApiError).message} />
  if (!client) return null

  return (
    <div>
      <PageHeader
        title={client.full_name}
        subtitle={client.email}
        action={
          <button
            onClick={() => navigate(-1)}
            aria-label={t('common.back')}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        }
      />

      {/* Client Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientDetail.editName')}</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientDetail.editPhone')}</label>
              <input
                type="text"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {updateMutation.isPending ? t('clientDetail.saving') : t('clientDetail.save')}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                {t('clientDetail.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm text-gray-600"><span className="font-medium">{t('clientDetail.email')}:</span> {client.email}</p>
              <p className="text-sm text-gray-600"><span className="font-medium">{t('clientDetail.phone')}:</span> {client.phone ?? '—'}</p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">{t('clientDetail.status')}:</span>{' '}
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  client.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {client.is_active ? t('clientDetail.active') : t('clientDetail.inactive')}
                </span>
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">{t('clientDetail.joined')}:</span> {format(new Date(client.created_at), 'MMM d, yyyy')}
              </p>
            </div>
            <button
              onClick={startEditing}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {t('clientDetail.edit')}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'bookings'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('clientDetail.bookingsTab')}
          </button>
          <button
            onClick={() => setActiveTab('memberships')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'memberships'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('clientDetail.membershipsTab')}
          </button>
        </div>
      </div>

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <div className="bg-white rounded-lg border border-gray-200">
          {bookingsLoading ? (
            <div className="p-8 flex justify-center"><LoadingSpinner /></div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('clientDetail.classId')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('clientDetail.bookingStatus')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('clientDetail.creditDeducted')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(bookings ?? []).map((booking: { id: number; scheduled_class_id: number; status: string; credit_deducted: boolean }) => (
                  <tr key={booking.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">#{booking.scheduled_class_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{booking.status}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{booking.credit_deducted ? t('common.yes') : t('common.no')}</td>
                  </tr>
                ))}
                {(!bookings || bookings.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">{t('clientDetail.noBookings')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Memberships Tab */}
      {activeTab === 'memberships' && (
        <div>
          {/* Stripe Subscription Status */}
          {subscriptionData?.subscription && (() => {
            const sub = subscriptionData.subscription
            const statusColorMap: Record<string, string> = {
              active: 'bg-green-100 text-green-700',
              past_due: 'bg-amber-100 text-amber-700',
              payment_overdue: 'bg-amber-100 text-amber-700',
              canceled: 'bg-gray-100 text-gray-600',
              incomplete: 'bg-gray-100 text-gray-600',
              unpaid: 'bg-amber-100 text-amber-700',
            }
            const badgeClass = statusColorMap[sub.status] ?? 'bg-gray-100 text-gray-600'
            return (
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">{t('billing.subscription')}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
                      {t(`billing.status.${sub.status}`, { defaultValue: sub.status })}
                    </span>
                    {sub.current_period_end && (
                      <span className="text-xs text-gray-500">
                        {format(new Date(sub.current_period_end), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                  {cancelSubscriptionConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{t('billing.cancelConfirm')}</span>
                      <button
                        onClick={() => cancelSubscriptionMutation.mutate()}
                        disabled={cancelSubscriptionMutation.isPending}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {cancelSubscriptionMutation.isPending ? t('common.saving') : t('common.yes')}
                      </button>
                      <button
                        onClick={() => setCancelSubscriptionConfirm(false)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCancelSubscriptionConfirm(true)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700 transition-colors"
                    >
                      {t('billing.cancelSubscription')}
                    </button>
                  )}
                </div>
              </div>
            )
          })()}

          <div className="flex justify-end mb-3">
            <button
              onClick={() => setShowAssignModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {t('clientDetail.assignMembership')}
            </button>
          </div>
          <div className="bg-white rounded-lg border border-gray-200">
            {membershipsLoading ? (
              <div className="p-8 flex justify-center"><LoadingSpinner /></div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('clientDetail.typeId')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('clientDetail.membershipStatus')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('clientDetail.credits')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('clientDetail.starts')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('clientDetail.expires')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(memberships ?? []).map((m: { id: number; membership_type_id: number; status: string; credits_remaining?: number; starts_at: string; expires_at?: string }) => (
                    <tr key={m.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">#{m.membership_type_id}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{m.status}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{m.credits_remaining ?? '∞'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{format(new Date(m.starts_at), 'MMM d, yyyy')}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {m.expires_at ? format(new Date(m.expires_at), 'MMM d, yyyy') : '—'}
                      </td>
                    </tr>
                  ))}
                  {(!memberships || memberships.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">{t('clientDetail.noMemberships')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Assign Membership Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => { setShowAssignModal(false); setAssignError(null) }}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('clientDetail.assignMembershipTitle')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientDetail.membershipType')}</label>
                <select
                  value={assignTypeId}
                  onChange={(e) => setAssignTypeId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t('clientDetail.selectType')}</option>
                  {(membershipTypes ?? []).map((t: { id: number; name: string }) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientDetail.startDate')}</label>
                <input
                  type="date"
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {assignError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{assignError}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleAssign}
                  disabled={assignMutation.isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {assignMutation.isPending ? t('clientDetail.assigning') : t('clientDetail.assign')}
                </button>
                <button
                  onClick={() => { setShowAssignModal(false); setAssignError(null) }}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  {t('clientDetail.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
