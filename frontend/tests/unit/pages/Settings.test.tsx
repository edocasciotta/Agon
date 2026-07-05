import { render, screen, fireEvent } from '@testing-library/react'
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
})
