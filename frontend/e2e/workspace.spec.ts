import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function navigateTo(page: Page, name: string) {
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  const menu = page.getByRole('button', { name: 'Open navigation' })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true }).click()
  const workspace = page.locator('.workspace')
  await expect(workspace.getByRole('heading', { level: 1 })).toBeVisible()
  const photo = name === 'Overview' ? '/hotel-lobby.webp' : `/heroes/${name.toLowerCase().replaceAll(' ', '-')}.webp`
  await expect.poll(() => workspace.evaluate(element => getComputedStyle(element, '::before').backgroundImage)).toContain(photo)
  expect((await page.request.get(photo)).ok()).toBeTruthy()
}

test('front desk signs in and can navigate to room inventory', async ({ page }) => {
  const login = Promise.withResolvers<void>()
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/login')) {
      await login.promise
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
  await expect(page.getByRole('button', { name: 'Signing in…', exact: true })).toBeDisabled()
  login.resolve()
  await expect(page.getByRole('heading', { name: 'Accra Lodge', level: 1 })).toBeVisible()
  await navigateTo(page, 'Rooms')
  await expect(page.getByRole('heading', { name: 'Room 101' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add room' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Accra Lodge', level: 1 })).toBeVisible()
  const refreshAttempt = page.waitForResponse(response => response.url().endsWith('/auth/refresh'))
  await page.getByRole('button', { name: 'Sign out' }).click()
  expect((await refreshAttempt).status()).toBe(401)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('audit log shows the staff identity, action, and Ghana time', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path.endsWith('/login')) {
      await route.fulfill({ json: { token: 'test-session', name: 'Tom', isSystemAdmin: true } })
    } else if (path.endsWith('/audit')) {
      const entries = [
        { id: 'sign-in', utc: '2026-12-02T11:20:00', staffName: 'Tom', staffEmail: 'TOM@EXAMPLE.TEST', action: 'logged in', outcome: 200 },
        { id: 'room', utc: '2026-12-02T11:30:00Z', staffName: 'Tom', staffEmail: 'TOM@EXAMPLE.TEST', action: 'assigned guest (Smith) to Room 1', outcome: 200 },
      ]
      const snapshotUtc = '2026-12-02T12:00:00Z'
      const search = url.searchParams.get('search')
      const offset = Number(url.searchParams.get('offset'))
      if (url.searchParams.has('snapshot')) expect(url.searchParams.get('snapshot')).toBe(snapshotUtc)
      const items = search ? entries.filter(entry => entry.action.includes(search)) : entries.slice(offset / 25, offset / 25 + 1)
      await route.fulfill({ json: { items, hasMore: !search && offset === 0, snapshotUtc } })
    } else {
      await route.fulfill({ json: [] })
    }
  })

  await page.goto('/')
  await page.getByLabel('Email address').fill('tom@example.test')
  await page.getByLabel('Password', { exact: true }).fill('example-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await navigateTo(page, 'Audit log')
  await expect(page.getByText(/Tom \(tom@example.test\) logged in on 2 December 2026 at 11:20/i)).toBeVisible()
  const pages = page.getByRole('navigation', { name: 'Audit log pages' })
  await pages.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/assigned guest \(Smith\) to Room 1/)).toBeVisible()
  await expect(pages.getByText('Page 2')).toBeVisible()
  await pages.getByRole('button', { name: 'Previous' }).click()
  await expect(page.getByText(/logged in/)).toBeVisible()
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
  await navigateTo(page, 'Reservations')
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

test('maintenance keeps fixed issues in history with their fix date', async ({ page }) => {
  const issue = { id: 'issue', roomNumber: '101', description: 'Bathroom leak', resolved: false,
    reportedUtc: '2026-12-02T11:20:00Z', fixedUtc: null as string | null }
  let reported = false
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/login')) {
      await route.fulfill({ json: { id: 'staff', token: 'session', refreshToken: 'refresh', name: 'Tom', isSystemAdmin: false } })
    } else if (path.endsWith('/auth/properties')) {
      await route.fulfill({ json: [{ id: 'hotel', name: 'Accra Lodge', role: 'Housekeeping' }] })
    } else if (path.endsWith('/rooms')) {
      await route.fulfill({ json: [{ id: 'room', number: '101', type: 'Double', capacity: 2, rate: 35000, status: 'Clean' }] })
    } else if (path.endsWith('/maintenance') && request.method() === 'POST') {
      expect(request.postDataJSON()).toEqual({ roomId: 'room', description: 'Bathroom leak' })
      reported = true
      await route.fulfill({ json: issue })
    } else if (path.endsWith('/maintenance/issue/resolve')) {
      issue.resolved = true
      issue.fixedUtc = '2026-12-02T12:30:00Z'
      await route.fulfill({ status: 204 })
    } else if (path.endsWith('/maintenance')) {
      await route.fulfill({ json: reported ? [issue] : [] })
    } else {
      await route.fulfill({ status: 404 })
    }
  })
  await page.goto('/')
  await page.getByLabel('Email address').fill('tom@example.test')
  await page.getByLabel('Password', { exact: true }).fill('example-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await navigateTo(page, 'Rooms')
  await page.getByRole('button', { name: 'Maintenance', exact: true }).click()
  await page.getByLabel('Issue', { exact: true }).fill('Bathroom leak')
  await page.getByRole('button', { name: 'Report issue' }).click()
  const issueCard = page.getByRole('article').filter({ hasText: 'Bathroom leak' })
  await expect(issueCard.getByText('Open', { exact: true })).toBeVisible()
  await issueCard.getByRole('button', { name: 'Mark fixed' }).click()
  await page.getByLabel('Issue status').selectOption('fixed')
  await expect(issueCard.locator('time[datetime="2026-12-02T12:30:00Z"]')).toBeVisible()
  await expect(issueCard.getByRole('button', { name: 'Mark fixed' })).toHaveCount(0)
})

