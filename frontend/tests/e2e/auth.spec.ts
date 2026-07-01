/**
 * E2E tests for authentication flows.
 *
 * All /api/* requests are intercepted and mocked so the test suite runs
 * without a real FastAPI backend.
 */

import { test, expect } from '@playwright/test'

const ACCESS_TOKEN = 'test-access-token'
const REFRESH_TOKEN = 'test-refresh-token'

const MANAGER_USER = {
  id: 1,
  email: 'admin@example.com',
  full_name: 'Studio Manager',
  role: 'manager',
  is_active: true,
}

test.describe('Login flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the login endpoint
    await page.route('**/api/v1/auth/login', async (route) => {
      const body = await route.request().postDataJSON()
      if (body.email === 'admin@example.com' && body.password === 'admin123') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ access_token: ACCESS_TOKEN, refresh_token: REFRESH_TOKEN, token_type: 'bearer' }),
        })
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ detail: { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid credentials' } } }),
        })
      }
    })

    // Mock /me endpoint
    await page.route('**/api/v1/auth/me', async (route) => {
      const auth = route.request().headers()['authorization'] ?? ''
      if (auth.includes(ACCESS_TOKEN)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MANAGER_USER),
        })
      } else {
        await route.fulfill({ status: 401, body: '{}' })
      }
    })

    // Mock logout
    await page.route('**/api/v1/auth/logout', async (route) => {
      await route.fulfill({ status: 200, body: '{"status":"ok"}' })
    })

    await page.goto('/')
  })

  test('shows the login form on first load', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /agon/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /login|accedi/i })).toBeVisible()
  })

  test('logs in with valid credentials and redirects to dashboard', async ({ page }) => {
    await page.getByLabel(/email/i).fill('admin@example.com')
    await page.getByLabel(/password/i).fill('admin123')
    await page.getByRole('button', { name: /login|accedi/i }).click()

    await expect(page).toHaveURL(/dashboard/)
  })

  test('shows error message with invalid credentials', async ({ page }) => {
    await page.getByLabel(/email/i).fill('wrong@example.com')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /login|accedi/i }).click()

    await expect(page.getByText(/invalid|credential|errore/i)).toBeVisible()
  })

  test('empty fields prevent form submission', async ({ page }) => {
    await page.getByRole('button', { name: /login|accedi/i }).click()
    // Should stay on login page (HTML5 validation or custom)
    await expect(page.getByLabel(/email/i)).toBeVisible()
  })
})

test.describe('Session management', () => {
  test('401 response clears session and redirects to login', async ({ page }) => {
    // Set up: logged in, but then the server rejects the token
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: ACCESS_TOKEN, refresh_token: REFRESH_TOKEN, token_type: 'bearer' }),
      })
    })
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANAGER_USER) })
    })
    // After login, all data endpoints return 401 (simulating expired session)
    await page.route('**/api/v1/**', async (route) => {
      if (!route.request().url().includes('/auth/')) {
        await route.fulfill({ status: 401, body: '{"detail":"Not authenticated"}' })
      } else {
        await route.continue()
      }
    })

    await page.goto('/')
    await page.getByLabel(/email/i).fill('admin@example.com')
    await page.getByLabel(/password/i).fill('admin123')
    await page.getByRole('button', { name: /login|accedi/i }).click()

    // After navigating to a protected page that returns 401, should redirect to /login
    await page.goto('/clients')
    await expect(page).toHaveURL(/login/, { timeout: 5000 })
  })
})
