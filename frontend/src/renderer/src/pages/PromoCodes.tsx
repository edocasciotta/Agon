import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { promoCodesApi } from '../api/promoCodes'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import type { PromoCode } from '../types'
import { promoCodeSchema } from '../lib/formSchemas'
import { resolveApiError } from '../lib/errorMessages'

const EMPTY_FORM = {
  code: '',
  discount_type: 'percentage' as 'percentage' | 'fixed',
  discount_value: '',
  max_uses: '',
  one_per_client: true,
  valid_from: new Date().toISOString().slice(0, 10),
  valid_until: '',
  is_active: true,
}

function getStatus(promo: PromoCode): 'active' | 'inactive' | 'expired' {
  if (!promo.is_active) return 'inactive'
  if (promo.valid_until && new Date(promo.valid_until) < new Date()) return 'expired'
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
    active: t('promoCodes.active'),
    inactive: t('promoCodes.inactive'),
    expired: t('promoCodes.expired'),
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export function PromoCodesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)

  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null)
  const [editFormData, setEditFormData] = useState(EMPTY_FORM)
  const [editError, setEditError] = useState<string | null>(null)

  const [confirmDeactivateId, setConfirmDeactivateId] = useState<number | null>(null)

  const { data: promoCodes, isLoading } = useQuery({
    queryKey: ['promo-codes'],
    queryFn: () => promoCodesApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: promoCodesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] })
      setShowCreateModal(false)
      setCreateError(null)
      setFormData(EMPTY_FORM)
    },
    onError: (err: unknown) => {
      setCreateError(resolveApiError(err, t('promoCodes.failedCreate')))
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PromoCode> }) =>
      promoCodesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] })
      setEditingPromo(null)
      setEditError(null)
    },
    onError: (err: unknown) => {
      setEditError(resolveApiError(err, t('promoCodes.failedEdit')))
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => promoCodesApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] })
      setConfirmDeactivateId(null)
    },
  })

  const handleCreate = () => {
    const zodResult = promoCodeSchema.safeParse(formData)
    if (!zodResult.success) {
      setCreateError(zodResult.error.errors[0].message)
      return
    }
    createMutation.mutate({
      code: formData.code.trim().toUpperCase(),
      discount_type: formData.discount_type,
      discount_value: Number(formData.discount_value),
      max_uses: formData.max_uses ? Number(formData.max_uses) : null,
      one_per_client: formData.one_per_client,
      valid_from: new Date(formData.valid_from).toISOString(),
      valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
      is_active: formData.is_active,
    })
  }

  const openEdit = (promo: PromoCode) => {
    setEditingPromo(promo)
    setEditFormData({
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: String(promo.discount_value),
      max_uses: promo.max_uses != null ? String(promo.max_uses) : '',
      one_per_client: promo.one_per_client,
      valid_from: promo.valid_from.slice(0, 10),
      valid_until: promo.valid_until ? promo.valid_until.slice(0, 10) : '',
      is_active: promo.is_active,
    })
    setEditError(null)
  }

  const handleEdit = () => {
    if (!editingPromo) return
    const zodResult = promoCodeSchema.safeParse(editFormData)
    if (!zodResult.success) {
      setEditError(zodResult.error.errors[0].message)
      return
    }
    editMutation.mutate({
      id: editingPromo.id,
      data: {
        code: editFormData.code.trim().toUpperCase(),
        discount_type: editFormData.discount_type,
        discount_value: Number(editFormData.discount_value),
        max_uses: editFormData.max_uses ? Number(editFormData.max_uses) : null,
        one_per_client: editFormData.one_per_client,
        valid_from: new Date(editFormData.valid_from).toISOString(),
        valid_until: editFormData.valid_until
          ? new Date(editFormData.valid_until).toISOString()
          : null,
        is_active: editFormData.is_active,
      },
    })
  }

  const confirmDeactivatePromo = promoCodes?.find((p) => p.id === confirmDeactivateId)

  return (
    <div>
      <PageHeader
        title={t('promoCodes.title')}
        action={
          promoCodes && promoCodes.length > 0 ? (
            <button
              onClick={() => { setShowCreateModal(true); setCreateError(null); setFormData(EMPTY_FORM) }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {t('promoCodes.create')}
            </button>
          ) : null
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : !promoCodes || promoCodes.length === 0 ? (
        <EmptyState
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
            </svg>
          }
          title={t('promoCodes.noPromoCodes')}
          description={t('promoCodes.emptyDesc')}
          actionLabel={t('promoCodes.create')}
          onAction={() => { setShowCreateModal(true); setCreateError(null); setFormData(EMPTY_FORM) }}
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('promoCodes.code')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('promoCodes.discountType')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('promoCodes.discountValue')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('promoCodes.uses')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('promoCodes.status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('promoCodes.validFrom')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('promoCodes.validUntil')}</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {promoCodes.map((promo) => {
                const status = getStatus(promo)
                return (
                  <tr key={promo.id} className={status !== 'active' ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="px-6 py-4 text-sm font-mono font-medium text-gray-900">{promo.code}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {promo.discount_type === 'percentage' ? t('promoCodes.percentage') : t('promoCodes.fixed')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : promo.discount_value.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {promo.current_uses} / {promo.max_uses ?? t('promoCodes.unlimited')}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(promo.valid_from).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {promo.valid_until ? new Date(promo.valid_until).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(promo)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          {t('common.edit')}
                        </button>
                        {promo.is_active && (
                          <button
                            onClick={() => setConfirmDeactivateId(promo.id)}
                            className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                          >
                            {t('promoCodes.deactivate')}
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => { setShowCreateModal(false); setCreateError(null) }}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('promoCodes.create')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('promoCodes.code')}</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                  placeholder={t('promoCodes.codePlaceholder')}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('promoCodes.discountType')}</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as 'percentage' | 'fixed' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="percentage">{t('promoCodes.percentage')}</option>
                    <option value="fixed">{t('promoCodes.fixed')}</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('promoCodes.discountValue')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={formData.discount_type === 'percentage' ? '20' : '10.00'}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('promoCodes.maxUses')}</label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('promoCodes.maxUsesPlaceholder')}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="one_per_client"
                  checked={formData.one_per_client}
                  onChange={(e) => setFormData({ ...formData, one_per_client: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="one_per_client" className="text-sm text-gray-700">{t('promoCodes.onePerClient')}</label>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('promoCodes.validFrom')}</label>
                  <input
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('promoCodes.validUntil')}</label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t('promoCodes.validUntilPlaceholder')}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active_create"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_active_create" className="text-sm text-gray-700">{t('promoCodes.isActive')}</label>
              </div>
              {createError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{createError}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {createMutation.isPending ? t('promoCodes.creating') : t('promoCodes.create')}
                </button>
                <button
                  onClick={() => { setShowCreateModal(false); setCreateError(null) }}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPromo && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => { setEditingPromo(null); setEditError(null) }}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('promoCodes.edit')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('promoCodes.code')}</label>
                <input
                  type="text"
                  value={editFormData.code}
                  onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                  placeholder={t('promoCodes.codePlaceholder')}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('promoCodes.discountType')}</label>
                  <select
                    value={editFormData.discount_type}
                    onChange={(e) => setEditFormData({ ...editFormData, discount_type: e.target.value as 'percentage' | 'fixed' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="percentage">{t('promoCodes.percentage')}</option>
                    <option value="fixed">{t('promoCodes.fixed')}</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('promoCodes.discountValue')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.discount_value}
                    onChange={(e) => setEditFormData({ ...editFormData, discount_value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={editFormData.discount_type === 'percentage' ? '20' : '10.00'}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('promoCodes.maxUses')}</label>
                <input
                  type="number"
                  min="1"
                  value={editFormData.max_uses}
                  onChange={(e) => setEditFormData({ ...editFormData, max_uses: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('promoCodes.maxUsesPlaceholder')}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_one_per_client"
                  checked={editFormData.one_per_client}
                  onChange={(e) => setEditFormData({ ...editFormData, one_per_client: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="edit_one_per_client" className="text-sm text-gray-700">{t('promoCodes.onePerClient')}</label>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('promoCodes.validFrom')}</label>
                  <input
                    type="date"
                    value={editFormData.valid_from}
                    onChange={(e) => setEditFormData({ ...editFormData, valid_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('promoCodes.validUntil')}</label>
                  <input
                    type="date"
                    value={editFormData.valid_until}
                    onChange={(e) => setEditFormData({ ...editFormData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t('promoCodes.validUntilPlaceholder')}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={editFormData.is_active}
                  onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="edit_is_active" className="text-sm text-gray-700">{t('promoCodes.isActive')}</label>
              </div>
              {editError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{editError}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  disabled={editMutation.isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {editMutation.isPending ? t('common.saving') : t('common.save')}
                </button>
                <button
                  onClick={() => { setEditingPromo(null); setEditError(null) }}
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
            <h2 className="text-base font-semibold text-gray-900 mb-2">{t('promoCodes.deactivateConfirm')}</h2>
            {confirmDeactivatePromo && (
              <p className="text-sm font-mono font-medium text-indigo-700 mb-3">"{confirmDeactivatePromo.code}"</p>
            )}
            <p className="text-sm text-gray-600 mb-4">{t('promoCodes.deactivateDesc')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => deactivateMutation.mutate(confirmDeactivateId)}
                disabled={deactivateMutation.isPending}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deactivateMutation.isPending ? t('common.loading') : t('promoCodes.deactivate')}
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