test('staff confirm reservation creation and cancellation in the overlay', async ({ page }) => {
  const bookings: unknown[] = []
  const cancellations: unknown[] = []
  let status = 'Confirmed'
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/login')) {
      await route.fulfill({ json: { id: 'staff', token: 'session', refreshToken: 'refresh', name: 'Tom', isSystemAdmin: false } })
    } else if (path.endsWith('/auth/properties')) {
      await route.fulfill({ json: [{ id: 'hotel', name: 'Accra Lodge', role: 'FrontDesk' }] })
    } else if (path.endsWith('/guests')) {
      const search = new URL(request.url()).searchParams.get('search')
      await route.fulfill({ json: search === 'Smith' ? [{ id: 'smith', name: 'Smith' }] : [{ id: 'other', name: 'Other guest' }] })
    } else if (path.endsWith('/availability')) {
      await route.fulfill({ json: [{ id: 'room', number: '101', rate: 35000 }] })
    } else if (path.endsWith('/reservations') && request.method() === 'POST') {
      bookings.push(request.postDataJSON())
      await route.fulfill({ json: { id: 'reservation' } })
    } else if (path.endsWith('/reservations/reservation') && request.method() === 'PATCH') {
      cancellations.push(request.postDataJSON())
      status = 'Cancelled'
      await route.fulfill({ status: 204 })
    } else if (path.endsWith('/reservations')) {
      await route.fulfill({ json: bookings.length ? [{ id: 'reservation', guest: 'Smith', arrival: '2026-12-01', departure: '2026-12-03', status }] : [] })
    } else {
      await route.fulfill({ json: [] })
    }
  })
  await page.goto('/')
  await page.getByLabel('Email address').fill('tom@example.test')
  await page.getByLabel('Password', { exact: true }).fill('example-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await navigateTo(page, 'Reservations')
  await page.getByRole('button', { name: 'New reservation' }).click()
  await page.getByLabel('Arrival', { exact: true }).fill('2026-12-01')
  await page.getByLabel('Departure', { exact: true }).fill('2026-12-03')
  await page.getByRole('button', { name: 'Find rooms' }).click()
  await page.getByLabel('Search guest profiles').fill('Smith')
  await page.getByLabel('Guest profile', { exact: true }).selectOption({ label: 'Smith' })
  await page.getByLabel('Search guest profiles').fill('Other')
  await expect(page.getByLabel('Guest profile', { exact: true }).getByRole('option', { name: 'Other guest' })).toHaveCount(1)
  await expect(page.getByLabel('Guest profile', { exact: true })).toHaveValue('smith')
  const submit = page.getByRole('button', { name: 'Confirm reservation', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Review reservation' })
  await submit.click()
  await expect(dialog.getByText('Smith')).toBeVisible()
  await expect(dialog.getByText('Room 101', { exact: true })).toBeVisible()
  await expect(dialog.getByText('2026-12-03', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByLabel('Guest profile', { exact: true })).toHaveValue('smith')
  expect(bookings).toHaveLength(0)

  await submit.click()
  await dialog.getByRole('button', { name: 'Confirm reservation', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Find availability' })).toHaveCount(0)
  expect(bookings).toEqual([{ guest: 'Smith', guestId: 'smith', roomId: 'room', arrival: '2026-12-01', departure: '2026-12-03' }])

  const cancelBooking = page.getByRole('button', { name: 'Cancel booking', exact: true })
  const cancelDialog = page.getByRole('dialog', { name: 'Cancel booking?' })
  await cancelBooking.click()
  await expect(cancelDialog.getByText('Smith')).toBeVisible()
  await expect(cancelDialog.getByText('2026-12-01')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(cancelDialog).toHaveCount(0)
  expect(cancellations).toHaveLength(0)

  await cancelBooking.click()
  await cancelDialog.getByRole('button', { name: 'Yes, cancel booking' }).click()
  await expect(page.getByRole('article').getByText('Cancelled', { exact: true })).toBeVisible()
  expect(cancellations).toEqual([{ status: 'Cancelled' }])
})

test('only system administrators can edit hotel details', async ({ page }) => {
  let hotel = { id: 'hotel', name: 'Accra Lodge', role: 'Administrator', telephone: '024 000 0000', address: 'Old Address' }
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/login')) {
      const isSystemAdmin = request.postDataJSON().email === 'system@example.test'
      await route.fulfill({ json: { id: 'staff', token: 'session', refreshToken: 'refresh', name: 'Tom', isSystemAdmin } })
    } else if (path.endsWith('/auth/properties') || path.endsWith('/platform/properties')) {
      await route.fulfill({ json: [hotel] })
    } else if (path.endsWith('/platform/properties/hotel') && request.method() === 'PUT') {
      hotel = { ...hotel, ...request.postDataJSON() }
      await route.fulfill({ status: 204 })
    } else {
      await route.fulfill({ json: [] })
    }
  })

  async function signIn(email: string) {
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password', { exact: true }).fill('example-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  }

  await page.goto('/')
  await signIn('property@example.test')
  await expect(page.getByRole('heading', { name: hotel.name, level: 1 })).toBeVisible()
  const menu = page.getByRole('button', { name: 'Open navigation' })
  if (await menu.isVisible()) await menu.click()
  const navigation = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(navigation.getByRole('button', { name: 'Audit log' })).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Hotel details' })).toHaveCount(0)
  await expect(navigation.getByRole('button', { name: 'Tenants' })).toHaveCount(0)
  if (await page.getByRole('dialog', { name: 'Workspace navigation' }).isVisible()) await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Sign out' }).click()

  await signIn('system@example.test')
  await expect(page.getByRole('heading', { name: 'Hotel tenants' })).toBeVisible()
  const tenant = page.getByRole('article').filter({ hasText: hotel.name })
  await tenant.getByRole('button', { name: 'Edit', exact: true }).click()
  const editor = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Edit tenant', exact: true }) })
  await expect(editor.getByLabel('Telephone')).toHaveValue('024 000 0000')
  await editor.getByLabel('Telephone').fill('+233 24 555 1234')
  await editor.getByLabel('Address', { exact: true }).fill('18 High Street, Accra')
  await editor.getByRole('button', { name: 'Save tenant' }).click()
  await expect(tenant.getByText('Telephone +233 24 555 1234')).toBeVisible()
  await expect(tenant.getByText('18 High Street, Accra')).toBeVisible()
})

test('a rejected session returns to sign-in when renewal fails', async ({ page }) => {
  let expired = false
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/login')) {
      await route.fulfill({ json: { id: 'staff', token: 'session', refreshToken: 'refresh', name: 'Tom', isSystemAdmin: true } })
    } else if (path.endsWith('/auth/refresh')) {
      await route.fulfill({ status: 503 })
    } else if (expired && path.endsWith('/platform/audit')) {
      await route.fulfill({ status: 401 })
    } else {
      await route.fulfill({ json: [] })
    }
  })

  await page.goto('/')
  await page.getByLabel('Email address').fill('tom@example.test')
  await page.getByLabel('Password', { exact: true }).fill('example-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Hotel tenants' })).toBeVisible()
  expired = true

  const menu = page.getByRole('button', { name: 'Open navigation' })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('button', { name: 'Audit log', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
})

test('a signed-in user can change their password and return to sign-in', async ({ page }) => {
  const changes: unknown[] = []
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/login')) {
      await route.fulfill({ json: { id: 'staff', token: 'session', refreshToken: 'refresh', name: 'Tom', isSystemAdmin: true } })
    } else if (path.endsWith('/change-password')) {
      changes.push(request.postDataJSON())
      await route.fulfill({ status: 204 })
    } else {
      await route.fulfill({ json: [] })
    }
  })

  await page.goto('/')
  await page.getByLabel('Email address').fill('tom@example.test')
  await page.getByLabel('Password', { exact: true }).fill('example-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Hotel tenants' })).toBeVisible()
  const menu = page.getByRole('button', { name: 'Open navigation' })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await page.getByLabel('Current password', { exact: true }).fill('example-password')
  await page.getByLabel('New password', { exact: true }).fill('changed-password')
  await page.getByLabel('Confirm new password').fill('mismatched-password')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByRole('alert')).toContainText('The new passwords do not match.')
  expect(changes).toHaveLength(0)

  await page.getByLabel('Confirm new password').fill('changed-password')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Password updated.')
  expect(changes).toEqual([{ currentPassword: 'example-password', newPassword: 'changed-password' }])
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
})
