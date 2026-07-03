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
import { studioApi } from '../api/studio'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import { ScheduleClassModal } from '../components/ScheduleClassModal'
import { EditClassModal } from '../components/EditClassModal'
import type { ScheduledClass, ClassTemplate } from '../types'

type ZoomLevel = '1h' | '30m' | '15m'
const ZOOM_ROW_H: Record<ZoomLevel, number> = { '1h': 56, '30m': 112, '15m': 224 }
const ZOOM_SUBLINES: Record<ZoomLevel, number[]> = {
  '1h': [],
  '30m': [30],
  '15m': [15, 30, 45],
}

interface TooltipState {
  cls: ScheduledClass
  x: number
  y: number
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

function getEventTop(startsAt: string, rowH: number, gridStart: number): number {
  const d = new Date(startsAt)
  const mins = d.getHours() * 60 + d.getMinutes()
  return ((mins - gridStart * 60) / 60) * rowH
}

function getEventHeight(startsAt: string, endsAt: string, rowH: number): number {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const durationMins = (end.getTime() - start.getTime()) / 60000
  return Math.max((durationMins / 60) * rowH, 2)
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

function formatSubHour(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function CalendarPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const gridRef = useRef<HTMLDivElement>(null)

  const [weekBase, setWeekBase] = useState(new Date())
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduleDefaultDate, setScheduleDefaultDate] = useState<Date | undefined>()
  const [editModalClass, setEditModalClass] = useState<ScheduledClass | null>(null)
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null)
  const [zoom, setZoom] = useState<ZoomLevel>('1h')
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const rowH = ZOOM_ROW_H[zoom]
  const subLines = ZOOM_SUBLINES[zoom]

  const { data: studioSettings } = useQuery({
    queryKey: ['studio'],
    queryFn: studioApi.get,
    staleTime: 5 * 60 * 1000,
  })

