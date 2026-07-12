/**
 * E2E test for the Appointments page: 1-on-1 booking engine (PR #18 backend).
 *
 * Covers the core flow: open Appointments -> create a service -> set
 * instructor availability -> book an appointment -> see it in Upcoming ->
 * cancel it. All API calls are mocked via page.route() — no real backend
 * needed, per the project's e2e convention.
 */

import { test, expect } from '@playwright/test'

const MANAGER_USER = { id: 1, email: 'admin@example.com', full_name: 'Manager', role: 'manager', is_active: true }
const ACCESS_TOKEN = 'mgr-token'

const MOCK_INSTRUCTORS = [
  { id: 1, user_id: 10, full_name: 'Maria Bianchi', email: 'maria@example.com', bio: '', is_active: true },
]

let services: unknown[] = []
let availability: unknown[] = []
let appointments: unknown[] = []
let nextServiceId = 1
let nextAvailabilityId = 1
let nextAppointmentId = 1

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
const futureDateStr = futureDate.toISOString().slice(0, 10)
const slotStart = `${futureDateStr}T09:00:00`
const slotEnd = `${futureDateStr}T10:00:00`

async function setupAndLogin(page: import('@playwright/test').Page) {
  services = []
  availability = []
  appointments = []
  nextServiceId = 1
  nextAvailabilityId = 1
  nextAppointmentId = 1

  // Catch-all fallback for any endpoint this test doesn't care about (the
  // Dashboard page the login redirect lands on fires several queries of its
  // own — classes, templates, locations, reports). Playwright tries
  // most-recently-registered matching routes first, so registering this
  // one FIRST means every route added below it takes priority; this just
  // prevents unmocked requests from reaching the real backend and 401ing,
  // which would trip the global 401 interceptor and log the session back
  // out mid-test.
  await page.route('**/api/v1/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: ACCESS_TOKEN, refresh_token: 'rfr', token_type: 'bearer' }),
    })
  })
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANAGER_USER) })
  })

  // ThemeInjector (App.tsx) fetches studio settings unconditionally whenever
  // authenticated.
  await page.route('**/api/v1/studio', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, studio_name: 'Agon Studio', timezone: 'UTC' }),
    })
  })
  await page.route('**/api/v1/instructors*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INSTRUCTORS) })
  })
  const JOHN_CLIENT = { id: 7, full_name: 'John Client', email: 'john@example.com', is_active: true, created_at: '' }
  await page.route('**/api/v1/clients**', async (route) => {
    // GET /clients/{id} (single-client lookup, used to resolve names on the
    // Upcoming tab) vs GET /clients?search=... (typeahead list) return
    // different shapes — distinguish by whether the path has a numeric
    // segment after /clients.
    const url = new URL(route.request().url())
    const isSingleClient = /\/clients\/\d+$/.test(url.pathname)
    if (isSingleClient) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(JOHN_CLIENT) })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [JOHN_CLIENT], total: 1, page: 1, page_size: 10 }),
      })
    }
  })

  await page.route('**/api/v1/appointment-services*', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(services) })
    } else if (method === 'POST') {
      const body = route.request().postDataJSON()
      const now = new Date().toISOString()
      const created = {
        id: nextServiceId++,
        location_id: 1,
        is_active: true,
        created_at: now,
        updated_at: now,
        ...body,
      }
      services.push(created)
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) })
    } else {
      await route.continue()
    }
  })

  await page.route('**/api/v1/instructor-availability*', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(availability) })
    } else if (method === 'POST') {
      const body = route.request().postDataJSON()
      const now = new Date().toISOString()
      const created = {
        id: nextAvailabilityId++,
        location_id: 1,
        is_active: true,
        created_at: now,
        updated_at: now,
        ...body,
      }
      availability.push(created)
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) })
    } else {
      await route.continue()
    }
  })

  await page.route('**/api/v1/appointments/available-slots*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ starts_at: slotStart, ends_at: slotEnd }]),
    })
  })

  await page.route('**/api/v1/appointments/*/cancel', async (route) => {
    const id = Number(route.request().url().match(/appointments\/(\d+)\/cancel/)?.[1])
    const appt = appointments.find((a) => (a as { id: number }).id === id) as
      | Record<string, unknown>
      | undefined
    if (appt) {
      appt.status = 'cancelled'
      appt.cancelled_at = new Date().toISOString()
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(appt) })
  })

  await page.route('**/api/v1/appointments*', async (route) => {
    const method = route.request().method()
    const url = route.request().url()
    if (url.includes('/available-slots') || url.includes('/cancel') || url.includes('/complete')) {
      await route.continue()
      return
    }
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(appointments) })
    } else if (method === 'POST') {
      const body = route.request().postDataJSON()
      const now = new Date().toISOString()
      const created = {
        id: nextAppointmentId++,
        location_id: 1,
        status: 'confirmed',
        credit_deducted: true,
        cancelled_at: null,
        cancellation_reason: null,
        created_at: now,
        updated_at: now,
        ends_at: slotEnd,
        ...body,
      }
      appointments.push(created)
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) })
    } else {
      await route.continue()
    }
  })

  await page.goto('/')
  await page.getByPlaceholder('manager@studio.com').fill('admin@example.com')
  await page.getByPlaceholder('••••••••').fill('admin123')
  await page.getByRole('button', { name: /login|accedi|sign in/i }).click()
  await page.waitForURL(/dashboard/)
}

