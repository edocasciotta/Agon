import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, startOfWeek as startOfWeekFn, endOfWeek } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import { classesApi } from '../api/classes'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import type { ScheduledClass } from '../types'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS },
})

interface CalendarEvent {
  id: number
  title: string
  start: Date
  end: Date
  resource: ScheduledClass
}

export function CalendarPage() {
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const weekStart = format(startOfWeekFn(currentDate), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(currentDate), 'yyyy-MM-dd')

  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes', weekStart, weekEnd],
    queryFn: () => classesApi.list({ start_date: weekStart, end_date: weekEnd }),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => classesApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      setSelectedEvent(null)
    },
    onError: () => {
      setCancelError('Failed to cancel class. Please try again.')
    },
  })

  const events: CalendarEvent[] = (classes ?? []).map((cls) => ({
    id: cls.id,
    title: `Class #${cls.id}`,
    start: new Date(cls.starts_at),
    end: new Date(cls.ends_at),
    resource: cls,
  }))

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setCancelError(null)
  }

  const handleNavigate = (date: Date) => {
    setCurrentDate(date)
    setSelectedEvent(null)
  }

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Weekly class schedule" />
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <BigCalendar
            localizer={localizer}
            events={events}
            defaultView="week"
            views={['week', 'day']}
            date={currentDate}
            onNavigate={handleNavigate}
            onSelectEvent={handleSelectEvent}
            style={{ height: 500 }}
          />
        </div>
      )}

      {selectedEvent && (
        <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-2">{selectedEvent.title}</h3>
          <div className="text-sm text-gray-600 space-y-1 mb-4">
            <p>Start: {format(selectedEvent.start, 'PPpp')}</p>
            <p>End: {format(selectedEvent.end, 'PPpp')}</p>
            <p>Status: {selectedEvent.resource.status}</p>
            <p>Capacity: {selectedEvent.resource.capacity}</p>
            {selectedEvent.resource.notes && <p>Notes: {selectedEvent.resource.notes}</p>}
          </div>
          {cancelError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200 mb-3">{cancelError}</div>
          )}
          {selectedEvent.resource.status === 'scheduled' && (
            <button
              onClick={() => cancelMutation.mutate(selectedEvent.id)}
              disabled={cancelMutation.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Class'}
            </button>
          )}
          <button
            onClick={() => setSelectedEvent(null)}
            className="ml-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
