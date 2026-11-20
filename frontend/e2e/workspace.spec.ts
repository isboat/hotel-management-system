import { expect, test } from '@playwright/test'

test('front desk signs in and can navigate to room inventory', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/login')) {
      await route.fulfill({ json: { token: 'test-session', name: 'Front desk', isSystemAdmin: false } })
    } else if (path === '/api/v1/auth/properties') {
      await route.fulfill({ json: [{ id: 'hotel', name: 'Accra Lodge', role: 'FrontDesk' }] })
    } else if (path.endsWith('/rooms')) {
      await route.fulfill({ json: [{ id: 'room', number: '101', type: 'Double', capacity: 2, rate: 35000, status: 'Clean' }] })
    } else if (path.endsWith('/reservations')) {
      await route.fulfill({ json: [] })
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
})