test.describe('Appointments page', () => {
  test('full flow: create service, set availability, book, view, cancel', async ({ page }) => {
    await setupAndLogin(page)
    // Navigate via the sidebar link (client-side routing) rather than
    // page.goto() — accessToken lives only in memory (never persisted, by
    // design per SECURITY_GUIDELINES), so a hard navigation would drop the
    // session and bounce back to /login.
    await page.getByRole('link', { name: 'Appointments' }).click()

    await expect(page.getByRole('heading', { name: 'Appointments', exact: true })).toBeVisible()

    // --- Services tab: create a service ---
    await page.getByRole('tab', { name: 'Services' }).click()
    await expect(page.getByText('No services yet')).toBeVisible()
    await page.getByRole('button', { name: 'New Service' }).click()
    await page.getByPlaceholder('e.g. Personal Training').fill('Personal Training')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('cell', { name: 'Personal Training' })).toBeVisible()

    // --- Availability tab: add a window for Monday ---
    await page.getByRole('tab', { name: 'Availability' }).click()
    await expect(page.getByText('Monday')).toBeVisible()
    const startInputs = page.getByLabel('Start time')
    const endInputs = page.getByLabel('End time')
    await startInputs.first().fill('09:00')
    await endInputs.first().fill('17:00')
    await page.getByRole('button', { name: 'Add window' }).first().click()
    await expect(page.getByText('09:00 – 17:00')).toBeVisible()

    // --- Upcoming tab: book an appointment ---
    await page.getByRole('tab', { name: 'Upcoming' }).click()
    await expect(page.getByText('No appointments yet')).toBeVisible()
    await page.getByRole('button', { name: 'New Appointment' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    const selects = page.locator('[role="dialog"] select')
    await selects.nth(0).selectOption({ label: 'Personal Training (60 min)' })
    await selects.nth(1).selectOption({ label: 'Maria Bianchi' })
    await page.getByLabel('Date').fill(futureDateStr)

    await page.getByRole('button', { name: '09:00' }).click()

    await page.getByPlaceholder('Search by name or email...').fill('John')
    await page.getByText('John Client').click()

    await page.getByRole('button', { name: 'Confirm Booking' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })

    // --- See it in Upcoming ---
    await expect(page.getByRole('cell', { name: 'Personal Training' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'John Client' })).toBeVisible()
    await expect(page.getByRole('cell').getByText('Confirmed')).toBeVisible()

    // --- Cancel it ---
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Cancel this appointment?')).toBeVisible()
    await page.getByRole('button', { name: 'Yes, cancel' }).click()
    await expect(page.getByText('Cancel this appointment?')).not.toBeVisible()
  })
})
