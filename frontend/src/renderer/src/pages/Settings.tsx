import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { studioApi } from '../api/studio'
import { billingApi } from '../api/billing'
import { smsApi } from '../api/sms'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import { StudioQRCode } from '../components/StudioQRCode'
import type { StudioSettings, EmailSettings } from '../types'
import type { ApiError } from '../api/client'

type Tab = 'studio' | 'email' | 'sms' | 'billing' | 'mobile'

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

  // SMS tab state
  const [smsForm, setSmsForm] = useState<{
    account_sid: string
    auth_token: string
    from_number: string
    enabled: boolean
  }>({ account_sid: '', auth_token: '', from_number: '', enabled: false })
  const [smsSaveSuccess, setSmsSaveSuccess] = useState(false)
  const [smsSaveError, setSmsSaveError] = useState<string | null>(null)
  const [smsSettingsSaved, setSmsSettingsSaved] = useState(false)
  const [smsTestPhone, setSmsTestPhone] = useState('')
  const [testSmsMsg, setTestSmsMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Mobile tab state
  const [mobileUrl, setMobileUrl] = useState('')
  const [mobileUrlSaved, setMobileUrlSaved] = useState(false)

  // Billing tab state
  const [billingForm, setBillingForm] = useState<{
    secret_key: string
    publishable_key: string
    webhook_secret: string
  }>({ secret_key: '', publishable_key: '', webhook_secret: '' })
  const [billingFieldErrors, setBillingFieldErrors] = useState<Partial<Record<'secret_key' | 'publishable_key', string>>>({})
  const [billingSaveSuccess, setBillingSaveSuccess] = useState(false)
  const [billingSaveError, setBillingSaveError] = useState<string | null>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['studio'],
    queryFn: () => studioApi.get(),
  })

  const { data: emailSettings, isLoading: emailLoading } = useQuery({
    queryKey: ['emailSettings'],
    queryFn: () => studioApi.getEmailSettings(),
  })

  const { data: smsSettings, isLoading: smsLoading } = useQuery({
    queryKey: ['smsSettings'],
    queryFn: () => smsApi.getSettings(),
  })

  const { data: billingStatus, isLoading: billingLoading } = useQuery({
    queryKey: ['billing-settings'],
    queryFn: () => billingApi.getSettings(),
    enabled: activeTab === 'billing',
  })

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  useEffect(() => {
    if (settings && !mobileUrl) {
      setMobileUrl(settings.tunnel_url || settings.lan_url || 'http://localhost:8000')
    }
  }, [settings])

  useEffect(() => {
    if (emailSettings) setEmailForm({ ...emailSettings, email_smtp_password: '' })
  }, [emailSettings])

  useEffect(() => {
    if (smsSettings) {
      setSmsForm({
        account_sid: smsSettings.sms_provider_account_sid ?? '',
        auth_token: '',
        from_number: smsSettings.sms_from_number ?? '',
        enabled: smsSettings.sms_enabled,
      })
    }
  }, [smsSettings])

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

  const mobileUrlMutation = useMutation({
    mutationFn: (url: string) => studioApi.update({ tunnel_url: url }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio'] })
      setMobileUrlSaved(true)
      setTimeout(() => setMobileUrlSaved(false), 3000)
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

  const smsUpdateMutation = useMutation({
    mutationFn: (data: {
      account_sid?: string
      auth_token?: string
      from_number?: string
      enabled?: boolean
    }) => smsApi.saveSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smsSettings'] })
      setSmsSaveSuccess(true)
      setSmsSaveError(null)
      setSmsSettingsSaved(true)
      setTimeout(() => setSmsSaveSuccess(false), 3000)
    },
    onError: (err: ApiError) => {
      setSmsSaveError(err.message ?? t('settings.failedSave'))
      setSmsSaveSuccess(false)
      setSmsSettingsSaved(false)
    },
  })

  const testSmsMutation = useMutation({
    mutationFn: () => smsApi.testSettings(smsTestPhone),
    onSuccess: () => {
      setTestSmsMsg({ text: t('sms.testSent'), ok: true })
      setTimeout(() => setTestSmsMsg(null), 4000)
    },
    onError: () => {
      setTestSmsMsg({ text: t('sms.testFailed'), ok: false })
      setTimeout(() => setTestSmsMsg(null), 4000)
    },
  })

  const handleChange = (field: keyof StudioSettings, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleEmailChange = (field: keyof EmailSettings, value: string | number | boolean) => {
    setEmailForm((prev) => ({ ...prev, [field]: value }))
    setEmailSettingsSaved(false)
  }

  const handleSmsChange = (
    field: keyof typeof smsForm,
    value: string | boolean
  ) => {
    setSmsForm((prev) => ({ ...prev, [field]: value }))
    setSmsSettingsSaved(false)
  }

  const billingSaveMutation = useMutation({
    mutationFn: (data: { secret_key: string; publishable_key: string; webhook_secret?: string }) =>
      billingApi.saveSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-settings'] })
      setBillingSaveSuccess(true)
      setBillingSaveError(null)
      setBillingForm((prev) => ({ ...prev, secret_key: '', webhook_secret: '' }))
      setTimeout(() => setBillingSaveSuccess(false), 3000)
    },
    onError: (err: ApiError) => {
      setBillingSaveError(err.message ?? t('settings.failedSave'))
      setBillingSaveSuccess(false)
    },
  })

  const handleSave = () => updateMutation.mutate(form)
  const handleEmailSave = () => emailUpdateMutation.mutate(emailForm)
  const handleSmsSave = () => smsUpdateMutation.mutate(smsForm)

  const handleBillingSave = () => {
    const billingSchema = z.object({
      secret_key: z.string().min(1, t('billing.secretKeyRequired')),
      publishable_key: z.string().min(1, t('billing.publishableKeyRequired')),
      webhook_secret: z.string().optional(),
    })
    const result = billingSchema.safeParse(billingForm)
    if (!result.success) {
      const fieldErrs: Partial<Record<'secret_key' | 'publishable_key', string>> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0] as 'secret_key' | 'publishable_key'
        if (field === 'secret_key' || field === 'publishable_key') {
          fieldErrs[field] = issue.message
        }
      }
      setBillingFieldErrors(fieldErrs)
      return
    }
    setBillingFieldErrors({})
    const { secret_key, publishable_key, webhook_secret } = result.data
    billingSaveMutation.mutate({
      secret_key,
      publishable_key,
      webhook_secret: webhook_secret || undefined,
    })
  }

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
          <button className={tabClass('sms')} onClick={() => setActiveTab('sms')} role="tab" aria-selected={activeTab === 'sms'}>
            {t('settings.tabSms')}
          </button>
          <button className={tabClass('billing')} onClick={() => setActiveTab('billing')} role="tab" aria-selected={activeTab === 'billing'}>
            {t('billing.tab')}
          </button>
          <button className={tabClass('mobile')} onClick={() => setActiveTab('mobile')} role="tab" aria-selected={activeTab === 'mobile'}>
            {t('settings.tabMobile')}
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
                <Field label={t('settings.lateCancelFee')}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.late_cancel_fee ?? 0}
                    onChange={(e) => handleChange('late_cancel_fee', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </Field>
                <Field label={t('settings.noShowFee')}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.no_show_fee ?? 0}
                    onChange={(e) => handleChange('no_show_fee', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </Field>
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
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">{t('settings.sectionColors')}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.primaryColor')}</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.primary_color ?? '#4f46e5'}
                      onChange={(e) => handleChange('primary_color', e.target.value)}
                      className="h-9 w-16 cursor-pointer rounded border border-gray-300 p-0.5"
                    />
                    <span className="text-sm text-gray-500 font-mono">{form.primary_color ?? '#4f46e5'}</span>
                    {form.primary_color && form.primary_color !== '#4f46e5' && (
                      <button
                        type="button"
                        onClick={() => handleChange('primary_color', '')}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        {t('settings.resetDefault')}
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.secondaryColor')}</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.secondary_color ?? '#10b981'}
                      onChange={(e) => handleChange('secondary_color', e.target.value)}
                      className="h-9 w-16 cursor-pointer rounded border border-gray-300 p-0.5"
                    />
                    <span className="text-sm text-gray-500 font-mono">{form.secondary_color ?? '#10b981'}</span>
                    {form.secondary_color && form.secondary_color !== '#10b981' && (
                      <button
                        type="button"
                        onClick={() => handleChange('secondary_color', '')}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        {t('settings.resetDefault')}
                      </button>
                    )}
                  </div>
                </div>
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

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl">
          {billingLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
                  {t('billing.connectionStatus')}
                </h3>
                {billingStatus?.stripe_connected ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      {t('billing.connected')}
                    </span>
                    {billingStatus.stripe_account_id && (
                      <span className="text-sm text-gray-500 font-mono">{billingStatus.stripe_account_id}</span>
                    )}
                  </div>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {t('billing.notConnected')}
                  </span>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
                  Stripe API Keys
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('billing.secretKey')}
                    </label>
                    <input
                      type="password"
                      value={billingForm.secret_key}
                      onChange={(e) => setBillingForm((prev) => ({ ...prev, secret_key: e.target.value }))}
                      placeholder={t('billing.secretKey')}
                      aria-label={t('billing.secretKey')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {billingFieldErrors.secret_key && (
                      <p className="mt-1 text-xs text-red-600">{billingFieldErrors.secret_key}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('billing.publishableKey')}
                    </label>
                    <input
                      type="text"
                      value={billingForm.publishable_key}
                      onChange={(e) => setBillingForm((prev) => ({ ...prev, publishable_key: e.target.value }))}
                      placeholder={t('billing.publishableKey')}
                      aria-label={t('billing.publishableKey')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {billingFieldErrors.publishable_key && (
                      <p className="mt-1 text-xs text-red-600">{billingFieldErrors.publishable_key}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('billing.webhookSecret')}
                    </label>
                    <input
                      type="password"
                      value={billingForm.webhook_secret}
                      onChange={(e) => setBillingForm((prev) => ({ ...prev, webhook_secret: e.target.value }))}
                      placeholder={t('billing.webhookSecret')}
                      aria-label={t('billing.webhookSecret')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">{t('billing.webhookSecretHint')}</p>
                  </div>
                </div>
              </section>

              {billingSaveSuccess && (
                <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                  {t('billing.savedSuccess')}
                </div>
              )}
              {billingSaveError && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {billingSaveError}
                </div>
              )}

              <button
                onClick={handleBillingSave}
                disabled={billingSaveMutation.isPending}
                className="px-6 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {billingSaveMutation.isPending ? t('settings.saving') : t('billing.save')}
              </button>
            </div>
          )}
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

      {/* SMS Tab */}
      {activeTab === 'sms' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl">
          {smsLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">{t('sms.settingsTitle')}</h3>
                <div className="space-y-3">
                  <Field label={t('sms.accountSid')}>
                    <input
                      type="text"
                      value={smsForm.account_sid}
                      onChange={(e) => handleSmsChange('account_sid', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </Field>
                  <Field label={t('sms.authToken')}>
                    <input
                      type="password"
                      value={smsForm.auth_token}
                      onChange={(e) => handleSmsChange('auth_token', e.target.value)}
                      placeholder={t('sms.authTokenPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </Field>
                  <Field label={t('sms.fromNumber')}>
                    <input
                      type="text"
                      value={smsForm.from_number}
                      onChange={(e) => handleSmsChange('from_number', e.target.value)}
                      placeholder={t('sms.fromNumberPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </Field>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="sms_enabled"
                      checked={smsForm.enabled}
                      onChange={(e) => handleSmsChange('enabled', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="sms_enabled" className="text-sm text-gray-700">
                      {t('sms.enabled')}
                    </label>
                  </div>
                </div>
              </section>

              <section>
                <Field label={t('sms.testPhone')}>
                  <input
                    type="tel"
                    value={smsTestPhone}
                    onChange={(e) => setSmsTestPhone(e.target.value)}
                    placeholder={t('sms.testPhonePlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </Field>
              </section>

              {smsSaveSuccess && (
                <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                  {t('sms.saved')}
                </div>
              )}
              {smsSaveError && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {smsSaveError}
                </div>
              )}
              {testSmsMsg && (
                <div className={`rounded-md p-3 text-sm ${testSmsMsg.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {testSmsMsg.text}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSmsSave}
                  disabled={smsUpdateMutation.isPending}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {smsUpdateMutation.isPending ? t('settings.saving') : t('settings.saveSettings')}
                </button>
                <button
                  onClick={() => testSmsMutation.mutate()}
                  disabled={testSmsMutation.isPending || !smsSettingsSaved || !smsTestPhone}
                  title={!smsSettingsSaved ? t('settings.saveBeforeTest') : undefined}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t('sms.sendTest')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Mobile Tab */}
      {activeTab === 'mobile' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl">
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-6">
              {/* URL editor */}
              <section>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-1">
                  {t('settings.mobileUrlLabel')}
                </h3>
                <p className="text-sm text-gray-500 mb-3">
                  {t('settings.mobileUrlHint', { ip: settings?.lan_url ?? 'http://localhost:8000' })}
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={mobileUrl}
                    onChange={(e) => setMobileUrl(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder={settings?.lan_url ?? 'http://192.168.x.x:8000'}
                  />
                  <button
                    onClick={() => mobileUrlMutation.mutate(mobileUrl)}
                    disabled={mobileUrlMutation.isPending}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {mobileUrlSaved ? t('settings.mobileUrlSaved') : t('settings.mobileUrlSave')}
                  </button>
                </div>
              </section>

              {/* QR code */}
              <section className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-1">
                  {t('settings.mobileTitle')}
                </h3>
                <p className="text-sm text-gray-500 mb-6">{t('settings.mobileSubtitle')}</p>
                <StudioQRCode
                  studioName={settings?.studio_name ?? 'Agon Studio'}
                  studioUrl={mobileUrl || settings?.lan_url || 'http://localhost:8000'}
                />
              </section>

              <section className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
                  {t('settings.mobileHowToShare')}
                </h3>
                <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
                  <li>{t('settings.mobileStep1')}</li>
                  <li>{t('settings.mobileStep2')}</li>
                  <li>{t('settings.mobileStep3')}</li>
                </ol>
              </section>
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
