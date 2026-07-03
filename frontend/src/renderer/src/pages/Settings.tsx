import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { studioApi } from '../api/studio'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import type { StudioSettings, EmailSettings } from '../types'
import type { ApiError } from '../api/client'

type Tab = 'studio' | 'email'

export function SettingsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('studio')

  // Studio tab state
  const [form, setForm] = useState<Partial<StudioSettings>>({})
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Email tab state
  const [emailForm, setEmailForm] = useState<Partial<EmailSettings>>({})
  const [emailSaveSuccess, setEmailSaveSuccess] = useState(false)
  const [emailSaveError, setEmailSaveError] = useState<string | null>(null)
  const [testEmailMsg, setTestEmailMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [emailSettingsSaved, setEmailSettingsSaved] = useState(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['studio'],
    queryFn: () => studioApi.get(),
  })

  const { data: emailSettings, isLoading: emailLoading } = useQuery({
    queryKey: ['emailSettings'],
    queryFn: () => studioApi.getEmailSettings(),
  })

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  useEffect(() => {
    if (emailSettings) setEmailForm({ ...emailSettings, email_smtp_password: '' })
  }, [emailSettings])

  const updateMutation = useMutation({
    mutationFn: (data: Partial<StudioSettings>) => studioApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio'] })
      setSaveSuccess(true)
      setSaveError(null)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
    onError: (err: ApiError) => {
      setSaveError(err.message ?? t('settings.failedSave'))
      setSaveSuccess(false)
    },
  })

  const emailUpdateMutation = useMutation({
    mutationFn: (data: Partial<EmailSettings>) => studioApi.saveEmailSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailSettings'] })
      setEmailSaveSuccess(true)
      setEmailSaveError(null)
      setEmailSettingsSaved(true)
      setTimeout(() => setEmailSaveSuccess(false), 3000)
    },
    onError: (err: ApiError) => {
      setEmailSaveError(err.message ?? t('settings.failedSave'))
      setEmailSaveSuccess(false)
      setEmailSettingsSaved(false)
    },
  })

  const testEmailMutation = useMutation({
    mutationFn: () => studioApi.testEmail(),
    onSuccess: () => {
      setTestEmailMsg({ text: t('settings.testEmailSent'), ok: true })
      setTimeout(() => setTestEmailMsg(null), 4000)
    },
    onError: () => {
      setTestEmailMsg({ text: t('settings.testEmailFailed'), ok: false })
      setTimeout(() => setTestEmailMsg(null), 4000)
    },
  })

  const handleChange = (field: keyof StudioSettings, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleEmailChange = (field: keyof EmailSettings, value: string | number | boolean) => {
    setEmailForm((prev) => ({ ...prev, [field]: value }))
    setEmailSettingsSaved(false)
  }

  const handleSave = () => updateMutation.mutate(form)
  const handleEmailSave = () => emailUpdateMutation.mutate(emailForm)

  if (isLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>

  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-indigo-600 text-indigo-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <button className={tabClass('studio')} onClick={() => setActiveTab('studio')} role="tab" aria-selected={activeTab === 'studio'}>
            {t('settings.tabStudio')}
          </button>
          <button className={tabClass('email')} onClick={() => setActiveTab('email')} role="tab" aria-selected={activeTab === 'email'}>
            {t('settings.tabEmail')}
          </button>
        </nav>
      </div>

      {/* Studio Tab */}
      {activeTab === 'studio' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl">
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">{t('settings.sectionStudio')}</h3>
              <div className="space-y-3">
                <Field label={t('settings.studioName')}>
                  <input
                    type="text"
                    value={form.studio_name ?? ''}
                    onChange={(e) => handleChange('studio_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </Field>
                <Field label={t('settings.address')}>
                  <input
                    type="text"
                    value={form.address ?? ''}
                    onChange={(e) => handleChange('address', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </Field>
                <Field label={t('settings.timezone')}>
                  <input
                    type="text"
                    value={form.timezone ?? ''}
                    onChange={(e) => handleChange('timezone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t('settings.timezonePlaceholder')}
                  />
                </Field>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">{t('settings.sectionBookings')}</h3>
              <div className="space-y-3">
                <Field label={t('settings.cancellationWindow')}>
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
                    {t('settings.cancellationDeductsCredit')}
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
                    {t('settings.guestBookingsEnabled')}
                  </label>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">{t('settings.sectionCheckin')}</h3>
              <div className="space-y-3">
                <Field label={t('settings.checkinOpenBefore')}>
                  <input
                    type="number"
                    value={form.checkin_open_minutes_before ?? 0}
                    onChange={(e) => handleChange('checkin_open_minutes_before', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </Field>
                <Field label={t('settings.checkinCloseAfter')}>
                  <input
                    type="number"
                    value={form.checkin_close_minutes_after ?? 0}
                    onChange={(e) => handleChange('checkin_close_minutes_after', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </Field>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">{t('settings.sectionWaitlist')}</h3>
              <div className="space-y-3">
                <Field label={t('settings.waitlistConfirmWindow')}>
                  <input
                    type="number"
                    value={form.waitlist_confirm_minutes ?? 0}
                    onChange={(e) => handleChange('waitlist_confirm_minutes', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </Field>
                <Field label={t('settings.reminderHoursBefore')}>
                  <input
                    type="number"
                    value={form.reminder_hours_before ?? 0}
                    onChange={(e) => handleChange('reminder_hours_before', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </Field>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">{t('settings.sectionCalendar')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('settings.calendarStartHour')}>
                  <select
                    value={form.calendar_start_hour ?? 7}
                    onChange={(e) => handleChange('calendar_start_hour', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </Field>
                <Field label={t('settings.calendarEndHour')}>
                  <select
                    value={form.calendar_end_hour ?? 21}
                    onChange={(e) => handleChange('calendar_end_hour', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            {saveSuccess && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                {t('settings.savedSuccess')}
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
              {updateMutation.isPending ? t('settings.saving') : t('settings.saveSettings')}
            </button>
          </div>
        </div>
      )}

      {/* Email Tab */}
      {activeTab === 'email' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl">
          {emailLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">{t('settings.sectionEmail')}</h3>
                <div className="space-y-3">
                  <Field label={t('settings.emailFromName')}>
                    <input
                      type="text"
                      value={emailForm.email_from_name ?? ''}
                      onChange={(e) => handleEmailChange('email_from_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </Field>
                  <Field label={t('settings.emailFromAddress')}>
                    <input
                      type="email"
                      value={emailForm.email_from_address ?? ''}
                      onChange={(e) => handleEmailChange('email_from_address', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </Field>
                  <Field label={t('settings.smtpHost')}>
                    <input
                      type="text"
                      value={emailForm.email_smtp_host ?? ''}
                      onChange={(e) => handleEmailChange('email_smtp_host', e.target.value)}
                      placeholder={t('settings.smtpHostPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </Field>
                  <Field label={t('settings.smtpPort')}>
                    <input
                      type="number"
                      value={emailForm.email_smtp_port ?? 587}
                      onChange={(e) => handleEmailChange('email_smtp_port', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </Field>
                  <Field label={t('settings.smtpUser')}>
                    <input
                      type="text"
                      value={emailForm.email_smtp_user ?? ''}
                      onChange={(e) => handleEmailChange('email_smtp_user', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </Field>
                  <Field label={t('settings.smtpPassword')}>
                    <input
                      type="password"
                      value={emailForm.email_smtp_password ?? ''}
                      onChange={(e) => handleEmailChange('email_smtp_password', e.target.value)}
                      placeholder={t('settings.smtpPasswordPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </Field>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="email_smtp_tls"
                      checked={emailForm.email_smtp_tls ?? true}
                      onChange={(e) => handleEmailChange('email_smtp_tls', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="email_smtp_tls" className="text-sm text-gray-700">
                      {t('settings.smtpTls')}
                    </label>
                  </div>
                </div>
              </section>

              {emailSaveSuccess && (
                <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                  {t('settings.savedSuccess')}
                </div>
              )}
              {emailSaveError && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {emailSaveError}
                </div>
              )}
              {testEmailMsg && (
                <div className={`rounded-md p-3 text-sm ${testEmailMsg.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {testEmailMsg.text}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleEmailSave}
                  disabled={emailUpdateMutation.isPending}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {emailUpdateMutation.isPending ? t('settings.saving') : t('settings.saveSettings')}
                </button>
                <button
                  onClick={() => testEmailMutation.mutate()}
                  disabled={testEmailMutation.isPending || !emailSettingsSaved}
                  title={!emailSettingsSaved ? t('settings.saveBeforeTest') : undefined}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t('settings.sendTestEmail')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
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
