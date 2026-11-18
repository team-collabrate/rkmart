// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { ApiProvider } from '../../data/ApiProvider'
import { makeQueryClient } from '../../data/apiContext'
import { createMockAdminApi } from '../../data/mockAdminApi'
import { createMockState } from '../../data/mockState'
import { setLanguage } from '../../i18n'
import { AuthProvider } from '../auth/AuthProvider'
import type { AuthService, Profile } from '../auth/types'

const admin: Profile = {
  id: 'demo-admin',
  role: 'admin',
  shopId: null,
  fullName: 'RK Owner',
  phone: '9000000001',
  language: 'en',
}

const adminSession: AuthService = {
  getSession: async () => admin,
  signIn: async () => ({ ok: false, error: 'unknown' }),
  signOut: async () => {},
  saveLanguage: async () => {},
  onSignedOut: () => () => {},
}

function renderAt(path: string) {
  const state = createMockState({ seedDemo: true })
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider service={adminSession}>
        <ApiProvider api={createMockAdminApi({ state })} client={makeQueryClient()}>
          <App />
        </ApiProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
  return state
}

beforeEach(() => setLanguage('en'))

describe('orders inbox', () => {
  it('lists the day’s orders with counts and filters them', async () => {
    renderAt('/admin/orders')
    expect(await screen.findByText('Lakshmi Stores')).toBeInTheDocument()
    expect(screen.getByText('Annam Hotel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All (3)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New (3)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Billed (0)' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Billed (0)' }))
    expect(screen.getByText('No orders in this list.')).toBeInTheDocument()
  })

  it('shows yesterday’s bill and goes back a day', async () => {
    renderAt('/admin/orders')
    await screen.findByText('Lakshmi Stores')
    await userEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(await screen.findByText('Sri Murugan Cafe')).toBeInTheDocument()
    expect(screen.getByText(/RK\/\d{4}\/0002$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next day' })).toBeEnabled()
  })

  it('cannot go past today', async () => {
    renderAt('/admin/orders')
    await screen.findByText('Lakshmi Stores')
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled()
  })

  it('asks first, then bills all new orders with numbers in order', async () => {
    const state = renderAt('/admin/orders')
    await userEvent.click(await screen.findByRole('button', { name: 'Bill all new (3)' }))
    expect(screen.getByText(/Generate 3 bills now\?/)).toBeInTheDocument()
    expect(state.invoices).toHaveLength(2) // nothing yet

    await userEvent.click(screen.getByRole('button', { name: 'Yes, generate' }))
    expect(await screen.findByText('3 bills generated.')).toBeInTheDocument()
    expect(state.invoices.map((i) => i.invoiceNo.slice(-4))).toEqual([
      '0001',
      '0002',
      '0003',
      '0004',
      '0005',
    ])
    // Oldest order first: Lakshmi (03:20) got 0003.
    expect(state.invoices.find((i) => i.invoiceNo.endsWith('0003'))!.shopName).toBe(
      'Lakshmi Stores',
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Billed (3)' })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('button', { name: /Generate bills/ })).not.toBeInTheDocument()
  })

  it('keeps everything as it was when the owner says not now', async () => {
    const state = renderAt('/admin/orders')
    await userEvent.click(await screen.findByRole('button', { name: 'Bill all new (3)' }))
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(state.invoices).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Bill all new (3)' })).toBeInTheDocument()
  })

  it('shows the inbox in Tamil', async () => {
    renderAt('/admin/orders')
    await screen.findByText('Lakshmi Stores')
    await userEvent.click(screen.getByRole('button', { name: 'தமிழ்' }))
    expect(await screen.findByRole('heading', { name: 'ஆர்டர்கள்' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'புதுசு (3)' })).toBeInTheDocument()
  })
})

describe('order detail', () => {
  it('shows the shop, the note and the lines with the sum before GST', async () => {
    renderAt('/admin/orders/o4')
    expect(await screen.findByRole('heading', { name: 'Annam Hotel' })).toBeInTheDocument()
    expect(screen.getByText('Call before delivery')).toBeInTheDocument()
    expect(screen.getByLabelText(/Quantity · Toor dal/)).toHaveValue('8')
    // 4 x 780 + 3 x 380 + 8 x 140
    expect(screen.getByText('₹5,380.00')).toBeInTheDocument()
  })

  it('must save quantity changes before the bill can be made', async () => {
    renderAt('/admin/orders/o4')
    const sugar = await screen.findByLabelText(/Quantity · Toor dal/)
    const generate = screen.getByRole('button', { name: 'Generate bill' })
    expect(generate).toBeEnabled()

    await userEvent.clear(sugar)
    await userEvent.type(sugar, '5')
    expect(generate).toBeDisabled()
    expect(screen.getByText('Save your changes before making the bill.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generate bill' })).toBeEnabled()
    expect(screen.getByLabelText(/Quantity · Toor dal/)).toHaveValue('5')
  })

  it('removes an item, can put it back, and refuses an empty order', async () => {
    const state = renderAt('/admin/orders/o3')
    await screen.findByLabelText(/Quantity · Sugar/)
    await userEvent.click(screen.getByRole('button', { name: 'Remove Sugar' }))
    expect(screen.getByText('Removed')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Put back' }))
    expect(screen.queryByText('Removed')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Remove Sugar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove Ponni rice' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/Keep at least one item/)).toBeInTheDocument()
    expect(state.orders.find((o) => o.id === 'o3')!.items).toHaveLength(2)
  })

  it('saves a removed item and flags a bad quantity', async () => {
    const state = renderAt('/admin/orders/o3')
    const sugar = await screen.findByLabelText(/Quantity · Sugar/)
    await userEvent.clear(sugar)
    await userEvent.type(sugar, 'abc')
    expect(sugar).toHaveAttribute('aria-invalid', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(
      await screen.findAllByText('Enter a number above 0, up to 3 decimals.'),
    ).not.toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: 'Remove Sugar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Changes saved.')
    expect(state.orders.find((o) => o.id === 'o3')!.items.map((i) => i.productId)).toEqual(['p1'])
  })

  it('makes the bill and opens it', async () => {
    const state = renderAt('/admin/orders/o3')
    await userEvent.click(await screen.findByRole('button', { name: 'Generate bill' }))
    expect(await screen.findByRole('heading', { name: /Bill RK\/\d{4}\/0003/ })).toBeInTheDocument()
    expect(state.orders.find((o) => o.id === 'o3')!.status).toBe('billed')
  })

  it('locks the quantities once the order is billed', async () => {
    renderAt('/admin/orders/o2') // yesterday's bill
    expect(
      await screen.findByText('Quantities can only be changed before the bill is made.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View bill/ })).toBeInTheDocument()
  })
})

describe('bill', () => {
  it('shows the GST bill with totals, previous balance and amount in words', async () => {
    const state = renderAt('/admin/orders/o2/bill')
    const inv = state.invoices.find((i) => i.orderId === 'o2')!
    expect(
      await screen.findByRole('heading', { name: `Bill ${inv.invoiceNo}` }),
    ).toBeInTheDocument()
    expect(screen.getByText('TAX INVOICE')).toBeInTheDocument()
    expect(screen.getByText('RK Agency')).toBeInTheDocument()
    expect(screen.getByText('CGST')).toBeInTheDocument()
    expect(screen.getByText('SGST')).toBeInTheDocument()
    expect(screen.queryByText('IGST')).not.toBeInTheDocument()
    expect(screen.getByText('Previous balance')).toBeInTheDocument()
    expect(screen.getByText(/Rupees .* Only/)).toBeInTheDocument()
    expect(screen.getByText(/Your company GSTIN is not filled in/)).toBeInTheDocument()
  })

  it('shows IGST for a shop in another state', async () => {
    const state = createMockState({ seedDemo: true })
    state.shops.find((s) => s.id === 's2')!.stateCode = '27'
    render(
      <MemoryRouter initialEntries={['/admin/orders/o3']}>
        <AuthProvider service={adminSession}>
          <ApiProvider api={createMockAdminApi({ state })} client={makeQueryClient()}>
            <App />
          </ApiProvider>
        </AuthProvider>
      </MemoryRouter>,
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Generate bill' }))
    expect(await screen.findByText('IGST')).toBeInTheDocument()
    expect(screen.queryByText('CGST')).not.toBeInTheDocument()
  })

  it('needs a reason, then cancels and sends the order back to New', async () => {
    const state = renderAt('/admin/orders/o2/bill')
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel this bill' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel the bill' }))
    expect(
      await screen.findByText('Please write the reason (at least 3 letters).'),
    ).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Reason for cancelling'), 'Wrong quantity')
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel the bill' }))
    expect(await screen.findByRole('button', { name: 'Generate bill' })).toBeInTheDocument()
    expect(state.orders.find((o) => o.id === 'o2')!.status).toBe('placed')
    expect(state.invoices.find((i) => i.orderId === 'o2')!.status).toBe('cancelled')
  })

  it('does not offer to cancel a delivered order’s bill', async () => {
    renderAt('/admin/orders/o1/bill')
    const note = await screen.findByText('Delivered orders cannot have their bill cancelled.')
    expect(within(note.parentElement!).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel this bill' })).not.toBeInTheDocument()
  })
})
