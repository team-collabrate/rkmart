// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { ApiProvider } from '../../data/ApiProvider'
import { makeQueryClient } from '../../data/apiContext'
import { createMockAdminApi } from '../../data/mockAdminApi'
import { createMockShopApi } from '../../data/mockShopApi'
import { createMockState, type MockState } from '../../data/mockState'
import { setLanguage } from '../../i18n'
import { todayISO } from '../../lib/dates'
import { AuthProvider } from '../auth/AuthProvider'
import type { AuthService, Profile } from '../auth/types'
import { useCart } from './cartStore'

const owner: Profile = {
  id: 'demo-shop',
  role: 'shop',
  shopId: 's1',
  fullName: 'Murugan',
  phone: '9100000001',
  language: 'en',
}

function sessionFor(profile: Profile): AuthService {
  return {
    getSession: async () => profile,
    signIn: async () => ({ ok: false, error: 'unknown' }),
    signOut: async () => {},
    saveLanguage: async () => {},
    onSignedOut: () => () => {},
  }
}

const today = todayISO()

function renderAt(path: string, state: MockState = createMockState(), profile: Profile = owner) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider service={sessionFor(profile)}>
        <ApiProvider
          api={createMockAdminApi({ state })}
          shopApi={createMockShopApi(state, () => 's1')}
          client={makeQueryClient()}
        >
          <App />
        </ApiProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
  return state
}

/** A day where RK has set rates for three items. */
function stateWithRates(): MockState {
  const state = createMockState()
  state.rates[today] = { p1: 1350, p5: 140, p7: 46 }
  return state
}

const row = (name: string) => screen.getByText(name).closest('li') as HTMLElement

beforeEach(() => {
  localStorage.clear()
  useCart.setState({ ownerId: null, lines: {}, labels: {}, note: '' })
  setLanguage('en')
})

describe('order screen', () => {
  it('lists the items that have a rate today, with their rates', async () => {
    renderAt('/shop/order', stateWithRates())
    expect(await screen.findByText('Ponni rice')).toBeInTheDocument()
    expect(within(row('Ponni rice')).getByText('₹1,350')).toBeInTheDocument()
    expect(screen.getByText('Sugar')).toBeInTheDocument()
    expect(screen.queryByText('Rava')).not.toBeInTheDocument() // no rate today
  })

  it('says so when RK has not set today’s rates', async () => {
    renderAt('/shop/order')
    expect(await screen.findByText(/Today's rates are not ready yet/)).toBeInTheDocument()
  })

  it('adds items, changes quantities and shows the running total', async () => {
    renderAt('/shop/order', stateWithRates())
    await userEvent.click(
      within(await screen.findByText('Ponni rice').then(() => row('Ponni rice'))).getByRole(
        'button',
        { name: 'Add' },
      ),
    )
    expect(screen.getByText(/1 item · ₹1,350.00/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'One more Ponni rice' }))
    expect(screen.getByLabelText('Quantity of Ponni rice')).toHaveValue('2')
    expect(screen.getByText(/1 item · ₹2,700.00/)).toBeInTheDocument()

    await userEvent.click(within(row('Sugar')).getByRole('button', { name: 'Add' }))
    const sugar = screen.getByLabelText('Quantity of Sugar')
    await userEvent.clear(sugar)
    await userEvent.type(sugar, '2.5')
    expect(screen.getByText(/2 items · ₹2,815.00/)).toBeInTheDocument()
  })

  it('removes an item when the quantity goes to zero', async () => {
    renderAt('/shop/order', stateWithRates())
    await userEvent.click(
      within(await screen.findByText('Sugar').then(() => row('Sugar'))).getByRole('button', {
        name: 'Add',
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'One less Sugar' }))
    expect(within(row('Sugar')).getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(screen.queryByText(/Review order/)).not.toBeInTheDocument()
  })

  it('searches by name', async () => {
    renderAt('/shop/order', stateWithRates())
    await userEvent.type(await screen.findByRole('searchbox'), 'sug')
    expect(screen.getByText('Sugar')).toBeInTheDocument()
    expect(screen.queryByText('Ponni rice')).not.toBeInTheDocument()
  })
})

describe('placing an order', () => {
  it('goes from the cart to a placed order the shop can see', async () => {
    const state = renderAt('/shop/order', stateWithRates())
    await userEvent.click(
      within(await screen.findByText('Ponni rice').then(() => row('Ponni rice'))).getByRole(
        'button',
        { name: 'Add' },
      ),
    )
    await userEvent.click(screen.getByRole('button', { name: 'One more Ponni rice' }))
    await userEvent.click(within(row('Sugar')).getByRole('button', { name: 'Add' }))
    const sugar = screen.getByLabelText('Quantity of Sugar')
    await userEvent.clear(sugar)
    await userEvent.type(sugar, '10')

    await userEvent.click(screen.getByRole('link', { name: 'Review order' }))
    expect(await screen.findByRole('heading', { name: 'Review your order' })).toBeInTheDocument()
    expect(screen.getByText('₹3,160.00', { selector: 'span' })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/Note for RK/), 'Before 8 am')
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }))

    expect(await screen.findByText(/Your order is placed/)).toBeInTheDocument()
    expect(screen.getByText('Ponni rice')).toBeInTheDocument()
    expect(screen.getByText('Before 8 am')).toBeInTheDocument()
    expect(state.orders).toHaveLength(1)
    expect(state.orders[0]).toMatchObject({ shopId: 's1', status: 'placed', note: 'Before 8 am' })
    expect(useCart.getState().lines).toEqual({}) // cart is empty again
  })

  it('shows the order in My orders afterwards', async () => {
    const state = stateWithRates()
    renderAt('/shop/order', state)
    await userEvent.click(
      within(await screen.findByText('Sugar').then(() => row('Sugar'))).getByRole('button', {
        name: 'Add',
      }),
    )
    await userEvent.click(screen.getByRole('link', { name: 'Review order' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Place order' }))
    await screen.findByText(/Your order is placed/)

    await userEvent.click(screen.getByRole('link', { name: /Orders/ }))
    expect(await screen.findByText('1 item · ₹46.00')).toBeInTheDocument()
    expect(screen.getByText('Placed')).toBeInTheDocument()
  })

  it('explains when an item lost its rate before the order was sent', async () => {
    const state = stateWithRates()
    renderAt('/shop/order', state)
    await userEvent.click(
      within(await screen.findByText('Sugar').then(() => row('Sugar'))).getByRole('button', {
        name: 'Add',
      }),
    )
    await userEvent.click(screen.getByRole('link', { name: 'Review order' }))
    await screen.findByRole('button', { name: 'Place order' })

    delete state.rates[today].p7 // RK removed the rate in the meantime
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }))
    expect(await screen.findByText(/An item has no rate today/)).toBeInTheDocument()
    expect(state.orders).toHaveLength(0)
  })

  it('names items that are no longer available and leaves them out', async () => {
    const state = stateWithRates()
    useCart.setState({
      ownerId: 'demo-shop',
      lines: { p1: 1, p3: 2 },
      labels: { p1: { en: 'Ponni rice', ta: '' }, p3: { en: 'Rava', ta: 'ரவை' } },
    })
    renderAt('/shop/order/review', state)
    expect(await screen.findByText('Not available today')).toBeInTheDocument()
    expect(screen.getByText('Rava')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Place order' }))
    await screen.findByText(/Your order is placed/)
    expect(state.orders[0].items.map((i) => i.productId)).toEqual(['p1'])
  })

  it('shows an empty cart kindly', async () => {
    renderAt('/shop/order/review', stateWithRates())
    expect(await screen.findByText('Your cart is empty.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add items' })).toBeInTheDocument()
  })
})

