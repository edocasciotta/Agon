import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { membershipTypesApi, membershipsApi } from '../api/memberships'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import type { ApiError } from '../api/client'
import type { MembershipType } from '../types'

export function MembershipsPage() {
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
      setCreateError(err.message ?? 'Failed to create membership type')
    },
  })

  const handleCreate = () => {
    if (!formData.name.trim()) {
      setCreateError('Name is required')
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
      <PageHeader title="Memberships" />

      {/* Membership Types */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Membership Types</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            + Create Type
          </button>
        </div>
        {typesLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credits</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(membershipTypes ?? []).map((t) => (
                  <tr key={t.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{t.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{t.type}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{t.currency} {t.price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {t.unlimited ? 'Unlimited' : (t.credits_included ?? '—')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {t.is_active ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!membershipTypes || membershipTypes.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No membership types yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* All Memberships */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">All Memberships</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        {membershipsLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credits</th>
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
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">No memberships found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create Type Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Membership Type</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Monthly Unlimited"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'recurring' | 'credit_pack' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="recurring">Recurring</option>
                  <option value="credit_pack">Credit Pack</option>
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="49.99"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="USD"
                  />
                </div>
              </div>
              {formData.type === 'credit_pack' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credits Included</label>
                  <input
                    type="number"
                    value={formData.credits_included}
                    onChange={(e) => setFormData({ ...formData, credits_included: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="10"
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
                <label htmlFor="unlimited" className="text-sm text-gray-700">Unlimited classes</label>
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
                  {createTypeMutation.isPending ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => { setShowCreateModal(false); setCreateError(null) }}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
