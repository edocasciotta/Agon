/**
 * E2E tests for client management pages.
 */

import { test, expect } from '@playwright/test'

const MANAGER_USER = { id: 1, email: 'admin@example.com', full_name: 'Manager', role: 'manager', is_active: true }
const ACCESS_TOKEN = 'mgr-token'

const MOCK_CLIENTS = [
  { id: 1, email: 'alice@example.com', full_name: 'Alice Rossi', phone: null, is_active: true, created_at: '2024-01-01T00:00:00', updated_at: '2024-01-01T00:00:00' },
  { id: 2, email: 'bob@example.com', full_name: 'Bob Bianchi', phone: '123456789', is_active: true, created_at: '2024-01-02T00:00:00', updated_at: '2024-01-02T00:00:00' },
]

async function loginAndMock(page: import('@playwright/test').Page) {
  // Catch-all fallback for any endpoint this test doesn't care about (the
  // Dashboard page the login redirect lands on fires several queries of its
  // own — classes, templates, instructors, locations, reports). Playwright
  // tries most-recently-registered matching routes first, so registering
  // this one FIRST means every route added below it takes priority; this
  // just prevents unmocked requests from reaching the real backend and
  // 401ing, which would trip the global 401 interceptor and log the session
  // back out mid-test.
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
  await page.route('**/api/v1/clients*', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: MOCK_CLIENTS, total: MOCK_CLIENTS.length, page: 1, page_size: 20 }),
      })
    } else if (method === 'POST') {
      const body = await route.request().postDataJSON()
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 99, ...body, is_active: true, email_sent: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      })
    } else {
      await route.continue()
    }
  })

  await page.goto('/')
  await page.getByLabel(/email/i).fill('admin@example.com')
  await page.getByLabel(/password/i).fill('admin123')
  await page.getByRole('button', { name: /login|accedi|sign in/i }).click()
  await page.waitForURL(/dashboard/)
}

test.describe('Clients page', () => {
  test('lists clients from the API', async ({ page }) => {
    await loginAndMock(page)
    // Navigate via the sidebar link (client-side routing) rather than
    // page.goto() — accessToken lives only in memory (never persisted, by
    // design per SECURITY_GUIDELINES), so a hard navigation would drop the
    // session and bounce back to /login.
    await page.getByRole('link', { name: 'Clients' }).click()

    await expect(page.getByText('Alice Rossi')).toBeVisible()
    await expect(page.getByText('Bob Bianchi')).toBeVisible()
  })

  test('search box filters visible clients', async ({ page }) => {
    await loginAndMock(page)

    // Override with search-aware mock
    await page.route('**/api/v1/clients*', async (route) => {
      const url = new URL(route.request().url())
      const search = url.searchParams.get('search') ?? ''
      const filtered = MOCK_CLIENTS.filter((c) =>
        c.full_name.toLowerCase().includes(search.toLowerCase())
      )
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: filtered, total: filtered.length, page: 1, page_size: 20 }),
      })
    })

    // Navigate via the sidebar link (client-side routing) rather than
    // page.goto() — accessToken lives only in memory (never persisted, by
    // design per SECURITY_GUIDELINES), so a hard navigation would drop the
    // session and bounce back to /login.
    await page.getByRole('link', { name: 'Clients' }).click()
    const searchInput = page.getByPlaceholder(/search|cerca/i)
    if (await searchInput.isVisible()) {
      await searchInput.fill('Alice')
      await expect(page.getByText('Alice Rossi')).toBeVisible()
      await expect(page.getByText('Bob Bianchi')).not.toBeVisible()
    }
  })

  test('create client modal opens and submits', async ({ page }) => {
    await loginAndMock(page)
    // Navigate via the sidebar link (client-side routing) rather than
    // page.goto() — accessToken lives only in memory (never persisted, by
    // design per SECURITY_GUIDELINES), so a hard navigation would drop the
    // session and bounce back to /login.
    await page.getByRole('link', { name: 'Clients' }).click()

    // Open the create modal
    const addBtn = page.getByRole('button', { name: /add|nuovo|create|aggiungi/i })
    await addBtn.click()

    // Fill in the form
    await page.getByLabel(/name|nome/i).first().fill('New Client')
    await page.getByLabel(/email/i).fill('new@example.com')

    // Submit
    const saveBtn = page.getByRole('button', { name: /save|salva|create|crea/i })
    await saveBtn.click()

    // Modal should close on success
    await expect(page.getByLabel(/email/i)).not.toBeVisible({ timeout: 3000 })
  })

  test('shows empty state when no clients', async ({ page }) => {
    await page.route('**/api/v1/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    })
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: ACCESS_TOKEN, refresh_token: 'rfr', token_type: 'bearer' }) })
    })
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANAGER_USER) })
    })
    await page.route('**/api/v1/clients*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 20 }),
      })
    })

    await page.goto('/')
    await page.getByLabel(/email/i).fill('admin@example.com')
    await page.getByLabel(/password/i).fill('admin123')
    await page.getByRole('button', { name: /login|accedi|sign in/i }).click()
    await page.waitForURL(/dashboard/)
    // Navigate via the sidebar link (client-side routing) rather than
    // page.goto() — accessToken lives only in memory (never persisted, by
    // design per SECURITY_GUIDELINES), so a hard navigation would drop the
    // session and bounce back to /login.
    await page.getByRole('link', { name: 'Clients' }).click()

    // Empty state text
    await expect(page.getByText(/no client|nessun client|empty/i)).toBeVisible()
  })
})
