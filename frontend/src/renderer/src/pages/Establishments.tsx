import { useState, useRef, forwardRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { locationsApi, type Location, type LocationCreate } from '../api/locations'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Pagination } from '../components/Pagination'
import { establishmentSchema } from '../lib/formSchemas'

const PAGE_SIZE = 12

// ── Styled input forwarded ref for PhoneInput ────────────────────────────────
const BareInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => (
    <input
      ref={ref}
      {...props}
      className="flex-1 min-w-0 px-2 text-sm border-0 outline-none bg-transparent placeholder-gray-400"
    />
  )
)

// ── Nominatim address autocomplete ───────────────────────────────────────────
interface NominatimResult {
  place_id: number
  display_name: string
}

function AddressAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    onChange(v)
    setOpen(false)
    if (timer.current) clearTimeout(timer.current)
    if (v.trim().length < 3) { setSuggestions([]); return }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(v)}&format=json&limit=6&addressdetails=0`,
          { headers: { 'Accept-Language': navigator.language, 'User-Agent': 'AgonStudio/0.1' } }
        )
        const data: NominatimResult[] = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
      } catch {
        setSuggestions([])
      }
    }, 600)
  }

  const select = (name: string) => {
    onChange(name)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {open && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto text-sm">
          {suggestions.map((s) => (
            <li
              key={s.place_id}
              onMouseDown={() => select(s.display_name)}
              className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-gray-700 truncate"
              title={s.display_name}
            >
              {s.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
interface FormData {
  name: string
  address: string
  phone: string
}

const DEFAULT_FORM: FormData = { name: '', address: '', phone: '' }

export function EstablishmentsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Location | null>(null)
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState<Location | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<Location | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list(true),
  })

  const createMutation = useMutation({
    mutationFn: (data: LocationCreate) => locationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      closeModal()
    },
    onError: () => setFormError(t('establishments.saveError')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LocationCreate & { is_active: boolean }> }) =>
      locationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      closeModal()
    },
    onError: () => setFormError(t('establishments.saveError')),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => locationsApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setConfirmDeactivate(null)
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => locationsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setConfirmRemove(null)
      setRemoveError(null)
    },
    onError: (err: any) => {
      const code = err?.response?.data?.detail?.error?.code
      setRemoveError(
        code === 'LOCATION_HAS_CLASSES'
          ? t('establishments.hasClasses')
          : t('establishments.saveError')
      )
    },
  })

  const openCreate = () => {
    setEditing(null)
    setFormData(DEFAULT_FORM)
    setFormError(null)
    setShowModal(true)
  }

  const openEdit = (loc: Location) => {
    setEditing(loc)
    setFormData({ name: loc.name, address: loc.address ?? '', phone: loc.phone ?? '' })
    setFormError(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setFormData(DEFAULT_FORM)
    setFormError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const zodResult = establishmentSchema.safeParse(formData)
    if (!zodResult.success) {
      setFormError(zodResult.error.errors[0].message)
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

  const isPending = createMutation.isPending || updateMutation.isPending
  const paged = locations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title={t('establishments.title')}
        subtitle={t('establishments.subtitle')}
        action={
          locations.length > 0 ? (
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
            >
              {t('establishments.add')}
            </button>
          ) : null
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingSpinner size="lg" />
        </div>
      ) : locations.length === 0 ? (
        <EmptyState
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
          title={t('establishments.empty')}
          description={t('establishments.emptyDesc')}
          actionLabel={t('establishments.add')}
          onAction={openCreate}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paged.map((loc) => (
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
                      onClick={() => setConfirmDeactivate(loc)}
                      className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                    >
                      {t('establishments.deactivate')}
                    </button>
                  )}
                  <button
                    onClick={() => { setConfirmRemove(loc); setRemoveError(null) }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    {t('establishments.remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={locations.length} onPage={setPage} />
        </>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={closeModal}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
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
                  placeholder={t('establishments.namePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('establishments.address')}
                </label>
                <AddressAutocomplete
                  value={formData.address}
                  onChange={(v) => setFormData((f) => ({ ...f, address: v }))}
                  placeholder={t('establishments.addressPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('establishments.phone')}
                </label>
                <div className="flex items-center border border-gray-300 rounded-md px-2 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-shadow">
                  <PhoneInput
                    value={formData.phone || undefined}
                    onChange={(v) => setFormData((f) => ({ ...f, phone: v ?? '' }))}
                    defaultCountry="IT"
                    international
                    inputComponent={BareInput}
                    className="w-full flex items-center gap-1"
                  />
                </div>
              </div>

              {formError && (
                <div className="sm:col-span-3 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 border border-red-100">
                  {formError}
                </div>
              )}

              <div className="sm:col-span-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeModal}
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
        </div>
      )}

      {/* Deactivate confirmation */}
      {confirmDeactivate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmDeactivate(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              {t('establishments.deactivateConfirm')}
            </h3>
            <p className="text-sm text-gray-500 mb-5">{confirmDeactivate.name}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeactivate(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => deactivateMutation.mutate(confirmDeactivate.id)}
                disabled={deactivateMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deactivateMutation.isPending ? t('common.saving') : t('establishments.deactivate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove confirmation */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmRemove(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              {t('establishments.removeConfirm')}
            </h3>
            <p className="text-sm text-gray-500 mb-1">{confirmRemove.name}</p>
            <p className="text-xs text-gray-400 mb-4">{t('establishments.removeDesc')}</p>
            {removeError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 border border-red-100 mb-4">
                {removeError}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => removeMutation.mutate(confirmRemove.id)}
                disabled={removeMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {removeMutation.isPending ? t('common.saving') : t('establishments.remove')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
