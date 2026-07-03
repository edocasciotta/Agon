import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { membershipTypesApi, membershipsApi } from '../api/memberships'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import type { ApiError } from '../api/client'
import type { MembershipType } from '../types'
import { membershipTypeSchema } from '../lib/formSchemas'

export function MembershipsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'recurring' as 'recurring' | 'credit_pack',
    price: '',
    currency: 'USD',
    credits_included: '',
    unlimited: false,
  })

  const { data: membershipTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['membership-types'],
    queryFn: () => membershipTypesApi.list(),
  })

  const { data: memberships, isLoading: membershipsLoading } = useQuery({
    queryKey: ['memberships', statusFilter],
    queryFn: () => membershipsApi.list(),
  })

  const createTypeMutation = useMutation({
    mutationFn: (data: Partial<MembershipType>) => membershipTypesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-types'] })
      setShowCreateModal(false)
      setCreateError(null)
    },
    onError: (err: ApiError) => {
      setCreateError(err.message ?? t('memberships.failedCreate'))
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
    })
  }

  const filteredMemberships = statusFilter
    ? (memberships ?? []).filter((m: { status: string }) => m.status === statusFilter)
    : (memberships ?? [])

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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.isActive')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {membershipTypes.map((mt) => (
                  <tr key={mt.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{mt.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {mt.type === 'recurring' ? t('memberships.recurring') : t('memberships.creditPack')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{mt.currency} {mt.price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {mt.unlimited ? t('memberships.unlimited') : (mt.credits_included ?? '—')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        mt.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {mt.is_active ? t('memberships.yes') : t('memberships.no')}
                      </span>
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
            onChange={(e) => setStatusFilter(e.target.value)}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.clientId')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.typeId')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.status')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('memberships.creditsRemaining')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredMemberships.map((m: { id: number; client_id: number; membership_type_id: number; status: string; credits_remaining?: number }) => (
                  <tr key={m.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">#{m.client_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">#{m.membership_type_id}</td>
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
    </div>
  )
}
