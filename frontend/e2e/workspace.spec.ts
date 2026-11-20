import { expect, test } from '@playwright/test'

test('front desk signs in and can navigate to room inventory', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/login')) {
      await route.fulfill({ json: { token: 'test-session', refreshToken: 'test-refresh', name: 'Front desk', isSystemAdmin: false } })
    } else if (path === '/api/v1/auth/properties') {
      await route.fulfill({ json: [{ id: 'hotel', name: 'Accra Lodge', role: 'FrontDesk' }] })
    } else if (path.endsWith('/rooms')) {
      await route.fulfill({ json: [{ id: 'room', number: '101', type: 'Double', capacity: 2, rate: 35000, status: 'Clean' }] })
    } else if (path.endsWith('/reservations')) {
      await route.fulfill({ json: [] })
    } else if (path.endsWith('/logout') || path.endsWith('/refresh')) {
      await route.fulfill({ status: 401 })
    } else if (path.endsWith('/activity')) {
      await route.fulfill({ status: 204 })
    } else {
      await route.fulfill({ status: 404 })
    }
  })
  await page.goto('/')
  await page.getByLabel('Email address').fill('frontdesk@example.test')
  await page.getByLabel('Password', { exact: true }).fill('example-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await page.getByRole('button', { name: 'Rooms', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Room 101' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add room' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth))
  const refreshAttempt = page.waitForResponse(response => response.url().endsWith('/auth/refresh'))
  await page.getByRole('button', { name: 'Sign out' }).click()
  expect((await refreshAttempt).status()).toBe(401)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('audit log shows the staff identity, action, and Ghana time', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/login')) {
      await route.fulfill({ json: { token: 'test-session', name: 'Tom', isSystemAdmin: true } })
    } else if (path.endsWith('/audit')) {
      await route.fulfill({ json: [
        { id: 'sign-in', utc: '2026-12-02T11:20:00', staffName: 'Tom', staffEmail: 'TOM@EXAMPLE.TEST', action: 'logged in', outcome: 200 },
        { id: 'room', utc: '2026-12-02T11:30:00Z', staffName: 'Tom', staffEmail: 'TOM@EXAMPLE.TEST', action: 'assigned guest (Smith) to Room 1', outcome: 200 },
      ] })
    } else {
      await route.fulfill({ json: [] })
    }
  })

  await page.goto('/')
  await page.getByLabel('Email address').fill('tom@example.test')
  await page.getByLabel('Password', { exact: true }).fill('example-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Audit log' }).click()
  await expect(page.getByText(/Tom \(tom@example.test\) logged in on 2 December 2026 at 11:20/i)).toBeVisible()
  await page.getByLabel('Filter activity').fill('Smith')
  await expect(page.getByText(/assigned guest \(Smith\) to Room 1/)).toBeVisible()
  await expect(page.getByText(/logged in/)).toHaveCount(0)
})
