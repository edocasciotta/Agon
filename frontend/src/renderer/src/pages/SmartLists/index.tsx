import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { smartListsApi } from '../../api/smartLists'
import { membershipTypesApi } from '../../api/memberships'
import type { SmartListItem, SmartListResponse, SmartListCreate, SmartListFilters } from '../../types'
import { EmptyState } from '../../components/EmptyState'

const emptyFilters: SmartListFilters = {}

const emptyForm: SmartListCreate = { name: '', description: '', filters: emptyFilters }

interface SmartListModalProps {
  initial: SmartListCreate
  title: string
  onSave: (data: SmartListCreate) => void
  onClose: () => void
  saving: boolean
}

function SmartListModal({ initial, title, onSave, onClose, saving }: SmartListModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<SmartListCreate>(initial)

  const { data: membershipTypes = [] } = useQuery({
    queryKey: ['membership-types'],
    queryFn: membershipTypesApi.list,
  })

  function setFilter<K extends keyof SmartListFilters>(key: K, value: SmartListFilters[K]) {
    setForm((f) => ({ ...f, filters: { ...f.filters, [key]: value } }))
  }

  function clearFilter(key: keyof SmartListFilters) {
    setForm((f) => {
      const filters = { ...f.filters }
      delete filters[key]
      return { ...f, filters }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('marketing.smartListName')} *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('marketing.description')}
            </label>
            <input
              type="text"
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('marketing.filters')}</h3>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t('marketing.membershipStatus')}
                </label>
                <select
                  value={form.filters.membership_status ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '') {
                      clearFilter('membership_status')
                    } else {
                      setFilter('membership_status', v as 'active' | 'expired' | 'none')
                    }
                  }}
                  className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                >
                  <option value="">{t('marketing.anyStatus')}</option>
                  <option value="active">{t('marketing.activeStatus')}</option>
                  <option value="expired">{t('marketing.expiredStatus')}</option>
                  <option value="none">{t('marketing.noMembership')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t('marketing.membershipType')}
                </label>
                <select
                  value={form.filters.membership_type_id ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '') {
                      clearFilter('membership_type_id')
                    } else {
                      setFilter('membership_type_id', Number(v))
                    }
                  }}
                  className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                >
                  <option value="">{t('marketing.anyType')}</option>
                  {membershipTypes.map((mt) => (
                    <option key={mt.id} value={mt.id}>
                      {mt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t('marketing.lastBookedWithin')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.filters.last_booked_within_days ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '') {
                        clearFilter('last_booked_within_days')
                      } else {
                        setFilter('last_booked_within_days', Number(v))
                      }
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t('marketing.notBookedWithin')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.filters.not_booked_within_days ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '') {
                        clearFilter('not_booked_within_days')
                      } else {
                        setFilter('not_booked_within_days', Number(v))
                      }
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t('marketing.joinedAfter')}
                  </label>
                  <input
                    type="date"
                    value={form.filters.joined_after ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '') {
                        clearFilter('joined_after')
                      } else {
                        setFilter('joined_after', v)
                      }
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t('marketing.joinedBefore')}
                  </label>
                  <input
                    type="date"
                    value={form.filters.joined_before ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '') {
                        clearFilter('joined_before')
                      } else {
                        setFilter('joined_before', v)
                      }
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

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
              {saving ? t('common.saving') : t('marketing.saveList')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface PreviewPanelProps {
  listId: number
  onClose: () => void
}

function PreviewPanel({ listId, onClose }: PreviewPanelProps) {
  const { t } = useTranslation()
  const { data, isLoading, error } = useQuery({
    queryKey: ['smartlist-preview', listId],
    queryFn: () => smartListsApi.preview(listId),
  })

  return (
    <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        {isLoading && <p className="text-sm text-gray-500">{t('common.loading')}</p>}
        {error && <p className="text-sm text-red-500">{t('common.error')}</p>}
        {data && (
          <p className="text-sm font-medium text-indigo-800">
            {t('marketing.previewResults', { count: data.count })}
          </p>
        )}
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700">
          {t('common.close')}
        </button>
      </div>
      {data && data.clients.length === 0 && (
        <p className="text-sm text-gray-500">{t('marketing.noResults')}</p>
      )}
      {data && data.clients.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-600">
              <th className="text-left pb-1">{t('common.name')}</th>
              <th className="text-left pb-1">{t('common.email')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indigo-100">
            {data.clients.map((c) => (
              <tr key={c.id}>
                <td className="py-1 text-gray-800">{c.full_name}</td>
                <td className="py-1 text-gray-600">{c.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function SmartListsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<SmartListResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SmartListItem | null>(null)
  const [previewId, setPreviewId] = useState<number | null>(null)

  const { data: lists = [], isLoading, error } = useQuery({
    queryKey: ['smartlists'],
    queryFn: smartListsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: smartListsApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['smartlists'] })
      setCreateOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SmartListCreate }) =>
      smartListsApi.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['smartlists'] })
      setEditItem(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => smartListsApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['smartlists'] })
      setDeleteTarget(null)
    },
  })

  async function handleEditClick(item: SmartListItem) {
    const full = await smartListsApi.get(item.id)
    setEditItem(full)
  }

  if (isLoading) {
    return <p className="text-gray-500 text-sm">{t('common.loading')}</p>
  }

  if (error) {
    return <p className="text-red-500 text-sm">{t('common.error')}</p>
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('marketing.smartLists')}</h1>
        {lists.length > 0 && (
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
          >
            {t('marketing.newSmartList')}
          </button>
        )}
      </div>

      {lists.length === 0 && (
        <EmptyState
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
            </svg>
          }
          title={t('marketing.noSmartLists')}
          description={t('marketing.emptyDescSmartLists')}
          actionLabel={t('marketing.newSmartList')}
          onAction={() => setCreateOpen(true)}
        />
      )}

      <div className="flex flex-col gap-2">
        {lists.map((lst) => (
          <div key={lst.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">{lst.name}</p>
                {lst.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{lst.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewId(previewId === lst.id ? null : lst.id)}
                  className="px-3 py-1.5 text-xs text-indigo-600 border border-indigo-300 rounded-md hover:bg-indigo-50"
                >
                  {t('marketing.preview')}
                </button>
                <button
                  onClick={() => void handleEditClick(lst)}
                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  {t('common.edit')}
                </button>
                <button
                  onClick={() => setDeleteTarget(lst)}
                  className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-md hover:bg-red-50"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
            {previewId === lst.id && (
              <PreviewPanel listId={lst.id} onClose={() => setPreviewId(null)} />
            )}
          </div>
        ))}
      </div>

      {createOpen && (
        <SmartListModal
          title={t('marketing.newSmartList')}
          initial={emptyForm}
          onSave={(data) => createMutation.mutate(data)}
          onClose={() => setCreateOpen(false)}
          saving={createMutation.isPending}
        />
      )}

      {editItem && (
        <SmartListModal
          title={t('common.edit')}
          initial={{
            name: editItem.name,
            description: editItem.description ?? '',
            filters: editItem.filters,
          }}
          onSave={(data) => updateMutation.mutate({ id: editItem.id, data })}
          onClose={() => setEditItem(null)}
          saving={updateMutation.isPending}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <p className="text-gray-800 mb-4">{t('marketing.deleteConfirm')}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
