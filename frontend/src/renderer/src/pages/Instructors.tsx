import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { instructorsApi, type Instructor, type InstructorCreate } from '../api/instructors'
import { classesApi } from '../api/classes'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Pagination } from '../components/Pagination'
import { instructorSchema } from '../lib/formSchemas'

const PAGE_SIZE = 12

interface FormData {
  full_name: string
  email: string
  password: string
  bio: string
}

const DEFAULT_FORM: FormData = { full_name: '', email: '', password: '', bio: '' }

function InitialsAvatar({ name, color }: { name: string; color: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0"
      style={{ background: `${color}22`, color }}
    >
      {initials}
    </div>
  )
}

const AVATAR_COLORS = ['#4F46E5', '#0F6E56', '#BA7517', '#993556', '#185FA5', '#639922']

export function InstructorsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Instructor | null>(null)
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM)
  const [formErrors, setFormErrors] = useState<Partial<FormData>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState<Instructor | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<Instructor | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [prevSearch, setPrevSearch] = useState(debouncedSearch)

  if (debouncedSearch !== prevSearch) {
    setPrevSearch(debouncedSearch)
    setPage(1)
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const now = new Date()
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const { data: instructors = [], isLoading } = useQuery({
    queryKey: ['instructors', debouncedSearch],
    queryFn: () => instructorsApi.list(debouncedSearch || undefined, true),
  })

  const { data: weekClasses = [] } = useQuery({
    queryKey: ['classes', weekStart, weekEnd],
    queryFn: () => classesApi.list({ start_date: weekStart, end_date: weekEnd }),
  })

  const classesPerInstructor: Record<number, number> = {}
  for (const cls of weekClasses) {
    if (cls.instructor_id) {
      classesPerInstructor[cls.instructor_id] = (classesPerInstructor[cls.instructor_id] ?? 0) + 1
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: InstructorCreate) => instructorsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] })
      closeModal()
    },
    onError: (err: any) => {
      const code = err?.response?.data?.detail?.error?.code
      if (code === 'AUTH_EMAIL_EXISTS') {
        setApiError(t('instructors.emailError'))
      } else {
        setApiError(t('instructors.saveError'))
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { full_name?: string; bio?: string } }) =>
      instructorsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] })
      closeModal()
    },
    onError: () => setApiError(t('instructors.saveError')),
  })

  const reactivateMutation = useMutation({
    mutationFn: (id: number) => instructorsApi.reactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructors'] }),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => instructorsApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] })
      setConfirmDeactivate(null)
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => instructorsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] })
      setConfirmRemove(null)
      setRemoveError(null)
    },
    onError: (err: any) => {
      const code = err?.response?.data?.detail?.error?.code
      if (code === 'INSTRUCTOR_HAS_CLASSES') {
        setRemoveError(t('instructors.hasClasses'))
      } else {
        setRemoveError(t('instructors.saveError'))
      }
    },
  })

  const openCreate = () => {
    setEditing(null)
    setFormData(DEFAULT_FORM)
    setFormErrors({})
    setApiError(null)
    setShowModal(true)
  }

  const openEdit = (inst: Instructor) => {
    setEditing(inst)
    setFormData({ full_name: inst.full_name, email: inst.email, password: '', bio: inst.bio ?? '' })
    setFormErrors({})
    setApiError(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setFormData(DEFAULT_FORM)
    setFormErrors({})
    setApiError(null)
  }

  const validate = (): boolean => {
    const errors: Partial<FormData> = {}
    if (!formData.full_name.trim()) errors.full_name = t('instructors.nameRequired')
    if (!editing && !formData.email.trim()) errors.email = t('instructors.emailRequired')
    if (!editing && formData.password.length < 8) errors.password = t('instructors.passwordRequired')
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setApiError(null)
    // Zod schema check for format-level validation (email format, lengths)
    const zodResult = instructorSchema.safeParse({
      ...formData,
      email: formData.email || undefined,
      password: formData.password || undefined,
    })
    if (!zodResult.success) {
      const firstError = zodResult.error.errors[0]
      setFormErrors({ [firstError.path[0]]: firstError.message } as Partial<FormData>)
      return
    }
    if (!validate()) return

    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        data: {
          full_name: formData.full_name.trim(),
          bio: formData.bio.trim() || undefined,
        },
      })
    } else {
      createMutation.mutate({
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        bio: formData.bio.trim() || undefined,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const paged = instructors.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title={t('instructors.title')}
        subtitle={t('instructors.subtitle')}
        action={
          instructors.length > 0 ? (
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
            >
              {t('instructors.add')}
            </button>
          ) : null
        }
      />

      {(isLoading || instructors.length > 0 || debouncedSearch) && (
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('instructors.searchPlaceholder')}
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingSpinner size="lg" />
        </div>
      ) : instructors.length === 0 && debouncedSearch ? (
        <p className="text-sm text-gray-500 text-center py-12">{t('instructors.noResults')}</p>
      ) : instructors.length === 0 ? (
        <EmptyState
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5.356-3.712M9 20H4v-2a4 4 0 015.356-3.712M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          title={t('instructors.empty')}
          description={t('instructors.emptyDesc')}
          actionLabel={t('instructors.add')}
          onAction={openCreate}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paged.map((inst, idx) => {
              const color = AVATAR_COLORS[(instructors.indexOf(inst)) % AVATAR_COLORS.length]
              const weekCount = classesPerInstructor[inst.id] ?? 0
              return (
                <div
                  key={inst.id}
                  className={`bg-white border rounded-xl p-4 flex flex-col gap-3 ${inst.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
                >
                  <div className="flex items-center gap-3">
                    <InitialsAvatar name={inst.full_name} color={color} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{inst.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{inst.email}</p>
                    </div>
                    {!inst.is_active && (
                      <span className="flex-shrink-0 text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {t('instructors.inactive')}
                      </span>
                    )}
                  </div>

                  {inst.bio && (
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{inst.bio}</p>
                  )}

                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: `${color}18`, color }}
                    >
                      {t('instructors.classesCount').replace('{{n}}', String(weekCount))}
                    </span>
                  </div>

                  <div className="flex gap-3 border-t border-gray-100 pt-2">
                    <button
                      onClick={() => openEdit(inst)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      {t('common.edit')}
                    </button>
                    {inst.is_active ? (
                      <button
                        onClick={() => setConfirmDeactivate(inst)}
                        className="text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors"
                      >
                        {t('instructors.deactivate')}
                      </button>
                    ) : (
                      <button
                        onClick={() => reactivateMutation.mutate(inst.id)}
                        disabled={reactivateMutation.isPending}
                        className="text-xs font-medium text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
                      >
                        {t('instructors.reactivate')}
                      </button>
                    )}
                    <button
                      onClick={() => { setConfirmRemove(inst); setRemoveError(null) }}
                      className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                    >
                      {t('instructors.remove')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={instructors.length} onPage={setPage} />
        </>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={closeModal}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              {editing ? t('instructors.editTitle') : t('instructors.addTitle')}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t('instructors.name')} *
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData((f) => ({ ...f, full_name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t('instructors.fullNamePlaceholder')}
                  />
                  {formErrors.full_name && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.full_name}</p>
                  )}
                </div>

                {!editing && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {t('instructors.email')} *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder={t('instructors.emailPlaceholder')}
                    />
                    {formErrors.email && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>
                    )}
                  </div>
                )}

                {!editing && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {t('instructors.password')} *
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="••••••••"
                    />
                    {formErrors.password ? (
                      <p className="text-xs text-red-500 mt-1">{formErrors.password}</p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">{t('instructors.passwordHint')}</p>
                    )}
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t('instructors.bio')}
                  </label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData((f) => ({ ...f, bio: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder={t('instructors.bioPlaceholder')}
                  />
                </div>
              </div>

              {apiError && (
                <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 border border-red-100">
                  {apiError}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
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

      {/* Remove confirmation */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmRemove(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              {t('instructors.removeConfirm')}
            </h3>
            <p className="text-sm text-gray-500 mb-1">{confirmRemove.full_name}</p>
            <p className="text-xs text-gray-400 mb-4">{t('instructors.removeDesc')}</p>
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
                {removeMutation.isPending ? t('common.saving') : t('instructors.remove')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirmation */}
      {confirmDeactivate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmDeactivate(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              {t('instructors.deactivateConfirm')}
            </h3>
            <p className="text-sm text-gray-500 mb-5">{confirmDeactivate.full_name}</p>
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
                {deactivateMutation.isPending ? t('common.saving') : t('instructors.deactivate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
