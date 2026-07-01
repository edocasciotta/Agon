import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  isSameDay,
  isToday,
} from 'date-fns'
import { classesApi } from '../api/classes'
import { classTemplatesApi } from '../api/classTemplates'
import { instructorsApi } from '../api/instructors'
import { locationsApi } from '../api/locations'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import { ScheduleClassModal } from '../components/ScheduleClassModal'
import { EditClassModal } from '../components/EditClassModal'
import type { ScheduledClass, ClassTemplate } from '../types'

// Grid configuration
const GRID_START = 7   // 7:00
const GRID_END = 21    // 21:00
const ROW_H = 56       // px per hour
const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, i) => i + GRID_START)

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

function getEventTop(startsAt: string): number {
  const d = new Date(startsAt)
  const mins = d.getHours() * 60 + d.getMinutes()
  return ((mins - GRID_START * 60) / 60) * ROW_H
}

function getEventHeight(startsAt: string, endsAt: string): number {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const durationMins = (end.getTime() - start.getTime()) / 60000
  return Math.max((durationMins / 60) * ROW_H, 24)
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

export function CalendarPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const gridRef = useRef<HTMLDivElement>(null)

  const [weekBase, setWeekBase] = useState(new Date())
  const [selectedClass, setSelectedClass] = useState<ScheduledClass | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduleDefaultDate, setScheduleDefaultDate] = useState<Date | undefined>()
  const [editModalClass, setEditModalClass] = useState<ScheduledClass | null>(null)

  // Active filters
  const [filterLocation, setFilterLocation] = useState<number | null>(null)
  const [filterInstructor, setFilterInstructor] = useState<number | null>(null)
  const [filterTemplate, setFilterTemplate] = useState<number | null>(null)

  const weekStart = startOfWeek(weekBase, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(weekBase, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'), filterLocation, filterInstructor, filterTemplate],
    queryFn: () =>
      classesApi.list({
        start_date: format(weekStart, 'yyyy-MM-dd'),
        end_date: format(weekEnd, 'yyyy-MM-dd'),
        ...(filterLocation != null && { location_id: filterLocation }),
        ...(filterInstructor != null && { instructor_id: filterInstructor }),
        ...(filterTemplate != null && { template_id: filterTemplate }),
      }),
  })

  const { data: templates } = useQuery({
    queryKey: ['class-templates'],
    queryFn: classTemplatesApi.list,
  })

  const { data: instructors } = useQuery({
    queryKey: ['instructors'],
    queryFn: instructorsApi.list,
  })

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list(false),
  })

  const templateMap: Record<number, ClassTemplate> = {}
  if (templates) for (const tpl of templates) templateMap[tpl.id] = tpl

  const instructorMap: Record<number, string> = {}
  if (instructors) for (const ins of instructors) instructorMap[ins.id] = ins.full_name

  // Scroll grid to 8:00 on mount
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollTop = ROW_H
    }
  }, [])

  const cancelMutation = useMutation({
    mutationFn: (id: number) => classesApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      setSelectedClass(null)
      setActionError(null)
    },
    onError: () => setActionError(t('calendar.cancelError')),
  })

  const handleSelectClass = (cls: ScheduledClass) => {
    setSelectedClass(cls)
    setActionError(null)
  }

  const handleSlotClick = (day: Date, hour: number) => {
    const d = new Date(day)
    d.setHours(hour, 0, 0, 0)
    setScheduleDefaultDate(d)
    setScheduleModalOpen(true)
  }

  // Only show non-cancelled classes on the grid
  const visibleClasses = (classes ?? []).filter((c) => c.status !== 'cancelled')

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={t('calendar.title')}
        subtitle={t('calendar.subtitle')}
        action={
          <button
            onClick={() => { setScheduleDefaultDate(undefined); setScheduleModalOpen(true) }}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
          >
            {t('calendar.scheduleClass')}
          </button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="flex gap-4 min-h-0 flex-1">
          {/* ── Calendar grid ── */}
          <div className="flex-1 min-w-0 border border-gray-200 rounded-xl overflow-hidden bg-white flex flex-col">
            {/* Week navigation header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <button
                onClick={() => setWeekBase((d) => subWeeks(d, 1))}
                className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 transition-colors"
                aria-label="Previous week"
              >
                ‹
              </button>
              <span className="flex-1 text-center text-sm font-medium text-gray-700">
                {format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')}
              </span>
              <button
                onClick={() => setWeekBase(new Date())}
                className="px-2.5 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setWeekBase((d) => addWeeks(d, 1))}
                className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 transition-colors"
                aria-label="Next week"
              >
                ›
              </button>
            </div>

            {/* Filter bar */}
            {((locations && locations.length > 1) || (instructors && instructors.length > 0) || (templates && templates.length > 0)) && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-white flex-wrap">
                {locations && locations.length > 1 && (
                  <select
                    value={filterLocation ?? ''}
                    onChange={(e) => setFilterLocation(e.target.value ? Number(e.target.value) : null)}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                  >
                    <option value="">{t('calendar.allLocations')}</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                )}
                {instructors && instructors.length > 0 && (
                  <select
                    value={filterInstructor ?? ''}
                    onChange={(e) => setFilterInstructor(e.target.value ? Number(e.target.value) : null)}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                  >
                    <option value="">{t('calendar.allInstructors')}</option>
                    {instructors.map((ins) => (
                      <option key={ins.id} value={ins.id}>{ins.full_name}</option>
                    ))}
                  </select>
                )}
                {templates && templates.length > 0 && (
                  <select
                    value={filterTemplate ?? ''}
                    onChange={(e) => setFilterTemplate(e.target.value ? Number(e.target.value) : null)}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                  >
                    <option value="">{t('calendar.allClassTypes')}</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                    ))}
                  </select>
                )}
                {(filterLocation != null || filterInstructor != null || filterTemplate != null) && (
                  <button
                    onClick={() => { setFilterLocation(null); setFilterInstructor(null); setFilterTemplate(null) }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-1"
                  >
                    {t('calendar.clearFilters')}
                  </button>
                )}
              </div>
            )}

            {/* Day column headers */}
            <div className="flex border-b border-gray-100" style={{ paddingLeft: '44px' }}>
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className="flex-1 py-2 text-center border-l border-gray-100 first:border-l-0"
                >
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                    {format(day, 'EEE')}
                  </div>
                  <div
                    className={`text-lg font-semibold leading-tight ${
                      isToday(day) ? 'text-indigo-600' : 'text-gray-800'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
            </div>

            {/* Scrollable time grid */}
            <div ref={gridRef} className="flex-1 overflow-y-auto">
              <div className="flex" style={{ height: `${HOURS.length * ROW_H}px`, minHeight: `${HOURS.length * ROW_H}px` }}>
                {/* Time labels */}
                <div className="w-11 flex-shrink-0 relative">
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute w-full text-right pr-2"
                      style={{ top: `${(h - GRID_START) * ROW_H - 8}px` }}
                    >
                      <span className="text-[10px] text-gray-400">{formatHour(h)}</span>
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {days.map((day) => {
                  const dayClasses = visibleClasses.filter((c) =>
                    isSameDay(new Date(c.starts_at), day)
                  )
                  return (
                    <div
                      key={day.toISOString()}
                      className="flex-1 relative border-l border-gray-100 first:border-l-0"
                    >
                      {/* Hour lines */}
                      {HOURS.map((h) => (
                        <div
                          key={h}
                          className="absolute left-0 right-0 border-t border-gray-100 cursor-pointer hover:bg-indigo-50/30 transition-colors"
                          style={{ top: `${(h - GRID_START) * ROW_H}px`, height: `${ROW_H}px` }}
                          onClick={() => handleSlotClick(day, h)}
                        />
                      ))}

                      {/* Events */}
                      {dayClasses.map((cls) => {
                        const tpl = templateMap[cls.template_id]
                        const color = tpl?.color ?? '#4F46E5'
                        const rgb = hexToRgb(color)
                        const isSelected = selectedClass?.id === cls.id
                        const top = getEventTop(cls.starts_at)
                        const height = getEventHeight(cls.starts_at, cls.ends_at)

                        return (
                          <button
                            key={cls.id}
                            onClick={(e) => { e.stopPropagation(); handleSelectClass(cls) }}
                            className="absolute left-1 right-1 rounded-md text-left transition-all overflow-hidden"
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              background: `rgba(${rgb}, 0.12)`,
                              borderLeft: `3px solid ${color}`,
                              color: color,
                              outline: isSelected ? `2px solid ${color}` : 'none',
                              outlineOffset: '1px',
                            }}
                          >
                            <div className="px-1.5 py-1">
                              <div className="text-[11px] font-semibold leading-tight truncate">
                                {tpl?.name ?? `#${cls.id}`}
                              </div>
                              {height >= 36 && (
                                <div className="text-[10px] opacity-70 leading-tight truncate">
                                  {format(new Date(cls.starts_at), 'HH:mm')}
                                  {cls.instructor_id && instructorMap[cls.instructor_id]
                                    ? ` · ${instructorMap[cls.instructor_id].split(' ')[0]}`
                                    : ''}
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Detail panel ── */}
          {selectedClass && (() => {
            const tpl = templateMap[selectedClass.template_id]
            const color = tpl?.color ?? '#4F46E5'
            const rgb = hexToRgb(color)
            const instructorName = selectedClass.instructor_id
              ? instructorMap[selectedClass.instructor_id]
              : null
            const locationName = locations?.find((l) => l.id === selectedClass.location_id)?.name

            return (
              <div className="w-60 flex-shrink-0 border border-gray-200 rounded-xl bg-white flex flex-col overflow-hidden">
                {/* Color bar */}
                <div className="h-1 w-full" style={{ background: color }} />

                {/* Header */}
                <div className="px-4 pt-3 pb-3 border-b border-gray-100">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">
                    {t('calendar.statusLabel')}:{' '}
                    <span
                      className="font-semibold"
                      style={{ color }}
                    >
                      {selectedClass.status}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 leading-tight">
                    {tpl?.name ?? `#${selectedClass.id}`}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {format(new Date(selectedClass.starts_at), 'EEE d MMM · HH:mm')}
                    {' – '}
                    {format(new Date(selectedClass.ends_at), 'HH:mm')}
                  </p>
                </div>

                {/* Info rows */}
                <div className="px-4 py-3 flex flex-col gap-2.5 flex-1">
                  {instructorName && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>{instructorName}</span>
                    </div>
                  )}
                  {locationName && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{locationName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>
                      {t('calendar.capacityLabel')}: {selectedClass.capacity}
                    </span>
                  </div>
                  {selectedClass.notes && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-2 py-1.5">
                      {selectedClass.notes}
                    </div>
                  )}

                  {actionError && (
                    <div className="text-xs text-red-600 bg-red-50 rounded-md px-2 py-2 border border-red-100">
                      {actionError}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-3 pb-3 flex flex-col gap-2">
                  {selectedClass.status === 'scheduled' && (
                    <>
                      <button
                        onClick={() => { setEditModalClass(selectedClass); setSelectedClass(null); setActionError(null) }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors"
                      >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        {t('calendar.editClass')}
                      </button>
                      <button
                        onClick={() => cancelMutation.mutate(selectedClass.id)}
                        disabled={cancelMutation.isPending}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors"
                      >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        {cancelMutation.isPending ? t('calendar.cancelling') : t('calendar.cancelClass')}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { setSelectedClass(null); setActionError(null) }}
                    className="w-full px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    {t('calendar.closePanel')}
                  </button>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      <ScheduleClassModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['classes'] })}
        defaultDate={scheduleDefaultDate}
      />

      {editModalClass && (
        <EditClassModal
          isOpen={true}
          onClose={() => setEditModalClass(null)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['classes'] })}
          editClass={editModalClass}
        />
      )}
    </div>
  )
}
