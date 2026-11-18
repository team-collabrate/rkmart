// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { ApiProvider } from '../../data/ApiProvider'
import { makeQueryClient } from '../../data/apiContext'
import { createMockAdminApi } from '../../data/mockAdminApi'
import { createMockDeliveryApi } from '../../data/mockDeliveryApi'
import { createMockShopApi } from '../../data/mockShopApi'
import { createMockState } from '../../data/mockState'
import { setLanguage } from '../../i18n'
import { formatINR } from '../../lib/money'
import { AuthProvider } from '../auth/AuthProvider'
import type { AuthService, Profile } from '../auth/types'

const profiles: Record<string, Profile> = {
  admin: {
    id: 'demo-admin',
    role: 'admin',
    shopId: null,
    fullName: 'RK Owner',
    phone: '9000000001',
    language: 'en',
  },
  distributor: {
    id: 'demo-dist',
    role: 'distributor',
    shopId: null,
    fullName: 'Ravi',
    phone: '9200000001',
    language: 'en',
  },
  shop: {
    id: 'demo-shop',
    role: 'shop',
    shopId: 's1',
    fullName: 'Murugan',
    phone: '9100000001',
    language: 'en',
  },
}

function renderAs(role: keyof typeof profiles, path: string) {
  const state = createMockState({ seedDemo: true })
  const service: AuthService = {
    getSession: async () => profiles[role],
    signIn: async () => ({ ok: false, error: 'unknown' }),
    signOut: async () => {},
    saveLanguage: async () => {},
    onSignedOut: () => () => {},
  }
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider service={service}>
        <ApiProvider
          api={createMockAdminApi({ state })}
          shopApi={createMockShopApi(state, () => 's1')}
          deliveryApi={createMockDeliveryApi(state)}
          client={makeQueryClient()}
        >
          <App />
        </ApiProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
  return state
}

beforeEach(() => setLanguage('en'))

describe('deliveries (distributor)', () => {
  it('shows the bills to deliver with address, phone and amount, and no items or prices', async () => {
    const state = renderAs('distributor', '/delivery')
    expect(await screen.findByText('To deliver (1)')).toBeInTheDocument()
    expect(screen.getByText('Sri Murugan Cafe')).toBeInTheDocument()
    expect(screen.getByText('Town Hall')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Call/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^tel:/),
    )
    const bill = state.invoices.find((i) => i.invoiceNo.endsWith('0002'))!
    expect(screen.getByText(`₹${formatINR(bill.grandTotal)}`)).toBeInTheDocument()
    expect(screen.queryByText('Ponni rice')).not.toBeInTheDocument()
  })

  it('asks first, then marks delivered and moves it to the done list', async () => {
    const state = renderAs('distributor', '/delivery')
    await userEvent.click(await screen.findByRole('button', { name: 'Mark delivered' }))
    expect(state.orders.find((o) => o.id === 'o2')!.status).toBe('billed') // not yet

    await userEvent.click(screen.getByRole('button', { name: 'Confirm delivered' }))
    expect(await screen.findByText('Delivered (1)')).toBeInTheDocument()
    expect(screen.getByText('Nothing to deliver right now.')).toBeInTheDocument()
    expect(state.orders.find((o) => o.id === 'o2')!.status).toBe('delivered')
  })

  it('can back out of the confirmation', async () => {
    const state = renderAs('distributor', '/delivery')
    await userEvent.click(await screen.findByRole('button', { name: 'Mark delivered' }))
    await userEvent.click(screen.getByRole('button', { name: 'Not yet' }))
    expect(screen.getByRole('button', { name: 'Mark delivered' })).toBeInTheDocument()
    expect(state.orders.find((o) => o.id === 'o2')!.status).toBe('billed')
  })

  it('takes an optional photo of the signed copy', async () => {
    renderAs('distributor', '/delivery')
    await userEvent.click(await screen.findByRole('button', { name: 'Mark delivered' }))
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    expect(input).toHaveAttribute('accept', 'image/*')
    expect(input).toHaveAttribute('capture', 'environment')
    await userEvent.upload(input, new File(['x'], 'signed.jpg', { type: 'image/jpeg' }))
    expect(screen.getByText('signed.jpg')).toBeInTheDocument()
  })

  it('lists past deliveries by day, and shows Tamil', async () => {
    renderAs('distributor', '/delivery/history')
    expect(await screen.findByRole('heading', { name: 'Past deliveries' })).toBeInTheDocument()
    expect(await screen.findByText('Sri Murugan Cafe')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'தமிழ்' }))
    expect(await screen.findByRole('heading', { name: 'முந்தைய டெலிவரிகள்' })).toBeInTheDocument()
  })

  it('keeps the distributor out of the admin and shop areas', async () => {
    renderAs('distributor', '/admin/balances')
    expect(await screen.findByText('To deliver (1)')).toBeInTheDocument()
  })
})

