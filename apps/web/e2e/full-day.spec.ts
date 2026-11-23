import { expect, test, type Page } from '@playwright/test'

// A working day, told as stories with the three kinds of people. The demo keeps its data in memory
// and starts fresh on every page load, so each story runs in one go without reloading: a shop owner
// orders, the admin bills it, the delivery person delivers it; the admin records a payment and the
// reports and the shop's statement agree.

const PIN = '1234'
const SHOP = '9100000001' // Murugan, Sri Murugan Cafe
const ADMIN = '9000000001'
const DELIVERY = '9200000001'

async function signIn(page: Page, phone: string, pin = PIN) {
  await page.getByLabel('Mobile number').fill(phone)
  await page.getByLabel('PIN').fill(pin)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
}

test.describe.configure({ mode: 'serial' })

test('login protects against guessing', async ({ page }) => {
  await page.goto('/login')
  await signIn(page, '9876543210', '0000')
  await expect(page.getByText('Wrong mobile number or PIN.')).toBeVisible()
  for (let i = 0; i < 4; i++) await signIn(page, '9876543210', '0000')
  await expect(
    page.getByText('Too many wrong tries. Wait 15 minutes, then try again.'),
  ).toBeVisible()
  // PINs are four digits only
  await page.getByLabel('PIN').fill('')
  await page.getByLabel('PIN').pressSequentially('12ab56')
  await expect(page.getByLabel('PIN')).toHaveValue('1256')
})

test('shop orders, admin bills, delivery person delivers', async ({ page }) => {
  await page.goto('/login')

  // 1. The shop owner places an order.
  await signIn(page, SHOP)
  await expect(page.getByText('items today')).toBeVisible()
  await page.getByRole('link', { name: 'Order now' }).click()
  const toor = page.getByRole('listitem').filter({ hasText: 'Toor dal' })
  await toor.getByRole('button', { name: 'Add' }).click()
  await toor.getByRole('button', { name: 'One more Toor dal' }).click() // 2 kg
  await page.getByRole('link', { name: /Review order/ }).click()
  await page.getByLabel(/Note for RK/).fill('Deliver before 8 am')
  await page.getByRole('button', { name: 'Place order' }).click()
  await expect(page.getByText(/Your order is placed/)).toBeVisible()
  await expect(page.getByText('Toor dal')).toBeVisible()
  await signOut(page)

  // 2. The admin sees it and makes the bill.
  await signIn(page, ADMIN)
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible()
  await page.getByText('Sri Murugan Cafe').first().click()
  await expect(page.getByText('Deliver before 8 am')).toBeVisible()
  await page.getByRole('button', { name: 'Generate bill' }).click()
  const heading = page.getByRole('heading', { name: /^Bill RK\// })
  await expect(heading).toBeVisible()
  const billNo = ((await heading.textContent()) ?? '').replace('Bill ', '').trim()
  expect(billNo).toMatch(/^RK\/\d{4}\/\d{4}$/)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Orders' }).click()
  await signOut(page)

  // 3. The delivery person finds that bill and delivers it.
  await signIn(page, DELIVERY)
  await expect(page.getByRole('heading', { name: 'Deliveries' })).toBeVisible()
  const card = page.getByRole('listitem').filter({ hasText: billNo })
  await expect(card).toContainText('Sri Murugan Cafe')
  await card.getByRole('button', { name: 'Mark delivered' }).click()
  await card.getByRole('button', { name: 'Confirm delivered' }).click()
  await expect(page.getByText(/^Delivered \(\d+\)$/)).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: billNo })).toBeVisible()
  await signOut(page)
})

test('admin records the payment, reports agree, and the shop sees it', async ({ page }) => {
  await page.goto('/login')
  await signIn(page, ADMIN)
  const nav = page.getByRole('navigation', { name: 'Main' })

  // Balances: the shop owes money (the demo shop already has bills, plus today's).
  await nav.getByRole('link', { name: 'Balances' }).click()
  await expect(page.getByText(/Total to collect/)).toBeVisible()
  await page.getByText('Sri Murugan Cafe').first().click()
  await page.getByRole('button', { name: 'Record a payment' }).click()
  await page.getByLabel('Amount (₹)').fill('500')
  await page.getByRole('button', { name: 'Record payment' }).click()
  await expect(page.getByText(/Payment of ₹500\.00 recorded/)).toBeVisible()

  // Reports: the week's sales include that shop and the bill, and the dues list shows the payment date.
  await nav.getByRole('link', { name: 'More' }).click()
  await page.getByRole('link', { name: /Reports/ }).click()
  await page.getByRole('button', { name: 'Last 7 days' }).click()
  await page.getByRole('button', { name: 'Shop' }).click()
  await expect(page.getByText('Sri Murugan Cafe')).toBeVisible()
  await page.getByRole('button', { name: 'Item' }).click()
  await expect(page.getByText('Toor dal')).toBeVisible()
  await page.getByRole('button', { name: 'Dues' }).click()
  await expect(page.getByText(/Last paid/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()

  // The shop owner sees the payment in their statement.
  await signIn(page, SHOP)
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Payments' })
    .click()
  await expect(page.getByText('Payment (Cash)')).toBeVisible()
  await expect(page.getByText(/Bill RK\//).first()).toBeVisible()
})

test('Tamil works end to end for a shop owner', async ({ page }) => {
  await page.goto('/login')
  // The login page can be switched on its own.
  await page.getByRole('button', { name: 'தமிழ்' }).click()
  await expect(page.getByRole('button', { name: 'உள்நுழை' })).toBeVisible()
  await page.getByLabel('மொபைல் எண்').fill(SHOP)
  await page.getByLabel('பின்').fill(PIN)
  await page.getByRole('button', { name: 'உள்நுழை' }).click()
  // After sign in the person's own saved language applies; switch to Tamil and back.
  await expect(page.getByText('items today')).toBeVisible()
  await page.getByRole('button', { name: 'தமிழ்' }).click()
  await expect(page.getByText('பொருட்கள் இன்று')).toBeVisible()
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByText('items today')).toBeVisible()
})