describe('repeat an order', () => {
  it('puts an earlier order back in the cart at today’s rates', async () => {
    renderAt('/shop/orders/o1', createMockState({ seedDemo: true }))
    expect(await screen.findByText(/Order of/)).toBeInTheDocument()
    expect(screen.getByText('Delivered')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Repeat this order' }))
    expect(await screen.findByRole('heading', { name: 'Review your order' })).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity of Ponni rice')).toHaveValue('4')
    expect(screen.getByLabelText('Quantity of Toor dal')).toHaveValue('10')
    // 4 x 1350 (today) + 10 x 140 + 20 x 46
    expect(screen.getByText('₹7,720.00', { selector: 'span' })).toBeInTheDocument()
  })

  it('offers to repeat the last order from the home screen', async () => {
    renderAt('/shop', createMockState({ seedDemo: true }))
    expect(await screen.findByText('Hello, Murugan')).toBeInTheDocument()
    expect(screen.getByText("Today's rates are ready: 15 items.")).toBeInTheDocument()
    expect(screen.getAllByText('Bill ready').length).toBeGreaterThan(0) // the latest demo order is billed

    await userEvent.click(screen.getByRole('button', { name: 'Repeat last order' }))
    expect(await screen.findByRole('heading', { name: 'Review your order' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Quantity of Tea powder')).toHaveValue('5'))
  })
})

describe('shop screens in Tamil', () => {
  it('shows the home and order screens in Tamil', async () => {
    setLanguage('ta')
    renderAt('/shop', createMockState({ seedDemo: true }), { ...owner, language: 'ta' })
    expect(await screen.findByText('வணக்கம், Murugan')).toBeInTheDocument()
    expect(screen.getByText('இன்றைய விலை தயார்: 15 பொருட்கள்.')).toBeInTheDocument()
    expect(screen.getAllByText('பில் தயார்').length).toBeGreaterThan(0)
  })
})
