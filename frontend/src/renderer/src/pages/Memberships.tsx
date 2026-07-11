import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { membershipTypesApi, membershipsApi } from '../api/memberships'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Pagination } from '../components/Pagination'
import type { Membership, MembershipType } from '../types'
import { membershipTypeSchema } from '../lib/formSchemas'
import { resolveApiError } from '../lib/errorMessages'

const MEMBERSHIPS_PAGE_SIZE = 50

const EMPTY_CREATE = {
  name: '',
  type: 'recurring' as 'recurring' | 'credit_pack',
  price: '',
  currency: 'USD',
  credits_included: '',
  unlimited: false,
  sellable_online: false,
  late_cancel_fee_override: '',
  no_show_fee_override: '',
  rollover_enabled: false,
  max_rollover_credits: '',
  is_intro_offer: false,
  intro_price: '',
  intro_validity_days: '',
}

export function MembershipsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [formData, setFormData] = useState(EMPTY_CREATE)

  const [editingType, setEditingType] = useState<MembershipType | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: '',
    price: '',
    sellable_online: false,
    is_active: true,
    late_cancel_fee_override: '',
    no_show_fee_override: '',
    rollover_enabled: false,
    max_rollover_credits: '',
    is_intro_offer: false,
    intro_price: '',
    intro_validity_days: '',
  })
  const [editError, setEditError] = useState<string | null>(null)

  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  // Include inactive so deactivated plans remain visible and manageable
  const { data: membershipTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['membership-types', 'include-inactive'],
    queryFn: () => membershipTypesApi.list(true),
  })

  const { data: membershipsPage, isLoading: membershipsLoading } = useQuery({
    queryKey: ['memberships', page, statusFilter],
    queryFn: () =>
      membershipsApi.list(undefined, page, MEMBERSHIPS_PAGE_SIZE, statusFilter || undefined),
  })

  const createTypeMutation = useMutation({
    mutationFn: (data: Partial<MembershipType>) => membershipTypesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-types'] })
      setShowCreateModal(false)
      setCreateError(null)
      setFormData(EMPTY_CREATE)
    },
    onError: (err: unknown) => {
      setCreateError(resolveApiError(err, t('memberships.failedCreate')))
    },
  })

  const editTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MembershipType> }) =>
      membershipTypesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-types'] })
      setEditingType(null)
      setEditError(null)
    },
    onError: (err: unknown) => {
      setEditError(resolveApiError(err, t('memberships.failedEdit')))
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => membershipTypesApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-types'] })
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: (id: number) => membershipTypesApi.reactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-types'] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => membershipTypesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-types'] })
      setConfirmRemoveId(null)
      setRemoveError(null)
    },
    onError: (err: unknown) => {
      setRemoveError(resolveApiError(err, t('memberships.failedRemove')))
    },
  })

  const handleCreate = () => {
    const zodResult = membershipTypeSchema.safeParse(formData)
    if (!zodResult.success) {
      setCreateError(zodResult.error.errors[0].message)
      return
    }
    createTypeMutation.mutate({
      name: formData.name,
      type: formData.type,
      price: Number(formData.price),
      currency: formData.currency,
      credits_included: formData.credits_included ? Number(formData.credits_included) : undefined,
      unlimited: formData.unlimited,
      sellable_online: formData.sellable_online,
      late_cancel_fee_override: formData.late_cancel_fee_override ? Number(formData.late_cancel_fee_override) : null,
      no_show_fee_override: formData.no_show_fee_override ? Number(formData.no_show_fee_override) : null,
      rollover_enabled: formData.rollover_enabled,
      max_rollover_credits: formData.max_rollover_credits ? Number(formData.max_rollover_credits) : null,
      is_intro_offer: formData.is_intro_offer,
      intro_price: formData.intro_price ? Number(formData.intro_price) : null,
      intro_validity_days: formData.intro_validity_days ? Number(formData.intro_validity_days) : null,
    })
  }

  const openEdit = (mt: MembershipType) => {
    setEditingType(mt)
    setEditFormData({
      name: mt.name,
      price: String(mt.price),
      sellable_online: mt.sellable_online,
      is_active: mt.is_active,
      late_cancel_fee_override: mt.late_cancel_fee_override != null ? String(mt.late_cancel_fee_override) : '',
      no_show_fee_override: mt.no_show_fee_override != null ? String(mt.no_show_fee_override) : '',
      rollover_enabled: mt.rollover_enabled,
      max_rollover_credits: mt.max_rollover_credits != null ? String(mt.max_rollover_credits) : '',
      is_intro_offer: mt.is_intro_offer,
      intro_price: mt.intro_price != null ? String(mt.intro_price) : '',
      intro_validity_days: mt.intro_validity_days != null ? String(mt.intro_validity_days) : '',
    })
    setEditError(null)
  }

  const handleEdit = () => {
    if (!editingType) return
    if (!editFormData.name.trim()) {
      setEditError(t('memberships.nameRequired'))
      return
    }
    editTypeMutation.mutate({
      id: editingType.id,
      data: {
        name: editFormData.name,
        price: Number(editFormData.price),
        sellable_online: editFormData.sellable_online,
        is_active: editFormData.is_active,
        late_cancel_fee_override: editFormData.late_cancel_fee_override ? Number(editFormData.late_cancel_fee_override) : null,
        no_show_fee_override: editFormData.no_show_fee_override ? Number(editFormData.no_show_fee_override) : null,
        rollover_enabled: editFormData.rollover_enabled,
        max_rollover_credits: editFormData.max_rollover_credits ? Number(editFormData.max_rollover_credits) : null,
        is_intro_offer: editFormData.is_intro_offer,
        intro_price: editFormData.intro_price ? Number(editFormData.intro_price) : null,
        intro_validity_days: editFormData.intro_validity_days ? Number(editFormData.intro_validity_days) : null,
      },
    })
  }

  const filteredMemberships = membershipsPage?.items ?? []

  const confirmRemoveType = membershipTypes?.find((mt) => mt.id === confirmRemoveId)

  return (
    <div>
      <PageHeader title={t('memberships.title')} />

      {/* Membership Types */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">{t('memberships.membershipTypes')}</h2>
          {membershipTypes && membershipTypes.length > 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {t('memberships.createType')}
            </button>
          )}
        </div>
        {typesLoading ? (
          <LoadingSpinner />
        ) : !membershipTypes || membershipTypes.length === 0 ? (
          <EmptyState
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
              </svg>
            }
            title={t('memberships.noMembershipTypes')}
            description={t('memberships.emptyDescTypes')}
            actionLabel={t('memberships.createType')}
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.name')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.type')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.price')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.credits')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.sellableOnline')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.isActive')}</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {membershipTypes.map((mt) => (
                  <tr key={mt.id} className={mt.is_active ? '' : 'bg-gray-50 opacity-60'}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <span className="flex items-center gap-2">
                        {mt.name}
                        {mt.is_intro_offer && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-100 text-amber-700">
                            {t('memberships.introOfferBadge')}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {mt.type === 'recurring' ? t('memberships.recurring') : t('memberships.creditPack')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{mt.currency} {mt.price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {mt.unlimited ? t('memberships.unlimited') : (mt.credits_included ?? '—')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        mt.sellable_online ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {mt.sellable_online ? t('memberships.yes') : t('memberships.no')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        mt.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {mt.is_active ? t('memberships.yes') : t('memberships.no')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(mt)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          {t('common.edit')}
                        </button>
                        {mt.is_active ? (
                          <button
                            onClick={() => deactivateMutation.mutate(mt.id)}
                            disabled={deactivateMutation.isPending}
                            className="text-xs text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50"
                          >
                            {t('memberships.deactivate')}
                          </button>
                        ) : (
                          <button
                            onClick={() => reactivateMutation.mutate(mt.id)}
                            disabled={reactivateMutation.isPending}
                            className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                          >
                            {t('memberships.reactivate')}
                          </button>
                        )}
                        <button
                          onClick={() => { setConfirmRemoveId(mt.id); setRemoveError(null) }}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          {t('memberships.remove')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* All Memberships */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">{t('memberships.allMemberships')}</h2>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">{t('memberships.allStatuses')}</option>
            <option value="active">{t('memberships.active')}</option>
            <option value="expired">{t('memberships.expired')}</option>
            <option value="cancelled">{t('memberships.cancelled')}</option>
          </select>
        </div>
        {membershipsLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.member')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.type')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.status')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.creditsRemaining')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredMemberships.map((m: Membership) => (
                  <tr
                    key={m.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/clients/${m.client_id}`)}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {m.client_name ?? `#${m.client_id}`}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {m.membership_type_name ?? `#${m.membership_type_id}`}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{m.status}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{m.credits_remaining ?? '∞'}</td>
                  </tr>
                ))}
                {filteredMemberships.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">{t('memberships.noMemberships')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {membershipsPage && (
          <Pagination
            page={membershipsPage.page}
            pageSize={membershipsPage.page_size}
            total={membershipsPage.total}
            onPage={setPage}
          />
        )}
      </section>

      {/* Create Type Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => { setShowCreateModal(false); setCreateError(null) }}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('memberships.createMembershipType')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.membershipName')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('memberships.membershipNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.membershipType')}</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'recurring' | 'credit_pack' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="recurring">{t('memberships.recurring')}</option>
                  <option value="credit_pack">{t('memberships.creditPack')}</option>
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.price')}</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t('memberships.pricePlaceholder')}
                  />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.currency')}</label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t('memberships.currencyPlaceholder')}
                  />
                </div>
              </div>
              {formData.type === 'credit_pack' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.creditsIncluded')}</label>
                  <input
                    type="number"
                    value={formData.credits_included}
                    onChange={(e) => setFormData({ ...formData, credits_included: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t('memberships.creditsPlaceholder')}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="unlimited"
                  checked={formData.unlimited}
                  onChange={(e) => setFormData({ ...formData, unlimited: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="unlimited" className="text-sm text-gray-700">{t('memberships.unlimitedClasses')}</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sellable_online"
                  checked={formData.sellable_online}
                  onChange={(e) => setFormData({ ...formData, sellable_online: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="sellable_online" className="text-sm text-gray-700">{t('memberships.sellableOnlineLabel')}</label>
              </div>
              {/* Intro Offer */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="is_intro_offer"
                    checked={formData.is_intro_offer}
                    onChange={(e) => setFormData({ ...formData, is_intro_offer: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="is_intro_offer" className="text-sm text-gray-700">{t('memberships.introOffer')}</label>
                </div>
                {formData.is_intro_offer && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.introPrice')}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.intro_price}
                        onChange={(e) => setFormData({ ...formData, intro_price: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={t('memberships.pricePlaceholder')}
                      />
                      <p className="text-xs text-gray-500 mt-1">{t('memberships.introPriceHint')}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.introValidityDays')}</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.intro_validity_days}
                        onChange={(e) => setFormData({ ...formData, intro_validity_days: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="30"
                      />
                    </div>
                  </div>
                )}
              </div>
              {/* Rollover Credits — only for non-unlimited memberships */}
              {!formData.unlimited && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="rollover_enabled"
                      checked={formData.rollover_enabled}
                      onChange={(e) => setFormData({ ...formData, rollover_enabled: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label htmlFor="rollover_enabled" className="text-sm text-gray-700">{t('memberships.rolloverEnabled')}</label>
                  </div>
                  {formData.rollover_enabled && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.maxRolloverCredits')}</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.max_rollover_credits}
                        onChange={(e) => setFormData({ ...formData, max_rollover_credits: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={t('memberships.rolloverHint')}
                      />
                      <p className="text-xs text-gray-500 mt-1">{t('memberships.rolloverHint')}</p>
                    </div>
                  )}
                </div>
              )}
              {/* Fee Overrides */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('memberships.sectionFees')}</h3>
                <p className="text-xs text-gray-500 mb-3">{t('memberships.feeOverrideHint')}</p>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.lateCancelFeeOverride')}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.late_cancel_fee_override}
                      onChange={(e) => setFormData({ ...formData, late_cancel_fee_override: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.noShowFeeOverride')}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.no_show_fee_override}
                      onChange={(e) => setFormData({ ...formData, no_show_fee_override: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              {createError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{createError}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={createTypeMutation.isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {createTypeMutation.isPending ? t('memberships.creating') : t('memberships.create')}
                </button>
                <button
                  onClick={() => { setShowCreateModal(false); setCreateError(null) }}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  {t('memberships.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Type Modal */}
      {editingType && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => { setEditingType(null); setEditError(null) }}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('memberships.editMembershipType')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.membershipName')}</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.price')}</label>
                <input
                  type="number"
                  value={editFormData.price}
                  onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_sellable_online"
                  checked={editFormData.sellable_online}
                  onChange={(e) => setEditFormData({ ...editFormData, sellable_online: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="edit_sellable_online" className="text-sm text-gray-700">{t('memberships.sellableOnlineLabel')}</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={editFormData.is_active}
                  onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="edit_is_active" className="text-sm text-gray-700">{t('memberships.isActive')}</label>
              </div>
              {/* Intro Offer */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="edit_is_intro_offer"
                    checked={editFormData.is_intro_offer}
                    onChange={(e) => setEditFormData({ ...editFormData, is_intro_offer: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="edit_is_intro_offer" className="text-sm text-gray-700">{t('memberships.introOffer')}</label>
                </div>
                {editFormData.is_intro_offer && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.introPrice')}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editFormData.intro_price}
                        onChange={(e) => setEditFormData({ ...editFormData, intro_price: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={t('memberships.pricePlaceholder')}
                      />
                      <p className="text-xs text-gray-500 mt-1">{t('memberships.introPriceHint')}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.introValidityDays')}</label>
                      <input
                        type="number"
                        min="1"
                        value={editFormData.intro_validity_days}
                        onChange={(e) => setEditFormData({ ...editFormData, intro_validity_days: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="30"
                      />
                    </div>
                  </div>
                )}
              </div>
              {/* Rollover Credits — only for non-unlimited memberships */}
              {editingType && !editingType.unlimited && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="edit_rollover_enabled"
                      checked={editFormData.rollover_enabled}
                      onChange={(e) => setEditFormData({ ...editFormData, rollover_enabled: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label htmlFor="edit_rollover_enabled" className="text-sm text-gray-700">{t('memberships.rolloverEnabled')}</label>
                  </div>
                  {editFormData.rollover_enabled && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.maxRolloverCredits')}</label>
                      <input
                        type="number"
                        min="0"
                        value={editFormData.max_rollover_credits}
                        onChange={(e) => setEditFormData({ ...editFormData, max_rollover_credits: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={t('memberships.rolloverHint')}
                      />
                      <p className="text-xs text-gray-500 mt-1">{t('memberships.rolloverHint')}</p>
                    </div>
                  )}
                </div>
              )}
              {/* Fee Overrides */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('memberships.sectionFees')}</h3>
                <p className="text-xs text-gray-500 mb-3">{t('memberships.feeOverrideHint')}</p>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.lateCancelFeeOverride')}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editFormData.late_cancel_fee_override}
                      onChange={(e) => setEditFormData({ ...editFormData, late_cancel_fee_override: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('memberships.noShowFeeOverride')}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editFormData.no_show_fee_override}
                      onChange={(e) => setEditFormData({ ...editFormData, no_show_fee_override: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              {editError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{editError}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  disabled={editTypeMutation.isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {editTypeMutation.isPending ? t('common.saving') : t('common.save')}
                </button>
                <button
                  onClick={() => { setEditingType(null); setEditError(null) }}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      {confirmRemoveId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => { setConfirmRemoveId(null); setRemoveError(null) }}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-2">{t('memberships.confirmRemoveTitle')}</h2>
            {confirmRemoveType && (
              <p className="text-sm font-medium text-indigo-700 mb-3">"{confirmRemoveType.name}"</p>
            )}
            <p className="text-sm text-gray-600 mb-4">{t('memberships.confirmRemoveDesc')}</p>
            {removeError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200 mb-4">{removeError}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => removeMutation.mutate(confirmRemoveId)}
                disabled={removeMutation.isPending}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {removeMutation.isPending ? t('common.loading') : t('memberships.remove')}
              </button>
              <button
                onClick={() => { setConfirmRemoveId(null); setRemoveError(null) }}
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
