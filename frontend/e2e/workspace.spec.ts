import { expect, test } from '@playwright/test'

test('front desk signs in and can navigate to room inventory', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/login')) {
      await route.fulfill({ json: { id: 'front-desk', token: 'test-session', refreshToken: 'test-refresh', name: 'Front desk', isSystemAdmin: false } })
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
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  const refreshAttempt = page.waitForResponse(response => response.url().endsWith('/auth/refresh'))
  await page.getByRole('button', { name: 'Sign out' }).click()
  expect((await refreshAttempt).status()).toBe(401)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await page.reload()
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

test('rotated credentials survive a second reload', async ({ page }) => {
  let refreshCalls = 0
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/login')) {
      await route.fulfill({ json: { id: 'staff', token: 'expired', refreshToken: 'original', name: 'Tom', isSystemAdmin: true } })
    } else if (path.endsWith('/refresh')) {
      refreshCalls++
      expect(route.request().postDataJSON()).toEqual({ refreshToken: 'original' })
      await route.fulfill({ json: { token: 'active', refreshToken: 'rotated' } })
    } else if (route.request().headers().authorization === 'Bearer active') {
      await route.fulfill({ json: [{ id: 'hotel', name: 'Accra Lodge' }] })
    } else {
      await route.fulfill({ status: 401 })
    }
  })
  await page.goto('/')
  await page.getByLabel('Email address').fill('tom@example.test')
  await page.getByLabel('Password', { exact: true }).fill('example-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Accra Lodge' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Accra Lodge' })).toBeVisible()
  expect(refreshCalls).toBe(1)
})

test('folio posts charges and cash payments only after confirmation', async ({ page }) => {
  const posts: string[] = []
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/login')) {
      await route.fulfill({ json: { id: 'staff', token: 'test-session', refreshToken: 'test-refresh', name: 'Tom', isSystemAdmin: false } })
    } else if (path.endsWith('/auth/properties')) {
      await route.fulfill({ json: [{ id: 'hotel', name: 'Accra Lodge', role: 'FrontDesk' }] })
    } else if (path.endsWith('/reservations')) {
      await route.fulfill({ json: [{ id: 'stay', guest: 'Smith', status: 'Confirmed', arrival: '2026-12-01', departure: '2026-12-03' }] })
    } else if (path.endsWith('/folios/stay')) {
      await route.fulfill({ json: { total: 20000, balance: 20000, charges: [], payments: [] } })
    } else if (request.method() === 'POST' && path.includes('/folios/stay/')) {
      posts.push(path.split('/').pop()!)
      await route.fulfill({ json: { id: 'receipt', amount: 5000, tendered: 6000, utc: '2026-12-01T10:00:00Z' } })
    } else {
      await route.fulfill({ json: [] })
    }
  })

  await page.goto('/')
  await page.getByLabel('Email address').fill('tom@example.test')
  await page.getByLabel('Password', { exact: true }).fill('example-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Reservations', exact: true }).click()
  await page.getByRole('button', { name: 'Folio' }).click()
  await page.getByLabel('Charge description').fill('Laundry')
  for (const [label, amount] of [
    ['Charge amount (GHS)', '25.50'],
    ['Amount applied (GHS)', '50.25'],
    ['Cash tendered (GHS)', '60.00'],
  ]) {
    const input = page.getByLabel(label)
    await input.pressSequentially('abc+-')
    await expect(input).toHaveValue('')
    await input.fill('12abc')
    await expect(input).toHaveValue('')
    await input.fill(amount)
    await input.pressSequentially('e3')
    await expect(input).toHaveValue(amount)
  }

  for (const [label, title, detail, confirmLabel, endpoint] of [
    ['Post charge', 'Review charge', 'Laundry', 'Confirm charge', 'charges'],
    ['Record cash payment', 'Review cash payment', 'Change to give', 'Confirm payment', 'payments'],
  ]) {
    const submit = page.getByRole('button', { name: label, exact: true })
    const dialog = page.getByRole('dialog', { name: title })
    const priorPosts = posts.length
    await submit.click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(detail, { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    expect(posts).toHaveLength(priorPosts)
    if (endpoint === 'charges') await page.keyboard.press('Escape')
    else await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(submit).toBeEnabled()
    expect(posts).toHaveLength(priorPosts)

    const posted = page.waitForResponse(response => response.url().endsWith('/' + endpoint))
    await submit.click()
    await dialog.getByRole('button', { name: confirmLabel }).click()
    await posted
    await expect(dialog).toHaveCount(0)
    await expect(submit).toBeEnabled()
    expect(posts.slice(priorPosts)).toEqual([endpoint])
  }
})
