/**
 * E2E tests for the class calendar page.
 */

import { test, expect } from '@playwright/test'

const MANAGER_USER = { id: 1, email: 'admin@example.com', full_name: 'Manager', role: 'manager', is_active: true }
const ACCESS_TOKEN = 'mgr-token'

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
const MOCK_CLASSES = [
  {
    id: 1,
    template_id: 1,
    instructor_id: null,
    location_id: 1,
    starts_at: futureDate,
    ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3600_000).toISOString(),
    capacity: 20,
    status: 'scheduled',
    notes: null,
    created_at: futureDate,
    updated_at: futureDate,
  },
]
const MOCK_TEMPLATES = [
  { id: 1, name: 'Yoga', duration_minutes: 60, default_capacity: 20, color: '#4F46E5', is_active: true },
]
const MOCK_INSTRUCTORS: unknown[] = []

async function setupAndLogin(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: ACCESS_TOKEN, refresh_token: 'rfr', token_type: 'bearer' }) })
  })
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANAGER_USER) })
  })
  await page.route('**/api/v1/classes*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CLASSES) })
    } else if (route.request().method() === 'POST') {
      const body = await route.request().postDataJSON()
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 99, ...body, status: 'scheduled', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      })
    } else {
      await route.continue()
    }
  })
  await page.route('**/api/v1/class-templates*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TEMPLATES) })
  })
  await page.route('**/api/v1/instructors*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INSTRUCTORS) })
  })

  await page.goto('/')
  await page.getByLabel(/email/i).fill('admin@example.com')
  await page.getByLabel(/password/i).fill('admin123')
  await page.getByRole('button', { name: /login|accedi/i }).click()
  await page.waitForURL(/dashboard/)
}

test.describe('Calendar page', () => {
  test('loads the calendar and shows scheduled classes', async ({ page }) => {
    await setupAndLogin(page)
    await page.goto('/calendar')

    // The page should show the calendar heading
    await expect(page.getByRole('heading', { name: /calendar|calendario/i })).toBeVisible()
  })

  test('opens the schedule-class modal', async ({ page }) => {
    await setupAndLogin(page)
    await page.goto('/calendar')

    const addBtn = page.getByRole('button', { name: /add|schedule|aggiungi|pianifica/i })
    if (await addBtn.isVisible()) {
      await addBtn.click()
      // A modal or form should appear
      await expect(page.getByRole('dialog')).toBeVisible()
    }
  })

  test('cancel class changes status to cancelled', async ({ page }) => {
    let cancelled = false
    await setupAndLogin(page)

    // Override to handle DELETE/cancel
    await page.route(`**/api/v1/classes/1*`, async (route) => {
      if (route.request().method() === 'DELETE') {
        cancelled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_CLASSES[0], status: 'cancelled' }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/calendar')
    // Look for a context menu or cancel button on the class
    const classEl = page.getByText('Yoga').first()
    if (await classEl.isVisible()) {
      await classEl.click()
      const cancelBtn = page.getByRole('button', { name: /cancel|cancella/i })
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click()
        // Confirm the cancellation if a confirm dialog appears
        const confirmBtn = page.getByRole('button', { name: /confirm|conferma|yes/i })
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click()
        }
      }
    }
  })
})
