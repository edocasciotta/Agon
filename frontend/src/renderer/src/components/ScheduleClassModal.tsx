import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { classesApi } from '../api/classes'
import { classTemplatesApi } from '../api/classTemplates'
import { instructorsApi } from '../api/instructors'
import { locationsApi } from '../api/locations'
import type { ClassTemplate } from '../types'
import { resolveApiError } from '../lib/errorMessages'

interface ScheduleClassModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  defaultDate?: Date
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function addMinutes(dateStr: string, timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + minutes
  const endH = Math.floor(total / 60) % 24
  const endM = total % 60
  return `${dateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`
}

export function ScheduleClassModal({ isOpen, onClose, onSuccess, defaultDate }: ScheduleClassModalProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'single' | 'recurring'>('single')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  // Single class form state
  const [singleForm, setSingleForm] = useState({
    template_id: '',
    date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : '',
    start_time: '09:00',
    duration_minutes: 60,
    instructor_id: '',
    location_id: '1',
    capacity: 10,
    notes: '',
  })

  // Recurring class form state
  const [recurringForm, setRecurringForm] = useState({
    template_id: '',
    first_date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : '',
    start_time: '09:00',
    duration_minutes: 60,
    instructor_id: '',
    location_id: '1',
    capacity: 10,
    recurrence_days: [] as number[],
    end_date: '',
    notes: '',
  })

  const [singleErrors, setSingleErrors] = useState<Record<string, string>>({})
  const [recurringErrors, setRecurringErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen) {
      const dateStr = defaultDate ? format(defaultDate, 'yyyy-MM-dd') : ''
      const timeStr = defaultDate ? format(defaultDate, 'HH:mm') : '09:00'
      setSingleForm({
        template_id: '',
        date: dateStr,
        start_time: timeStr,
        duration_minutes: 60,
        instructor_id: '',
        location_id: '1',
        capacity: 10,
        notes: '',
      })
      setRecurringForm({
        template_id: '',
        first_date: dateStr,
        start_time: timeStr,
        duration_minutes: 60,
        instructor_id: '',
        location_id: '1',
        capacity: 10,
        recurrence_days: [],
        end_date: '',
        notes: '',
      })
      setSingleErrors({})
      setRecurringErrors({})
      setApiError(null)
      setSuccessMessage(null)
      setActiveTab('single')
    }
  }, [isOpen, defaultDate])

  const { data: templates = [] } = useQuery({
    queryKey: ['class-templates'],
    queryFn: classTemplatesApi.list,
    enabled: isOpen,
  })

  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => instructorsApi.list(),
    enabled: isOpen,
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list(false),
    enabled: isOpen,
  })

  // Auto-fill duration and capacity from selected template
  const selectedSingleTemplate = templates.find((tpl: ClassTemplate) => tpl.id === Number(singleForm.template_id))
  const selectedRecurringTemplate = templates.find((tpl: ClassTemplate) => tpl.id === Number(recurringForm.template_id))

  useEffect(() => {
    if (selectedSingleTemplate) {
      setSingleForm((f) => ({
        ...f,
        duration_minutes: selectedSingleTemplate.duration_minutes,
        capacity: selectedSingleTemplate.default_capacity,
      }))
    }
  }, [singleForm.template_id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedRecurringTemplate) {
      setRecurringForm((f) => ({
        ...f,
        duration_minutes: selectedRecurringTemplate.duration_minutes,
        capacity: selectedRecurringTemplate.default_capacity,
      }))
    }
  }, [recurringForm.template_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const queryClient = useQueryClient()

  const singleMutation = useMutation({
    mutationFn: classesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      onSuccess()
      onClose()
    },
    onError: (err: unknown) => {
      setApiError(resolveApiError(err, t('scheduleModal.failedSchedule')))
    },
  })

  const recurringMutation = useMutation({
    mutationFn: classesApi.createRecurring,
    onSuccess: (data) => {
      setSuccessMessage(t('scheduleModal.scheduledSuccess', { count: data.count }))
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)
    },
    onError: (err: unknown) => {
      setApiError(resolveApiError(err, t('scheduleModal.failedScheduleRecurring')))
    },
  })

  const validateSingle = () => {
    const errors: Record<string, string> = {}
    if (!singleForm.template_id) errors.template_id = t('scheduleModal.classTypeRequired')
    if (!singleForm.date) errors.date = t('scheduleModal.dateRequired')
    if (!singleForm.start_time) errors.start_time = t('scheduleModal.startTimeRequired')
    if (!singleForm.duration_minutes || singleForm.duration_minutes <= 0)
      errors.duration_minutes = t('scheduleModal.durationPositive')
    if (!singleForm.capacity || singleForm.capacity <= 0)
      errors.capacity = t('scheduleModal.capacityPositive')
    setSingleErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateRecurring = () => {
    const errors: Record<string, string> = {}
    if (!recurringForm.template_id) errors.template_id = t('scheduleModal.classTypeRequired')
    if (!recurringForm.first_date) errors.first_date = t('scheduleModal.firstDateRequired')
    if (!recurringForm.start_time) errors.start_time = t('scheduleModal.startTimeRequired')
    if (!recurringForm.duration_minutes || recurringForm.duration_minutes <= 0)
      errors.duration_minutes = t('scheduleModal.durationPositive')
    if (!recurringForm.capacity || recurringForm.capacity <= 0)
      errors.capacity = t('scheduleModal.capacityPositive')
    if (recurringForm.recurrence_days.length === 0)
      errors.recurrence_days = t('scheduleModal.selectOneDay')
    if (!recurringForm.end_date) errors.end_date = t('scheduleModal.endDateRequired')
    setRecurringErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setApiError(null)
    if (!validateSingle()) return

    const starts_at = `${singleForm.date}T${singleForm.start_time}:00`
    const ends_at = addMinutes(singleForm.date, singleForm.start_time, singleForm.duration_minutes)

    singleMutation.mutate({
      template_id: Number(singleForm.template_id),
      instructor_id: singleForm.instructor_id ? Number(singleForm.instructor_id) : undefined,
      location_id: singleForm.location_id ? Number(singleForm.location_id) : 1,
      starts_at,
      ends_at,
      capacity: singleForm.capacity,
      notes: singleForm.notes || undefined,
    })
  }

  const handleRecurringSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setApiError(null)
    if (!validateRecurring()) return

    const first_starts_at = `${recurringForm.first_date}T${recurringForm.start_time}:00`
    // ends_at is not sent for recurring; backend uses duration_minutes

    recurringMutation.mutate({
      template_id: Number(recurringForm.template_id),
      instructor_id: recurringForm.instructor_id ? Number(recurringForm.instructor_id) : undefined,
      location_id: recurringForm.location_id ? Number(recurringForm.location_id) : 1,
      first_starts_at,
      duration_minutes: recurringForm.duration_minutes,
      capacity: recurringForm.capacity,
      recurrence_days: recurringForm.recurrence_days,
      end_date: recurringForm.end_date,
      notes: recurringForm.notes || undefined,
    })
  }

  const toggleDay = (day: number) => {
    setRecurringForm((f) => ({
      ...f,
      recurrence_days: f.recurrence_days.includes(day)
        ? f.recurrence_days.filter((d) => d !== day)
        : [...f.recurrence_days, day],
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('scheduleModal.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('scheduleModal.closeModal')}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => { setActiveTab('single'); setApiError(null); setSuccessMessage(null) }}
            className={`py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'single'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('scheduleModal.singleClass')}
          </button>
          <button
            onClick={() => { setActiveTab('recurring'); setApiError(null); setSuccessMessage(null) }}
            className={`py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'recurring'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('scheduleModal.recurringClass')}
          </button>
        </div>

        <div className="px-6 py-4">
          {/* API error banner */}
          {apiError && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {apiError}
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              {successMessage}
            </div>
          )}

          {/* Single class form */}
          {activeTab === 'single' && (
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              {/* Template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.classType')}</label>
                <select
                  value={singleForm.template_id}
                  onChange={(e) => setSingleForm((f) => ({ ...f, template_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t('scheduleModal.selectClassType')}</option>
                  {templates.map((tpl: ClassTemplate) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </select>
                {singleErrors.template_id && (
                  <p className="text-xs text-red-600 mt-1">{singleErrors.template_id}</p>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.date')}</label>
                <input
                  type="date"
                  value={singleForm.date}
                  onChange={(e) => setSingleForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {singleErrors.date && (
                  <p className="text-xs text-red-600 mt-1">{singleErrors.date}</p>
                )}
              </div>

              {/* Start time + Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.startTime')}</label>
                  <input
                    type="time"
                    value={singleForm.start_time}
                    onChange={(e) => setSingleForm((f) => ({ ...f, start_time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {singleErrors.start_time && (
                    <p className="text-xs text-red-600 mt-1">{singleErrors.start_time}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.durationMin')}</label>
                  <input
                    type="number"
                    min={1}
                    value={singleForm.duration_minutes}
                    onChange={(e) => setSingleForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {singleErrors.duration_minutes && (
                    <p className="text-xs text-red-600 mt-1">{singleErrors.duration_minutes}</p>
                  )}
                </div>
              </div>

              {/* Instructor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.instructor')}</label>
                <select
                  value={singleForm.instructor_id}
                  onChange={(e) => setSingleForm((f) => ({ ...f, instructor_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t('scheduleModal.noInstructor')}</option>
                  {instructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Location */}
              {locations.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.location')}</label>
                  <select
                    value={singleForm.location_id}
                    onChange={(e) => setSingleForm((f) => ({ ...f, location_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Capacity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.capacity')}</label>
                <input
                  type="number"
                  min={1}
                  value={singleForm.capacity}
                  onChange={(e) => setSingleForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {singleErrors.capacity && (
                  <p className="text-xs text-red-600 mt-1">{singleErrors.capacity}</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.notes')}</label>
                <textarea
                  value={singleForm.notes}
                  onChange={(e) => setSingleForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  {t('scheduleModal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={singleMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {singleMutation.isPending ? t('scheduleModal.scheduling') : t('scheduleModal.scheduleClass')}
                </button>
              </div>
            </form>
          )}

          {/* Recurring class form */}
          {activeTab === 'recurring' && (
            <form onSubmit={handleRecurringSubmit} className="space-y-4">
              {/* Template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.classType')}</label>
                <select
                  value={recurringForm.template_id}
                  onChange={(e) => setRecurringForm((f) => ({ ...f, template_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t('scheduleModal.selectClassType')}</option>
                  {templates.map((tpl: ClassTemplate) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </select>
                {recurringErrors.template_id && (
                  <p className="text-xs text-red-600 mt-1">{recurringErrors.template_id}</p>
                )}
              </div>

              {/* First date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.firstDate')}</label>
                <input
                  type="date"
                  value={recurringForm.first_date}
                  onChange={(e) => setRecurringForm((f) => ({ ...f, first_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {recurringErrors.first_date && (
                  <p className="text-xs text-red-600 mt-1">{recurringErrors.first_date}</p>
                )}
              </div>

              {/* Start time + Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.startTime')}</label>
                  <input
                    type="time"
                    value={recurringForm.start_time}
                    onChange={(e) => setRecurringForm((f) => ({ ...f, start_time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {recurringErrors.start_time && (
                    <p className="text-xs text-red-600 mt-1">{recurringErrors.start_time}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.durationMin')}</label>
                  <input
                    type="number"
                    min={1}
                    value={recurringForm.duration_minutes}
                    onChange={(e) => setRecurringForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {recurringErrors.duration_minutes && (
                    <p className="text-xs text-red-600 mt-1">{recurringErrors.duration_minutes}</p>
                  )}
                </div>
              </div>

              {/* Days of week */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('scheduleModal.daysOfWeek')}</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map((label, idx) => (
                    <label key={idx} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={recurringForm.recurrence_days.includes(idx)}
                        onChange={() => toggleDay(idx)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
                {recurringErrors.recurrence_days && (
                  <p className="text-xs text-red-600 mt-1">{recurringErrors.recurrence_days}</p>
                )}
              </div>

              {/* End date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.endDate')}</label>
                <input
                  type="date"
                  value={recurringForm.end_date}
                  onChange={(e) => setRecurringForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {recurringErrors.end_date && (
                  <p className="text-xs text-red-600 mt-1">{recurringErrors.end_date}</p>
                )}
              </div>

              {/* Instructor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.instructor')}</label>
                <select
                  value={recurringForm.instructor_id}
                  onChange={(e) => setRecurringForm((f) => ({ ...f, instructor_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t('scheduleModal.noInstructor')}</option>
                  {instructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Location */}
              {locations.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.location')}</label>
                  <select
                    value={recurringForm.location_id}
                    onChange={(e) => setRecurringForm((f) => ({ ...f, location_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Capacity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.capacity')}</label>
                <input
                  type="number"
                  min={1}
                  value={recurringForm.capacity}
                  onChange={(e) => setRecurringForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {recurringErrors.capacity && (
                  <p className="text-xs text-red-600 mt-1">{recurringErrors.capacity}</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.notes')}</label>
                <textarea
                  value={recurringForm.notes}
                  onChange={(e) => setRecurringForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  {t('scheduleModal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={recurringMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {recurringMutation.isPending ? t('scheduleModal.scheduling') : t('scheduleModal.scheduleClasses')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