  const gridStart = studioSettings?.calendar_start_hour ?? 7
  const gridEnd = studioSettings?.calendar_end_hour ?? 21
  const hours = Array.from({ length: Math.max(gridEnd - gridStart, 1) }, (_, i) => i + gridStart)

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
    queryFn: () => instructorsApi.list(),
  })

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list(false),
  })

  const templateMap: Record<number, ClassTemplate> = {}
  if (templates) for (const tpl of templates) templateMap[tpl.id] = tpl

  const instructorMap: Record<number, string> = {}
  if (instructors) for (const ins of instructors) instructorMap[ins.id] = ins.full_name

  const locationMap: Record<number, string> = {}
  if (locations) for (const loc of locations) locationMap[loc.id] = loc.name

  // Scroll grid to 8:00 on mount and when zoom changes
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollTop = rowH
    }
  }, [rowH])

  const cancelMutation = useMutation({
    mutationFn: (id: number) => classesApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
    },
  })

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

              {/* Zoom controls */}
              <div className="flex items-center border border-gray-200 rounded-md overflow-hidden ml-2">
                {(['15m', '30m', '1h'] as ZoomLevel[]).map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoom(z)}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                      zoom === z
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                    title={t(`calendar.zoom${z}`)}
                  >
                    {z}
                  </button>
                ))}
              </div>
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
                    <option value="">{t('calendar.allEstablishments')}</option>
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
              <div className="flex" style={{ height: `${hours.length * rowH}px`, minHeight: `${hours.length * rowH}px` }}>
                {/* Time labels */}
                <div className="w-11 flex-shrink-0 relative">
                  {hours.map((h) => (
                    <div key={h}>
                      <div
                        className="absolute w-full text-right pr-2"
                        style={{ top: `${(h - gridStart) * rowH - 8}px` }}
                      >
                        <span className="text-[10px] text-gray-400">{formatHour(h)}</span>
                      </div>
                      {subLines.map((m) => (
                        <div
                          key={`${h}-${m}`}
                          className="absolute w-full text-right pr-2"
                          style={{ top: `${(h - gridStart) * rowH + (m / 60) * rowH - 7}px` }}
                        >
                          <span className="text-[9px] text-gray-300">{formatSubHour(h, m)}</span>
                        </div>
                      ))}
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
                      {/* Hour lines + sub-lines */}
                      {hours.map((h) => (
                        <div key={h}>
                          <div
                            className="absolute left-0 right-0 border-t border-gray-100 cursor-pointer hover:bg-indigo-50/30 transition-colors"
                            style={{ top: `${(h - gridStart) * rowH}px`, height: `${rowH}px` }}
                            onClick={() => handleSlotClick(day, h)}
                          />
                          {subLines.map((m) => (
                            <div
                              key={`${h}-${m}`}
                              className="absolute left-0 right-0 border-t border-gray-50 pointer-events-none"
                              style={{ top: `${(h - gridStart) * rowH + (m / 60) * rowH}px` }}
                            />
                          ))}
                        </div>
                      ))}

                      {/* Events */}
                      {dayClasses.map((cls) => {
                        const tpl = templateMap[cls.template_id]
                        const color = tpl?.color ?? '#4F46E5'
                        const rgb = hexToRgb(color)
                        const top = getEventTop(cls.starts_at, rowH, gridStart)
                        const height = getEventHeight(cls.starts_at, cls.ends_at, rowH)
                        const label = tpl?.name ?? `#${cls.id}`
                        const showText = height >= 16
                        const showSecondary = height >= 32

                        return (
                          <button
                            key={cls.id}
                            onClick={(e) => { e.stopPropagation(); setEditModalClass(cls); setTooltip(null) }}
                            onMouseEnter={(e) => setTooltip({ cls, x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setTooltip(null)}
                            className="absolute left-1 right-1 rounded-md text-left transition-all overflow-hidden"
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              background: `rgba(${rgb}, 0.12)`,
                              borderLeft: `3px solid ${color}`,
                              color: color,
                            }}
                          >
                            {showText && (
                              <div className="px-1.5 py-0.5">
                                <div className="text-[11px] font-semibold leading-tight truncate">
                                  {label}
                                </div>
                                {showSecondary && (
                                  <div className="text-[10px] opacity-70 leading-tight truncate">
                                    {format(new Date(cls.starts_at), 'HH:mm')}
                                    {cls.instructor_id && instructorMap[cls.instructor_id]
                                      ? ` · ${instructorMap[cls.instructor_id].split(' ')[0]}`
                                      : ''}
                                  </div>
                                )}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Hover tooltip ── */}
      {tooltip && (() => {
        const cls = tooltip.cls
        const tpl = templateMap[cls.template_id]
        const color = tpl?.color ?? '#4F46E5'
        const instructorName = cls.instructor_id ? instructorMap[cls.instructor_id] : null
        const locationName = cls.location_id ? locationMap[cls.location_id] : null

        // Keep tooltip inside viewport horizontally
        const tipW = 200
        const x = tooltip.x + 12 + tipW > window.innerWidth
          ? tooltip.x - tipW - 8
          : tooltip.x + 12

        return (
          <div
            className="fixed z-50 pointer-events-none"
            style={{ left: x, top: tooltip.y - 8 }}
          >
            <div
              className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-50 text-xs"
              style={{ width: tipW, borderLeft: `3px solid ${color}` }}
            >
              <div className="font-semibold text-gray-900 mb-1.5" style={{ color }}>
                {tpl?.name ?? `#${cls.id}`}
              </div>
              <div className="space-y-1 text-gray-600">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {format(new Date(cls.starts_at), 'HH:mm')} – {format(new Date(cls.ends_at), 'HH:mm')}
                </div>
                {instructorName && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {instructorName}
                  </div>
                )}
                {locationName && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {locationName}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t('calendar.capacityLabel')}: {cls.capacity}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

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
          onCancelClass={() => setCancelConfirmId(editModalClass.id)}
        />
      )}

      {/* Cancel confirmation modal */}
      {cancelConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setCancelConfirmId(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              {t('calendar.cancelConfirmTitle')}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {t('calendar.cancelConfirmBody')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCancelConfirmId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                {t('calendar.cancelConfirmNo')}
              </button>
              <button
                onClick={() => {
                  cancelMutation.mutate(cancelConfirmId)
                  setCancelConfirmId(null)
                  setEditModalClass(null)
                }}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {t('calendar.cancelConfirmYes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
