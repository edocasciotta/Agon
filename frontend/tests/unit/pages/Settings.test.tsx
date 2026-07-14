import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SettingsPage } from '../../../src/renderer/src/pages/Settings'

vi.mock('../../../src/renderer/src/api/billing', () => ({
  billingApi: {
    getSettings: vi.fn().mockResolvedValue({
      stripe_connected: true,
      stripe_account_id: 'acct_test123',
      publishable_key: 'pk_test_abc',
    }),
    saveSettings: vi.fn().mockResolvedValue({ status: 'ok', stripe_account_id: 'acct_test123' }),
  },
}))

vi.mock('../../../src/renderer/src/api/studio', () => ({
  studioApi: {
    get: vi.fn().mockResolvedValue({
      id: 1,
      studio_name: 'Test Studio',
      address: '123 Main St',
      timezone: 'UTC',
      cancellation_hours: 24,
      cancellation_deducts_credit: false,
      checkin_open_minutes_before: 15,
      checkin_close_minutes_after: 15,
      waitlist_confirm_minutes: 30,
      guest_bookings_enabled: false,
      self_service_purchases_enabled: false,
      reminder_hours_before: 24,
      stripe_connected: false,
      lan_url: 'http://192.168.30.50:8000',
    }),
    update: vi.fn().mockResolvedValue({}),
    getEmailSettings: vi.fn().mockResolvedValue({
      email_from_name: 'Test Studio',
      email_from_address: 'studio@example.com',
      email_smtp_host: 'smtp.gmail.com',
      email_smtp_port: 587,
      email_smtp_user: 'user@example.com',
      email_smtp_password: '***',
      email_smtp_tls: true,
    }),
    saveEmailSettings: vi.fn().mockResolvedValue({}),
    testEmail: vi.fn().mockResolvedValue({ message: 'sent' }),
  },
}))

