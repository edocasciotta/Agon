import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { instructorsApi } from '../../api/instructors'
import { instructorAvailabilityApi } from '../../api/instructorAvailability'
import { useAuthStore } from '../../store/authStore'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { resolveApiError } from '../../lib/errorMessages'

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const

export function AvailabilityTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isManager = user?.role === 'manager'

  const [selectedInstructorId, setSelectedInstructorId] = useState<number | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [newWindow, setNewWindow] = useState<Record<number, { start: string; end: string }>>({})

  const { data: instructors = [], isLoading: instructorsLoading } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => instructorsApi.list(),
    enabled: isManager,
  })

  // Instructor role: self-service, scoped to their own instructor record only
  // (mirrors the backend's own require_staff + _assert_can_manage restriction
  // in instructor_availability.py — there is no other instructor-self-service
  // UI precedent in this codebase, so this page establishes the convention).
  const selfInstructor = instructors.find((i) => i.user_id === user?.id)

  useEffect(() => {
    if (isManager && instructors.length > 0 && selectedInstructorId === null) {
      setSelectedInstructorId(instructors[0].id)
    }
    if (!isManager && user?.role === 'instructor' && selfInstructor) {
      setSelectedInstructorId(selfInstructor.id)
    }
  }, [isManager, instructors, selectedInstructorId, user, selfInstructor])

  const { data: availability = [], isLoading: availabilityLoading } = useQuery({
    queryKey: ['instructor-availability', selectedInstructorId],
    queryFn: () => instructorAvailabilityApi.list(selectedInstructorId ?? undefined),
    enabled: selectedInstructorId !== null,
  })

  const createMutation = useMutation({
    mutationFn: instructorAvailabilityApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['instructor-availability'] })
      setApiError(null)
    },
    onError: (err: unknown) => {
      setApiError(resolveApiError(err, t('instructorAvailability.failedAdd')))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => instructorAvailabilityApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['instructor-availability'] })
      setApiError(null)
    },
    onError: (err: unknown) => {
      setApiError(resolveApiError(err, t('instructorAvailability.failedRemove')))
    },
  })

  if (!isManager && user?.role !== 'instructor') {
    return (
      <p className="text-sm text-gray-500">{t('instructorAvailability.noAccess')}</p>
    )
  }

  if (instructorsLoading && isManager) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const dayLabel = (day: number): string =>
    t(`instructorAvailability.day${day}`)

  function handleAddWindow(day: number) {
    if (selectedInstructorId === null) return
    const win = newWindow[day]
    if (!win?.start || !win?.end) return
    if (win.end <= win.start) {
      setApiError(t('instructorAvailability.invalidWindow'))
      return
    }
    createMutation.mutate({
      instructor_id: selectedInstructorId,
      day_of_week: day,
      start_time: `${win.start}:00`,
      end_time: `${win.end}:00`,
    })
    setNewWindow((prev) => ({ ...prev, [day]: { start: '', end: '' } }))
  }

  return (
    <div>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('instructorAvailability.instructor')}
        </label>
        {isManager ? (
          <select
            value={selectedInstructorId ?? ''}
            onChange={(e) => setSelectedInstructorId(Number(e.target.value))}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {instructors.length === 0 && (
              <option value="">{t('instructorAvailability.noInstructors')}</option>
            )}
            {instructors.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.full_name}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-gray-600">{selfInstructor?.full_name}</p>
        )}
      </div>

      {apiError && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      {selectedInstructorId === null ? (
        <p className="text-sm text-gray-500">{t('instructorAvailability.selectInstructor')}</p>
      ) : availabilityLoading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="space-y-3">
          {DAYS.map((day) => {
            const windowsForDay = availability.filter((a) => a.day_of_week === day)
            return (
              <div
                key={day}
                className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">{dayLabel(day)}</h3>
                </div>

                {windowsForDay.length === 0 && (
                  <p className="text-xs text-gray-400">{t('instructorAvailability.noWindows')}</p>
                )}

                {windowsForDay.map((win) => (
                  <div
                    key={win.id}
                    className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2"
                  >
                    <span className="text-sm text-gray-700">
                      {win.start_time.slice(0, 5)} – {win.end_time.slice(0, 5)}
                    </span>
                    <button
                      onClick={() => deleteMutation.mutate(win.id)}
                      disabled={deleteMutation.isPending}
                      aria-label={t('instructorAvailability.removeWindow')}
                      className="text-gray-400 hover:text-red-600 text-sm px-2 disabled:opacity-50"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="time"
                    value={newWindow[day]?.start ?? ''}
                    onChange={(e) =>
                      setNewWindow((prev) => ({
                        ...prev,
                        [day]: { start: e.target.value, end: prev[day]?.end ?? '' },
                      }))
                    }
                    aria-label={t('instructorAvailability.startTime')}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-gray-400 text-sm">–</span>
                  <input
                    type="time"
                    value={newWindow[day]?.end ?? ''}
                    onChange={(e) =>
                      setNewWindow((prev) => ({
                        ...prev,
                        [day]: { start: prev[day]?.start ?? '', end: e.target.value },
                      }))
                    }
                    aria-label={t('instructorAvailability.endTime')}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => handleAddWindow(day)}
                    disabled={createMutation.isPending}
                    className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                  >
                    {t('instructorAvailability.addWindow')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
