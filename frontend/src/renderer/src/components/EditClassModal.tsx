import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { classesApi } from '../api/classes'
import { instructorsApi } from '../api/instructors'
import { locationsApi } from '../api/locations'
import { classTemplatesApi } from '../api/classTemplates'
import type { ScheduledClass, ClassTemplate } from '../types'

function addMinutes(dateStr: string, timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + minutes
  const endH = Math.floor(total / 60) % 24
  const endM = total % 60
  return `${dateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`
}

interface EditClassModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editClass: ScheduledClass
  onCancelClass?: () => void
}

export function EditClassModal({ isOpen, onClose, onSuccess, editClass, onCancelClass }: EditClassModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [apiError, setApiError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const startsAt = new Date(editClass.starts_at)
  const endsAt = new Date(editClass.ends_at)
  const defaultDuration = Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000))

  const [form, setForm] = useState({
    date: format(startsAt, 'yyyy-MM-dd'),
    start_time: format(startsAt, 'HH:mm'),
    duration_minutes: defaultDuration,
    instructor_id: editClass.instructor_id ? String(editClass.instructor_id) : '',
    location_id: editClass.location_id ? String(editClass.location_id) : '',
    capacity: editClass.capacity,
    notes: editClass.notes ?? '',
  })

  useEffect(() => {
    if (isOpen) {
      const s = new Date(editClass.starts_at)
      const e = new Date(editClass.ends_at)
      setForm({
        date: format(s, 'yyyy-MM-dd'),
        start_time: format(s, 'HH:mm'),
        duration_minutes: Math.max(1, Math.round((e.getTime() - s.getTime()) / 60000)),
        instructor_id: editClass.instructor_id ? String(editClass.instructor_id) : '',
        location_id: editClass.location_id ? String(editClass.location_id) : '',
        capacity: editClass.capacity,
        notes: editClass.notes ?? '',
      })
      setApiError(null)
      setErrors({})
    }
  }, [isOpen, editClass])

  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors'],
    queryFn: instructorsApi.list,
    enabled: isOpen,
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list(false),
    enabled: isOpen,
  })

  const { data: templates = [] } = useQuery({
    queryKey: ['class-templates'],
    queryFn: classTemplatesApi.list,
    enabled: isOpen,
  })

  const templateName = (templates as ClassTemplate[]).find((t) => t.id === editClass.template_id)?.name

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof classesApi.update>[1]) =>
      classesApi.update(editClass.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      onSuccess()
      onClose()
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : t('editModal.failedSave')
      setApiError(msg)
    },
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.date) e.date = t('scheduleModal.dateRequired')
    if (!form.start_time) e.start_time = t('scheduleModal.startTimeRequired')
    if (!form.duration_minutes || form.duration_minutes <= 0) e.duration_minutes = t('scheduleModal.durationPositive')
    if (!form.capacity || form.capacity <= 0) e.capacity = t('scheduleModal.capacityPositive')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setApiError(null)
    if (!validate()) return

    const starts_at = `${form.date}T${form.start_time}:00`
    const ends_at = addMinutes(form.date, form.start_time, form.duration_minutes)

    updateMutation.mutate({
      instructor_id: form.instructor_id ? Number(form.instructor_id) : undefined,
      location_id: form.location_id ? Number(form.location_id) : undefined,
      starts_at,
      ends_at,
      capacity: form.capacity,
      notes: form.notes || undefined,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('editModal.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('editModal.close')}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4">
          {/* Class type — read-only */}
          {templateName && (
            <div className="mb-4 px-3 py-2 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-700">
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">{t('scheduleModal.classType').replace(' *', '')}</span>
              <div className="font-medium mt-0.5">{templateName}</div>
            </div>
          )}

          {/* API error */}
          {apiError && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.date').replace(' *', '')} *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.date && <p className="text-xs text-red-600 mt-1">{errors.date}</p>}
            </div>

            {/* Start time + Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.startTime').replace(' *', '')} *</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {errors.start_time && <p className="text-xs text-red-600 mt-1">{errors.start_time}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.durationMin').replace(' *', '')} *</label>
                <input
                  type="number"
                  min={1}
                  value={form.duration_minutes}
                  onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {errors.duration_minutes && <p className="text-xs text-red-600 mt-1">{errors.duration_minutes}</p>}
              </div>
            </div>

            {/* Instructor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.instructor')}</label>
              <select
                value={form.instructor_id}
                onChange={(e) => setForm((f) => ({ ...f, instructor_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{t('scheduleModal.noInstructor')}</option>
                {instructors.map((inst: { id: number; full_name: string }) => (
                  <option key={inst.id} value={inst.id}>{inst.full_name}</option>
                ))}
              </select>
            </div>

            {/* Location — only shown if there are multiple */}
            {locations.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.location')}</label>
                <select
                  value={form.location_id}
                  onChange={(e) => setForm((f) => ({ ...f, location_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t('scheduleModal.noInstructor')}</option>
                  {locations.map((loc: { id: number; name: string }) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Capacity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.capacity').replace(' *', '')} *</label>
              <input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.capacity && <p className="text-xs text-red-600 mt-1">{errors.capacity}</p>}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.notes')}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Submit */}
            <div className="flex items-center justify-between gap-2 pt-2">
              {/* Cancel class — destructive, bottom left */}
              {onCancelClass && editClass.status === 'scheduled' && (
                <button
                  type="button"
                  onClick={onCancelClass}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  {t('calendar.cancelClass')}
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  {t('editModal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {updateMutation.isPending ? t('editModal.saving') : t('editModal.saveChanges')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