describe('admin delivers a bill', () => {
  it('can mark a billed order delivered from its order screen', async () => {
    const state = renderAs('admin', '/admin/orders/o2')
    await userEvent.click(await screen.findByRole('button', { name: 'Mark delivered' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm delivered' }))
    await waitFor(() => expect(state.orders.find((o) => o.id === 'o2')!.status).toBe('delivered'))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Mark delivered' })).not.toBeInTheDocument(),
    )
  })
})

describe('balances (admin)', () => {
  it('lists shops by what they owe, biggest first, with the total to collect', async () => {
    const state = renderAs('admin', '/admin/balances')
    const owed = state.invoices.reduce((sum, i) => sum + i.grandTotal, 0) - 5000
    expect(await screen.findByText(`Total to collect: ₹${formatINR(owed)}`)).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]).getByText('Sri Murugan Cafe')).toBeInTheDocument()
    expect(within(rows[0]).getByText(`Owes ₹${formatINR(owed)}`)).toBeInTheDocument()
    expect(within(rows[1]).getByText('Nothing due')).toBeInTheDocument()
  })

  it('records a payment for a shop and the balance drops', async () => {
    const state = renderAs('admin', '/admin/balances')
    await userEvent.click(await screen.findByRole('link', { name: /Sri Murugan Cafe/ }))
    const before = state.invoices.reduce((sum, i) => sum + i.grandTotal, 0) - 5000
    expect(await screen.findByText(`Owes ₹${formatINR(before)}`)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Record a payment' }))
    await userEvent.type(screen.getByLabelText('Amount (₹)'), '2,000')
    await userEvent.click(screen.getByRole('radio', { name: 'UPI' }))
    await userEvent.click(screen.getByRole('button', { name: 'Record payment' }))

    expect(await screen.findByText('Payment of ₹2,000.00 recorded.')).toBeInTheDocument()
    expect(await screen.findByText(`Owes ₹${formatINR(before - 2000)}`)).toBeInTheDocument()
    expect(state.payments.at(-1)).toMatchObject({ amount: 2000, method: 'upi', shopId: 's1' })
  })

  it('refuses a bad amount before sending it', async () => {
    const state = renderAs('admin', '/admin/balances/s1')
    await userEvent.click(await screen.findByRole('button', { name: 'Record a payment' }))
    await userEvent.type(screen.getByLabelText('Amount (₹)'), '12.345')
    await userEvent.click(screen.getByRole('button', { name: 'Record payment' }))
    expect(await screen.findByText(/Enter an amount above 0/)).toBeInTheDocument()
    expect(state.payments).toHaveLength(1) // only the demo payment
  })

  it('names the bill a payment is for', async () => {
    const state = renderAs('admin', '/admin/balances/s1')
    await userEvent.click(await screen.findByRole('button', { name: 'Record a payment' }))
    await userEvent.type(screen.getByLabelText('Amount (₹)'), '100')
    const bill = state.invoices.find((i) => i.invoiceNo.endsWith('0002'))!
    await userEvent.selectOptions(screen.getByLabelText('For which bill'), bill.id)
    await userEvent.click(screen.getByRole('button', { name: 'Record payment' }))
    await screen.findByText('Payment of ₹100.00 recorded.')
    expect(state.payments.at(-1)!.invoiceId).toBe(bill.id)
    expect((await screen.findAllByText(new RegExp(`· ${bill.invoiceNo}`))).length).toBeGreaterThan(
      0,
    )
  })

  it('removes a wrong payment only with a reason', async () => {
    const state = renderAs('admin', '/admin/balances/s1')
    await userEvent.click(await screen.findByRole('button', { name: /Remove payment/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }))
    expect(await screen.findByText(/Please write the reason/)).toBeInTheDocument()
    expect(state.payments).toHaveLength(1)

    await userEvent.type(screen.getByLabelText('Reason'), 'Typed twice')
    await userEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }))
    expect(await screen.findByText('Payment removed.')).toBeInTheDocument()
    expect(state.payments).toHaveLength(0)
  })

  it('shows the statement with an amount and the balance after each line, in Tamil too', async () => {
    renderAs('admin', '/admin/balances/s1')
    expect(await screen.findByText('Bills and payments')).toBeInTheDocument()
    expect(await screen.findAllByText(/^[+−]₹/)).toHaveLength(3)
    // The statement has its own header with no language switch, so change the language directly.
    await act(async () => setLanguage('ta'))
    expect(await screen.findByText('பில்களும் பணமும்')).toBeInTheDocument()
  })
})

describe('payments (shop owner)', () => {
  it('shows what the shop owes with a reminder, and its own bills and payments', async () => {
    const state = renderAs('shop', '/shop/payments')
    const owed = state.invoices.reduce((sum, i) => sum + i.grandTotal, 0) - 5000
    expect(await screen.findByText(`You owe RK ₹${formatINR(owed)}`)).toBeInTheDocument()
    expect(
      screen.getByText(`Payment reminder: please pay ₹${formatINR(owed)} to RK.`),
    ).toBeInTheDocument()
    expect(screen.getByText('Payment (UPI)')).toBeInTheDocument()
    expect(screen.getAllByText(/^Bill RK\//)).toHaveLength(2)
  })

  it('shows a payment-due card on the home screen that links to the payments', async () => {
    const state = renderAs('shop', '/shop')
    const owed = state.invoices.reduce((sum, i) => sum + i.grandTotal, 0) - 5000
    const card = await screen.findByRole('link', {
      name: new RegExp(`Payment due: ₹${formatINR(owed)}`),
    })
    expect(card).toHaveAttribute('href', '/shop/payments')
  })

  it('says nothing is due when the shop has paid up, and shows Tamil', async () => {
    const state = renderAs('shop', '/shop/payments')
    state.payments[0].amount = state.invoices.reduce((sum, i) => sum + i.grandTotal, 0)
    await userEvent.click(await screen.findByRole('button', { name: 'தமிழ்' }))
    expect(await screen.findByText('பாக்கி இல்லை. நன்றி!')).toBeInTheDocument()
  })
})
