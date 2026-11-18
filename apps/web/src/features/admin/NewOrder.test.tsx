// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
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
import { todayISO } from '../../lib/dates'
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
const session: AuthService = {
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
      <AuthProvider service={session}>
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

describe('admin orders for a shop', () => {
  it('opens from the plus button on the Orders screen', async () => {
    renderAt('/admin/orders')
    await userEvent.click(await screen.findByRole('link', { name: 'New order' }))
    expect(await screen.findByRole('heading', { name: 'New order' })).toBeInTheDocument()
  })

  it('cannot be placed until a shop and an item are chosen', async () => {
    renderAt('/admin/orders/new')
    const place = await screen.findByRole('button', { name: 'Place order' })
    expect(place).toBeDisabled()
    await userEvent.click(await screen.findByRole('radio', { name: /Kavi Tiffin Centre/ }))
    expect(place).toBeDisabled() // a shop, but no item yet
    await userEvent.click((await screen.findAllByRole('button', { name: 'Add' }))[0])
    expect(place).toBeEnabled()
  })

  it('places the order at today’s rates, then it can be billed and delivered', async () => {
    const state = renderAt('/admin/orders/new')
    await userEvent.click(await screen.findByRole('radio', { name: /Kavi Tiffin Centre/ }))
    const sugar = await screen.findByText('Sugar')
    const row = sugar.closest('li')!
    await userEvent.click(within(row).getByRole('button', { name: 'Add' }))
    await userEvent.click(within(row).getByRole('button', { name: /One more Sugar/ }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Note (optional)' }), 'phoned at 8')
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }))

    // It opens like any other order.
    expect(await screen.findByRole('heading', { name: 'Kavi Tiffin Centre' })).toBeInTheDocument()
    const order = state.orders.at(-1)!
    expect(order).toMatchObject({ shopId: 's4', status: 'placed', note: 'phoned at 8' })
    expect(order.items).toEqual([{ productId: 'p7', qty: 2, rate: state.rates[todayISO()].p7 }])
    expect(screen.getByText('phoned at 8')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Generate bill' }))
    expect(await screen.findByRole('heading', { name: /^Bill RK\// })).toBeInTheDocument()
    expect(state.orders.at(-1)!.status).toBe('billed')

    await userEvent.click(screen.getByRole('link', { name: 'Back' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Mark delivered' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm delivered' }))
    await waitFor(() => expect(state.orders.at(-1)!.status).toBe('delivered'))
  })

  it('shows only shops that are switched on, and finds a shop by name', async () => {
    const state = createMockState({ seedDemo: true })
    state.shops.find((s) => s.id === 's4')!.isActive = false
    render(
      <MemoryRouter initialEntries={['/admin/orders/new']}>
        <AuthProvider service={session}>
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
    expect(await screen.findByRole('radio', { name: /Annam Hotel/ })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /Kavi Tiffin Centre/ })).not.toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox'), 'lakshmi')
    expect(screen.queryByRole('radio', { name: /Annam Hotel/ })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Lakshmi Stores/ })).toBeInTheDocument()
  })

  it('says what to do when there are no rates for today', async () => {
    const state = createMockState({ seedDemo: true })
    for (const day of Object.keys(state.rates)) delete state.rates[day]
    render(
      <MemoryRouter initialEntries={['/admin/orders/new']}>
        <AuthProvider service={session}>
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
    expect(await screen.findByText(/Set today's rates first/)).toBeInTheDocument()
  })

  it('shows in Tamil', async () => {
    renderAt('/admin/orders/new')
    await userEvent.click(await screen.findByRole('button', { name: 'Place order' }))
    setLanguage('ta')
    expect(await screen.findByRole('heading', { name: 'புது ஆர்டர்' })).toBeInTheDocument()
  })
})
