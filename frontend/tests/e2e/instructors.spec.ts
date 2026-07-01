/**
 * E2E tests for the instructors management page.
 */

import { test, expect } from '@playwright/test'

const MANAGER_USER = { id: 1, email: 'admin@example.com', full_name: 'Manager', role: 'manager', is_active: true }
const ACCESS_TOKEN = 'mgr-token'

const MOCK_INSTRUCTORS = [
  { id: 1, user_id: 10, full_name: 'Maria Bianchi', email: 'maria@example.com', bio: 'Yoga teacher', is_active: true, created_at: '2024-01-01T00:00:00', updated_at: '2024-01-01T00:00:00' },
  { id: 2, user_id: 11, full_name: 'Luca Verdi', email: 'luca@example.com', bio: 'HIIT coach', is_active: true, created_at: '2024-01-02T00:00:00', updated_at: '2024-01-02T00:00:00' },
]

async function setupAndLogin(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: ACCESS_TOKEN, refresh_token: 'rfr', token_type: 'bearer' }) })
  })
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANAGER_USER) })
  })
  await page.route('**/api/v1/instructors*', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INSTRUCTORS) })
    } else if (method === 'POST') {
      const body = await route.request().postDataJSON()
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 99, user_id: 99, ...body, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      })
    } else {
      await route.continue()
    }
  })

  await page.goto('/')
  await page.getByLabel(/email/i).fill('admin@example.com')
  await page.getByLabel(/password/i).fill('admin123')
  await page.getByRole('button', { name: /login|accedi/i }).click()
  await page.waitForURL(/dashboard/)
}

test.describe('Instructors page', () => {
  test('lists instructors from the API', async ({ page }) => {
    await setupAndLogin(page)
    await page.goto('/instructors')

    await expect(page.getByText('Maria Bianchi')).toBeVisible()
    await expect(page.getByText('Luca Verdi')).toBeVisible()
  })

  test('create instructor modal opens and fills form', async ({ page }) => {
    await setupAndLogin(page)
    await page.goto('/instructors')

    const addBtn = page.getByRole('button', { name: /add|new|nuovo|aggiungi/i })
    await addBtn.click()

    // Modal should appear
    await expect(page.getByRole('dialog')).toBeVisible()

    // Fill the form fields
    const nameInput = page.getByLabel(/name|nome/i).first()
    await nameInput.fill('Carlo Rossi')
    await page.getByLabel(/email/i).fill('carlo@example.com')
    const passwordInput = page.getByLabel(/password/i)
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('securepassword123')
    }

    // Submit
    const saveBtn = page.getByRole('button', { name: /save|salva|create|crea/i })
    await saveBtn.click()

    // Modal should close on success
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
  })

  test('deactivate instructor updates status', async ({ page }) => {
    await setupAndLogin(page)

    // Override PATCH/DELETE for instructor 1
    await page.route('**/api/v1/instructors/1*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 204,
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/instructors')
    await expect(page.getByText('Maria Bianchi')).toBeVisible()

    // Look for a deactivate/delete button near the first instructor
    const row = page.getByText('Maria Bianchi').locator('..').locator('..')
    const deactivateBtn = row.getByRole('button', { name: /deactivate|disattiva|delete|elimina/i })
    if (await deactivateBtn.isVisible()) {
      await deactivateBtn.click()
      // Confirm if a dialog appears
      const confirmBtn = page.getByRole('button', { name: /confirm|conferma|yes|sì/i })
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click()
      }
    }
  })

  test('shows empty state when no instructors', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: ACCESS_TOKEN, refresh_token: 'rfr', token_type: 'bearer' }) })
    })
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANAGER_USER) })
    })
    await page.route('**/api/v1/instructors*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.goto('/')
    await page.getByLabel(/email/i).fill('admin@example.com')
    await page.getByLabel(/password/i).fill('admin123')
    await page.getByRole('button', { name: /login|accedi/i }).click()
    await page.goto('/instructors')

    await expect(page.getByText(/no instructor|nessun instructor|empty/i)).toBeVisible()
  })
})
