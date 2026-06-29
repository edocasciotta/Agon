import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { locationsApi, type Location, type LocationCreate } from '../api/locations'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'

interface FormData {
  name: string
  address: string
  phone: string
}

const DEFAULT_FORM: FormData = { name: '', address: '', phone: '' }

export function EstablishmentsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Location | null>(null)
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list(true),
  })

  const createMutation = useMutation({
    mutationFn: (data: LocationCreate) => locationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setShowForm(false)
      setFormData(DEFAULT_FORM)
      setFormError(null)
    },
    onError: () => setFormError(t('establishments.saveError')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LocationCreate & { is_active: boolean }> }) =>
      locationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setEditing(null)
      setFormData(DEFAULT_FORM)
      setFormError(null)
    },
    onError: () => setFormError(t('establishments.saveError')),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => locationsApi.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }),
  })

  const openEdit = (loc: Location) => {
    setEditing(loc)
    setFormData({ name: loc.name, address: loc.address ?? '', phone: loc.phone ?? '' })
    setShowForm(true)
    setFormError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setFormError(t('establishments.nameRequired'))
      return
    }
    const payload: LocationCreate = {
      name: formData.name.trim(),
      address: formData.address.trim() || undefined,
      phone: formData.phone.trim() || undefined,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditing(null)
    setFormData(DEFAULT_FORM)
    setFormError(null)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <PageHeader
        title={t('establishments.title')}
        subtitle={t('establishments.subtitle')}
        action={
          !showForm ? (
            <button
              onClick={() => { setShowForm(true); setEditing(null); setFormData(DEFAULT_FORM) }}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
            >
              {t('establishments.add')}
            </button>
          ) : null
        }
      />

      {/* Form */}
      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            {editing ? t('establishments.editTitle') : t('establishments.addTitle')}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t('establishments.name')} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Studio Centro"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t('establishments.address')}
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Via Roma 1, Milano"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t('establishments.phone')}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="+39 02 1234567"
              />
            </div>

            {formError && (
              <div className="sm:col-span-3 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 border border-red-100">
                {formError}
              </div>
            )}

            <div className="sm:col-span-3 flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingSpinner size="lg" />
        </div>
      ) : locations.length === 0 ? (
        <EmptyState
          title={t('establishments.empty')}
          description={t('establishments.emptyDesc')}
          action={
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
            >
              {t('establishments.add')}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className={`bg-white border rounded-xl p-4 flex flex-col gap-2 ${
                loc.is_active ? 'border-gray-200' : 'border-gray-100 opacity-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">{loc.name}</h4>
                  {loc.address && (
                    <p className="text-xs text-gray-500 mt-0.5">{loc.address}</p>
                  )}
                  {loc.phone && (
                    <p className="text-xs text-gray-500">{loc.phone}</p>
                  )}
                </div>
                {!loc.is_active && (
                  <span className="flex-shrink-0 text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {t('establishments.inactive')}
                  </span>
                )}
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => openEdit(loc)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {t('common.edit')}
                </button>
                {loc.is_active && (
                  <button
                    onClick={() => deactivateMutation.mutate(loc.id)}
                    disabled={deactivateMutation.isPending}
                    className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                  >
                    {t('establishments.deactivate')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
