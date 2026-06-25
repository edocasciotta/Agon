import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { studioApi } from '../api/studio'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import type { StudioSettings } from '../types'
import type { ApiError } from '../api/client'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<Partial<StudioSettings>>({})
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['studio'],
    queryFn: () => studioApi.get(),
  })

  useEffect(() => {
    if (settings) {
      setForm(settings)
    }
  }, [settings])

  const updateMutation = useMutation({
    mutationFn: (data: Partial<StudioSettings>) => studioApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio'] })
      setSaveSuccess(true)
      setSaveError(null)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
    onError: (err: ApiError) => {
      setSaveError(err.message ?? 'Failed to save settings')
      setSaveSuccess(false)
    },
  })

  const handleChange = (field: keyof StudioSettings, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    updateMutation.mutate(form)
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>

  return (
    <div>
      <PageHeader title="Settings" subtitle="Studio configuration" />
      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl">
        <div className="space-y-6">
          {/* Studio Info */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Studio</h3>
            <div className="space-y-3">
              <Field label="Studio Name">
                <input
                  type="text"
                  value={form.studio_name ?? ''}
                  onChange={(e) => handleChange('studio_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
              <Field label="Address">
                <input
                  type="text"
                  value={form.address ?? ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
              <Field label="Timezone">
                <input
                  type="text"
                  value={form.timezone ?? ''}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Europe/London"
                />
              </Field>
            </div>
          </section>

          {/* Booking / Cancellation */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Bookings & Cancellations</h3>
            <div className="space-y-3">
              <Field label="Cancellation Window (hours)">
                <input
                  type="number"
                  value={form.cancellation_hours ?? 0}
                  onChange={(e) => handleChange('cancellation_hours', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cancellation_deducts_credit"
                  checked={form.cancellation_deducts_credit ?? false}
                  onChange={(e) => handleChange('cancellation_deducts_credit', e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="cancellation_deducts_credit" className="text-sm text-gray-700">
                  Cancellation deducts credit
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="guest_bookings_enabled"
                  checked={form.guest_bookings_enabled ?? false}
                  onChange={(e) => handleChange('guest_bookings_enabled', e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="guest_bookings_enabled" className="text-sm text-gray-700">
                  Guest bookings enabled
                </label>
              </div>
            </div>
          </section>

          {/* Check-in */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Check-in</h3>
            <div className="space-y-3">
              <Field label="Open minutes before class">
                <input
                  type="number"
                  value={form.checkin_open_minutes_before ?? 0}
                  onChange={(e) => handleChange('checkin_open_minutes_before', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
              <Field label="Close minutes after class">
                <input
                  type="number"
                  value={form.checkin_close_minutes_after ?? 0}
                  onChange={(e) => handleChange('checkin_close_minutes_after', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
            </div>
          </section>

          {/* Waitlist & Notifications */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Waitlist & Notifications</h3>
            <div className="space-y-3">
              <Field label="Waitlist confirm window (minutes)">
                <input
                  type="number"
                  value={form.waitlist_confirm_minutes ?? 0}
                  onChange={(e) => handleChange('waitlist_confirm_minutes', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
              <Field label="Reminder hours before class">
                <input
                  type="number"
                  value={form.reminder_hours_before ?? 0}
                  onChange={(e) => handleChange('reminder_hours_before', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
            </div>
          </section>

          {/* Status Messages */}
          {saveSuccess && (
            <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              Settings saved successfully.
            </div>
          )}
          {saveError && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {saveError}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