vi.mock('../../../src/renderer/src/api/sms', () => ({
  smsApi: {
    getSettings: vi.fn().mockResolvedValue({
      sms_provider_account_sid: 'AC123',
      sms_provider_auth_token: '***',
      sms_from_number: '+15551234567',
      sms_enabled: false,
    }),
    saveSettings: vi.fn().mockResolvedValue({}),
    testSettings: vi.fn().mockResolvedValue({ message: 'sent' }),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SettingsPage', () => {
  it('renders Studio and Email tabs', async () => {
    renderPage()
    expect(await screen.findByRole('tab', { name: /studio/i })).toBeTruthy()
    expect(await screen.findByRole('tab', { name: /email/i })).toBeTruthy()
  })

  it('shows studio settings by default', async () => {
    renderPage()
    expect(await screen.findByRole('tab', { name: /studio/i })).toBeTruthy()
    expect(await screen.findByDisplayValue('Test Studio')).toBeTruthy()
  })

  it('Email tab is accessible and shows SMTP fields when clicked', async () => {
    renderPage()
    const emailTab = await screen.findByRole('tab', { name: /email/i })
    fireEvent.click(emailTab)
    expect(await screen.findByText(/smtp host/i)).toBeTruthy()
    expect(await screen.findByText(/smtp port/i)).toBeTruthy()
  })

  it('shows Send Test Email button in email tab', async () => {
    renderPage()
    const emailTab = await screen.findByRole('tab', { name: /email/i })
    fireEvent.click(emailTab)
    expect(await screen.findByRole('button', { name: /send test email/i })).toBeTruthy()
  })

  it('Billing tab is accessible and shows connection status when clicked', async () => {
    renderPage()
    const billingTab = await screen.findByRole('tab', { name: /billing/i })
    fireEvent.click(billingTab)
    expect(await screen.findByText(/stripe connection/i)).toBeTruthy()
  })

  it('does not resend an empty SMTP password on a save that only touches an unrelated field', async () => {
    const { studioApi } = await import('../../../src/renderer/src/api/studio')
    renderPage()

    const emailTab = await screen.findByRole('tab', { name: /email/i })
    fireEvent.click(emailTab)

    // 1) User types a new password and saves. The payload must include it.
    const passwordInput = await screen.findByPlaceholderText(/leave blank to keep current/i)
    fireEvent.change(passwordInput, { target: { value: 'hunter2' } })

    // Simulate the post-save refetch that queryClient.invalidateQueries triggers:
    // the server never echoes back the real password, so the form resets it to ''.
    // (email_smtp_tls is flipped to false here so this response is structurally
    // distinct from the initial load — otherwise TanStack Query v5's structural
    // sharing would reuse the same object reference and the sync useEffect would
    // never re-run, since nothing "changed" from the query's point of view.)
    vi.mocked(studioApi.getEmailSettings).mockResolvedValueOnce({
      email_from_name: 'Test Studio',
      email_from_address: 'studio@example.com',
      email_smtp_host: 'smtp.gmail.com',
      email_smtp_port: 587,
      email_smtp_user: 'user@example.com',
      email_smtp_password: '***',
      email_smtp_tls: false,
    })

    const saveButton = await screen.findByRole('button', { name: /save settings/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(studioApi.saveEmailSettings).toHaveBeenCalledTimes(1)
    })
    expect(studioApi.saveEmailSettings).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ email_smtp_password: 'hunter2' })
    )

    // Wait for the refetch triggered by invalidateQueries to land and reset the
    // password field back to '' (confirming the "reload" half of the scenario).
    await waitFor(() => {
      expect((passwordInput as HTMLInputElement).value).toBe('')
    })

    // 2) User changes only an unrelated field (does not touch the password field again).
    const tlsCheckbox = await screen.findByLabelText(/tls/i)
    fireEvent.click(tlsCheckbox)

    fireEvent.click(await screen.findByRole('button', { name: /save settings/i }))

    await waitFor(() => {
      expect(studioApi.saveEmailSettings).toHaveBeenCalledTimes(2)
    })
    const secondCallPayload = vi.mocked(studioApi.saveEmailSettings).mock.calls[1][0]
    expect(
      !('email_smtp_password' in secondCallPayload) || secondCallPayload.email_smtp_password === undefined
    ).toBe(true)
  })

  it('does not resend an empty Twilio auth token on a save that only touches an unrelated field', async () => {
    const { smsApi } = await import('../../../src/renderer/src/api/sms')
    renderPage()

    const smsTab = await screen.findByRole('tab', { name: /sms/i })
    fireEvent.click(smsTab)

    // 1) User types a new auth token and saves. The payload must include it.
    const authTokenInput = await screen.findByPlaceholderText(/leave blank to keep current token/i)
    fireEvent.change(authTokenInput, { target: { value: 'sk_new_token' } })

    // Simulate the post-save refetch that queryClient.invalidateQueries triggers:
    // the server never echoes back the real auth token, so the form resets it to ''.
    // (sms_enabled is flipped to true here so this response is structurally distinct
    // from the initial load — otherwise TanStack Query v5's structural sharing would
    // reuse the same object reference and the sync useEffect would never re-run,
    // since nothing "changed" from the query's point of view.)
    vi.mocked(smsApi.getSettings).mockResolvedValueOnce({
      sms_provider_account_sid: 'AC123',
      sms_provider_auth_token: '***',
      sms_from_number: '+15551234567',
      sms_enabled: true,
    })

    const saveButton = await screen.findByRole('button', { name: /save settings/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(smsApi.saveSettings).toHaveBeenCalledTimes(1)
    })
    expect(smsApi.saveSettings).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ auth_token: 'sk_new_token' })
    )

    // Wait for the refetch triggered by invalidateQueries to land and reset the
    // auth token field back to '' (confirming the "reload" half of the scenario).
    await waitFor(() => {
      expect((authTokenInput as HTMLInputElement).value).toBe('')
    })

    // 2) User changes only an unrelated field (does not touch the auth token field again).
    const enabledCheckbox = await screen.findByLabelText(/enable sms/i)
    fireEvent.click(enabledCheckbox)

    fireEvent.click(await screen.findByRole('button', { name: /save settings/i }))

    await waitFor(() => {
      expect(smsApi.saveSettings).toHaveBeenCalledTimes(2)
    })
    const secondSmsCallPayload = vi.mocked(smsApi.saveSettings).mock.calls[1][0]
    expect(
      !('auth_token' in secondSmsCallPayload) || secondSmsCallPayload.auth_token === undefined
    ).toBe(true)
  })

  it('saves a well-formed private http Mobile Access URL and calls the mutation', async () => {
    const { studioApi } = await import('../../../src/renderer/src/api/studio')
    renderPage()

    const mobileTab = await screen.findByRole('tab', { name: /mobile/i })
    fireEvent.click(mobileTab)

    const urlInput = await screen.findByLabelText(/mobile access url/i)
    fireEvent.change(urlInput, { target: { value: 'http://192.168.1.20:8000' } })
    fireEvent.click(await screen.findByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(studioApi.update).toHaveBeenCalledWith({ tunnel_url: 'http://192.168.1.20:8000' })
    })
  })

  it('rejects a bare hostname with no scheme (the real-world tunnel_url bug) and does not call the mutation', async () => {
    const { studioApi } = await import('../../../src/renderer/src/api/studio')
    renderPage()

    const mobileTab = await screen.findByRole('tab', { name: /mobile/i })
    fireEvent.click(mobileTab)

    const urlInput = await screen.findByLabelText(/mobile access url/i)
    fireEvent.change(urlInput, { target: { value: '192.168.30.187' } })
    fireEvent.click(await screen.findByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/http:\/\/ or https:\/\//i)).toBeTruthy()
    expect(studioApi.update).not.toHaveBeenCalled()
  })

  it('rejects a javascript: URL and does not call the mutation', async () => {
    const { studioApi } = await import('../../../src/renderer/src/api/studio')
    renderPage()

    const mobileTab = await screen.findByRole('tab', { name: /mobile/i })
    fireEvent.click(mobileTab)

    const urlInput = await screen.findByLabelText(/mobile access url/i)
    fireEvent.change(urlInput, { target: { value: 'javascript:alert(1)' } })
    fireEvent.click(await screen.findByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/only http:\/\/ or https:\/\/ addresses/i)).toBeTruthy()
    expect(studioApi.update).not.toHaveBeenCalled()
  })

  it('rejects a file: URL and does not call the mutation', async () => {
    const { studioApi } = await import('../../../src/renderer/src/api/studio')
    renderPage()

    const mobileTab = await screen.findByRole('tab', { name: /mobile/i })
    fireEvent.click(mobileTab)

    const urlInput = await screen.findByLabelText(/mobile access url/i)
    fireEvent.change(urlInput, { target: { value: 'file:///etc/passwd' } })
    fireEvent.click(await screen.findByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/only http:\/\/ or https:\/\/ addresses/i)).toBeTruthy()
    expect(studioApi.update).not.toHaveBeenCalled()
  })

  it('rejects a plain http URL to a public-looking host, mirroring the mobile scanner rule', async () => {
    const { studioApi } = await import('../../../src/renderer/src/api/studio')
    renderPage()

    const mobileTab = await screen.findByRole('tab', { name: /mobile/i })
    fireEvent.click(mobileTab)

    const urlInput = await screen.findByLabelText(/mobile access url/i)
    fireEvent.change(urlInput, { target: { value: 'http://studio.example.com:8000' } })
    fireEvent.click(await screen.findByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/private network address/i)).toBeTruthy()
    expect(studioApi.update).not.toHaveBeenCalled()
  })

  it('saves a valid https URL to any host', async () => {
    const { studioApi } = await import('../../../src/renderer/src/api/studio')
    renderPage()

    const mobileTab = await screen.findByRole('tab', { name: /mobile/i })
    fireEvent.click(mobileTab)

    const urlInput = await screen.findByLabelText(/mobile access url/i)
    fireEvent.change(urlInput, { target: { value: 'https://studio.example.com' } })
    fireEvent.click(await screen.findByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(studioApi.update).toHaveBeenCalledWith({ tunnel_url: 'https://studio.example.com' })
    })
  })

  it('offers a "reset to detected address" affordance that restores the auto-detected LAN URL', async () => {
    renderPage()

    const mobileTab = await screen.findByRole('tab', { name: /mobile/i })
    fireEvent.click(mobileTab)

    const urlInput = (await screen.findByLabelText(/mobile access url/i)) as HTMLInputElement
    fireEvent.change(urlInput, { target: { value: '192.168.30.187' } })
    fireEvent.click(await screen.findByRole('button', { name: /^save$/i }))
    expect(await screen.findByText(/http:\/\/ or https:\/\//i)).toBeTruthy()

    fireEvent.click(await screen.findByRole('button', { name: /reset to detected address/i }))

    expect(urlInput.value).toBe('http://192.168.30.50:8000')
    expect(screen.queryByText(/http:\/\/ or https:\/\//i)).toBeNull()
  })
})
