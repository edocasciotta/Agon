import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ChevronLeft, User } from 'lucide-react'
import { clientsApi } from '../../api/clients'
import { membershipTypesApi, membershipsApi } from '../../api/memberships'
import { billingApi } from '../../api/billing'
import { tagsApi } from '../../api/tags'
import { smsApi } from '../../api/sms'
import { calendarSyncApi } from '../../api/calendarSync'
import { waiversApi } from '../../api/waivers'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { ErrorMessage } from '../../components/ErrorMessage'
import { PageHeader } from '../../components/PageHeader'
import { PhotoUpload } from '../../components/PhotoUpload'
import { resolveApiError } from '../../lib/errorMessages'
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
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [showSmsForm, setShowSmsForm] = useState(false)
  const [smsBody, setSmsBody] = useState('')
  const [smsMsg, setSmsMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [feedUrlCopied, setFeedUrlCopied] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

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

  const { data: clientTags } = useQuery({
    queryKey: ['client-tags', clientId],
    queryFn: () => tagsApi.listClientTags(clientId),
  })

  const { data: allTags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  })

  const {
    data: calendarSync,
    isLoading: calendarSyncLoading,
    error: calendarSyncError,
  } = useQuery({
    queryKey: ['client-calendar-sync', clientId],
    queryFn: () => calendarSyncApi.get(clientId),
  })

  const {
    data: clientWaivers,
    isLoading: clientWaiversLoading,
    error: clientWaiversError,
  } = useQuery({
    queryKey: ['client-waivers', clientId],
    queryFn: () => waiversApi.listForClient(clientId),
  })

  const assignTagMutation = useMutation({
    mutationFn: (tagId: number) => tagsApi.assignClientTag(clientId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-tags', clientId] })
      setShowTagDropdown(false)
    },
  })

  const removeTagMutation = useMutation({
    mutationFn: (tagId: number) => tagsApi.removeClientTag(clientId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-tags', clientId] })
    },
  })

  const availableTags = (allTags ?? []).filter(
    (tag) => !(clientTags ?? []).some((ct) => ct.tag_id === tag.id)
  )

  const regenerateCalendarSyncMutation = useMutation({
    mutationFn: () => calendarSyncApi.regenerate(clientId),
    onSuccess: (data) => {
      queryClient.setQueryData(['client-calendar-sync', clientId], data)
      setShowRegenerateConfirm(false)
    },
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

  const uploadPhotoMutation = useMutation({
    mutationFn: (file: File) => clientsApi.uploadPhoto(clientId, file),
    onSuccess: (updated) => {
      // Apply the server's response directly (same pattern as calendar-sync regenerate above)
      // rather than invalidating, so the new photo appears immediately without a refetch race.
      queryClient.setQueryData(['client', clientId], updated)
      setPhotoError(null)
    },
    onError: (err) => setPhotoError(resolveApiError(err, t('photoUpload.uploadError'))),
  })

  const sendSmsMutation = useMutation({
    mutationFn: (body: string) => smsApi.send(clientId, body),
    onSuccess: () => {
      setSmsMsg({ text: t('sms.sentSuccess'), ok: true })
      setSmsBody('')
      setTimeout(() => setSmsMsg(null), 4000)
    },
    onError: (err: ApiError) => {
      setSmsMsg({ text: err.message ?? t('sms.failedSend'), ok: false })
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

  const handleSendSms = () => {
    if (!smsBody.trim()) return
    sendSmsMutation.mutate(smsBody)
  }

  const handleCopyFeedUrl = () => {
    if (!calendarSync?.feed_url) return
    navigator.clipboard.writeText(calendarSync.feed_url)
    setFeedUrlCopied(true)
    setTimeout(() => setFeedUrlCopied(false), 2000)
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
        <div className="mb-4">
          <PhotoUpload
            photoUrl={client.photo_url}
            fallback={
              <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                <User className="w-8 h-8" />
              </div>
            }
            onUpload={(file) => uploadPhotoMutation.mutate(file)}
            isUploading={uploadPhotoMutation.isPending}
            size={64}
            inputId="client-photo-input"
            name={client.full_name}
          />
          {photoError && <p className="text-xs text-red-500 mt-1">{photoError}</p>}
        </div>

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
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <span><span className="font-medium">{t('clientDetail.phone')}:</span> {client.phone ?? '—'}</span>
                {client.phone && (
                  <button
                    onClick={() => setShowSmsForm((v) => !v)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {t('sms.sendSms')}
                  </button>
                )}
              </p>
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

        {/* Send SMS inline form */}
        {showSmsForm && client.phone && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              {t('sms.sendSmsTitle', { name: client.full_name })}
            </label>
            <textarea
              rows={3}
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
              placeholder={t('sms.messagePlaceholder')}
              className="w-full max-w-lg px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {smsMsg && (
              <div className={`rounded-md p-3 text-sm max-w-lg ${smsMsg.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {smsMsg.text}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSendSms}
                disabled={sendSmsMutation.isPending || !smsBody.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {sendSmsMutation.isPending ? t('sms.sending') : t('sms.send')}
              </button>
              <button
                onClick={() => { setShowSmsForm(false); setSmsMsg(null) }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                {t('clientDetail.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">{t('clientDetail.tags')}</h3>
          <div className="relative">
            <button
              onClick={() => setShowTagDropdown((v) => !v)}
              disabled={availableTags.length === 0}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('clientDetail.addTag')}
            </button>
            {showTagDropdown && availableTags.length > 0 && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 w-48 max-h-48 overflow-y-auto">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => assignTagMutation.mutate(tag.id)}
                    disabled={assignTagMutation.isPending}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(clientTags ?? []).length === 0 ? (
            <p className="text-xs text-gray-400">{t('clientDetail.noTags')}</p>
          ) : (
            (clientTags ?? []).map((ct) => (
              <span
                key={ct.id}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: ct.tag_color }}
              >
                {ct.tag_name}
                <button
                  onClick={() => removeTagMutation.mutate(ct.tag_id)}
                  disabled={removeTagMutation.isPending}
                  className="ml-0.5 hover:opacity-75 transition-opacity"
                  aria-label={t('clientDetail.removeTag')}
                >
                  &times;
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Calendar Sync */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">{t('calendarSync.title')}</h3>
        <p className="text-xs text-gray-500 mb-3">{t('calendarSync.description')}</p>

        {calendarSyncLoading ? (
          <div className="flex justify-center py-2"><LoadingSpinner /></div>
        ) : calendarSyncError ? (
          <ErrorMessage
            code={(calendarSyncError as ApiError).code}
            message={(calendarSyncError as ApiError).message ?? t('calendarSync.failedLoad')}
          />
        ) : calendarSync ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={calendarSync.feed_url}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleCopyFeedUrl}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors whitespace-nowrap"
              >
                {feedUrlCopied ? t('calendarSync.copied') : t('calendarSync.copy')}
              </button>
            </div>

            {regenerateCalendarSyncMutation.isError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                {(regenerateCalendarSyncMutation.error as ApiError).message ?? t('calendarSync.failedRegenerate')}
              </div>
            )}

            {showRegenerateConfirm ? (
              <div className="rounded-md bg-indigo-50 border border-indigo-200 p-3 space-y-2">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{t('calendarSync.regenerateConfirmTitle')}</span>{' '}
                  {t('calendarSync.regenerateConfirmDesc')}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => regenerateCalendarSyncMutation.mutate()}
                    disabled={regenerateCalendarSyncMutation.isPending}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {regenerateCalendarSyncMutation.isPending
                      ? t('calendarSync.regenerating')
                      : t('calendarSync.regenerate')}
                  </button>
                  <button
                    onClick={() => setShowRegenerateConfirm(false)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 transition-colors"
                  >
                    {t('clientDetail.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowRegenerateConfirm(true)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                {t('calendarSync.regenerate')}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Waivers */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">{t('waivers.clientSectionTitle')}</h3>
        <p className="text-xs text-gray-500 mb-3">{t('waivers.clientSectionDescription')}</p>

        {clientWaiversLoading ? (
          <div className="flex justify-center py-2">
            <LoadingSpinner />
          </div>
        ) : clientWaiversError ? (
          <ErrorMessage
            code={(clientWaiversError as ApiError).code}
            message={(clientWaiversError as ApiError).message ?? t('waivers.failedLoad')}
          />
        ) : !clientWaivers || clientWaivers.length === 0 ? (
          <p className="text-xs text-gray-400">{t('waivers.noWaiversForClient')}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {clientWaivers.map((waiver) => {
              const blocksBooking = waiver.requires_before_booking && !waiver.is_signed
              return (
                <li key={waiver.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{waiver.title}</p>
                    {waiver.is_signed && waiver.signed_at ? (
                      <p className="text-xs text-gray-500">
                        {t('waivers.signedOn', {
                          date: format(new Date(waiver.signed_at), 'MMM d, yyyy'),
                        })}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">{t('waivers.notSigned')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {blocksBooking && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        {t('waivers.blocksBookingBadge')}
                      </span>
                    )}
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        waiver.is_signed
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {waiver.is_signed ? t('waivers.signed') : t('waivers.unsigned')}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.rolloverCredits')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('clientDetail.starts')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('clientDetail.expires')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(memberships ?? []).map((m: { id: number; membership_type_id: number; status: string; credits_remaining?: number; rollover_credits?: number; starts_at: string; expires_at?: string }) => (
                    <tr key={m.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">#{m.membership_type_id}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{m.status}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{m.credits_remaining ?? '∞'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{m.rollover_credits ?? 0}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{format(new Date(m.starts_at), 'MMM d, yyyy')}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {m.expires_at ? format(new Date(m.expires_at), 'MMM d, yyyy') : '—'}
                      </td>
                    </tr>
                  ))}
                  {(!memberships || memberships.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">{t('clientDetail.noMemberships')}</td>
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
