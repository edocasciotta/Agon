import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReportsPage } from '../../../src/renderer/src/pages/Reports'

vi.mock('../../../src/renderer/src/api/reports', () => ({
  reportsApi: {
    attendance: vi.fn().mockResolvedValue({
      period: { start: '2026-07-01', end: '2026-07-31' },
      total_classes: 10,
      total_bookings: 100,
      total_checkins: 100,
      checkin_rate: 100.0,
      avg_class_size: 10,
      classes_cancelled: 0,
      classes_completed: 10,
      by_class_template: [],
    }),
    revenue: vi.fn().mockResolvedValue({
      period: { start: '2026-07-01', end: '2026-07-31' },
      total_revenue: 0,
      currency: 'EUR',
      payment_count: 0,
      avg_payment: 0,
      by_membership_type: [],
    }),
    membershipsReport: vi.fn().mockResolvedValue({}),
    retentionReport: vi.fn().mockResolvedValue({
      period: { start: '2026-07-01', end: '2026-07-31' },
      total_clients: 40,
      active_clients: 30,
      new_clients: 5,
      churned_clients: 2,
      retention_rate: 75.5,
    }),
    exportAttendanceCsv: () => 'http://localhost:8000/api/v1/reports/attendance/export',
    exportRevenueCsv: () => 'http://localhost:8000/api/v1/reports/revenue/export',
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ReportsPage />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReportsPage', () => {
  it('renders the check-in rate as the raw backend percentage, not multiplied by 100 again', async () => {
    renderPage()

    // Backend already returns a 0-100 scaled percentage (100.0 = 100%).
    // Before the fix, the page multiplied it by 100 again, rendering "10000.0%".
    const rate = await screen.findByText('100.0%')
    expect(rate).toBeTruthy()
    expect(screen.queryByText('10000.0%')).toBeNull()
  })

  it('renders the retention rate as the raw backend percentage, not multiplied by 100 again', async () => {
    renderPage()

    const tabs = await screen.findAllByRole('button', { name: /retention/i })
    tabs[0].click()

    // Backend already returns a 0-100 scaled percentage (75.5 = 75.5%).
    // Before the fix, the page multiplied it by 100 again, rendering "7550.0%".
    const rate = await screen.findByText('75.5%')
    expect(rate).toBeTruthy()
    expect(screen.queryByText('7550.0%')).toBeNull()
  })
})
