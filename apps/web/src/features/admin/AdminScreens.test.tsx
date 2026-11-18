// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { ApiProvider } from '../../data/ApiProvider'
import { makeQueryClient } from '../../data/apiContext'
import { createMockAdminApi } from '../../data/mockAdminApi'
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
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider service={adminSession}>
        <ApiProvider api={createMockAdminApi()} client={makeQueryClient()}>
          <App />
        </ApiProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => setLanguage('en'))

describe("today's rates", () => {
  it('warns about items with no rate, then fills them from yesterday in one tap', async () => {
    renderAt('/admin/rates')
    expect(
      await screen.findByText('15 items have no rate. Shops cannot order them today.'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Same as yesterday/ }))
    expect(screen.getByLabelText('Rate for Ponni rice')).toHaveValue('1330')
    expect(screen.queryByText(/have no rate/)).not.toBeInTheDocument()
  })

  it('shows the change against yesterday and saves', async () => {
    renderAt('/admin/rates')
    await userEvent.click(await screen.findByRole('button', { name: /Same as yesterday/ }))

    const ponni = screen.getByLabelText('Rate for Ponni rice')
    await userEvent.clear(ponni)
    await userEvent.type(ponni, '1350')
    expect(screen.getByLabelText('Change 20 rupees')).toHaveTextContent('+20')

    await userEvent.click(screen.getByRole('button', { name: "Save today's rates" }))
    expect(await screen.findByText('Saved 15 rates.')).toBeInTheDocument()
  })

  it('refuses a rate that is not a number', async () => {
    renderAt('/admin/rates')
    const sugar = await screen.findByLabelText('Rate for Sugar')
    await userEvent.type(sugar, 'abc')
    await userEvent.click(screen.getByRole('button', { name: "Save today's rates" }))
    expect(await screen.findByText(/Some rates are not valid/)).toBeInTheDocument()
    expect(sugar).toHaveAttribute('aria-invalid', 'true')
  })

  it('says so when nothing changed', async () => {
    renderAt('/admin/rates')
    await screen.findByLabelText('Rate for Sugar')
    await userEvent.click(screen.getByRole('button', { name: "Save today's rates" }))
    expect(await screen.findByText('Nothing has changed.')).toBeInTheDocument()
  })

  it('shows the screen in Tamil', async () => {
    renderAt('/admin/rates')
    await screen.findByLabelText('Rate for Sugar')
    await userEvent.click(screen.getByRole('button', { name: 'தமிழ்' }))
    expect(await screen.findByRole('heading', { name: 'இன்றைய விலை' })).toBeInTheDocument()
    expect(screen.getByLabelText('சர்க்கரை விலை')).toBeInTheDocument()
  })
})

describe('items', () => {
  it('lists items and searches them', async () => {
    renderAt('/admin/more/items')
    expect(await screen.findByText('Ponni rice')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox'), 'sugar')
    expect(screen.getByText('Sugar')).toBeInTheDocument()
    expect(screen.queryByText('Ponni rice')).not.toBeInTheDocument()
  })

  it('checks the form, then adds an item', async () => {
    renderAt('/admin/more/items/new')
    await userEvent.clear(await screen.findByLabelText('Unit'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getAllByText('This is required.')).toHaveLength(2)

    await userEvent.type(screen.getByLabelText('Name in English'), 'Jaggery')
    await userEvent.type(screen.getByLabelText('Unit'), 'kg')
    await userEvent.type(screen.getByLabelText('HSN code'), '17A1')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('HSN code must be 4 to 8 digits.')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('HSN code'))
    await userEvent.type(screen.getByLabelText('HSN code'), '1701')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Jaggery')).toBeInTheDocument()
  })

  it('switches an item off', async () => {
    renderAt('/admin/more/items/p7')
    await userEvent.click(await screen.findByRole('button', { name: 'Switch off' }))
    const row = (await screen.findByText('Sugar')).closest('li')!
    await waitFor(() => expect(within(row).getByText('Off')).toBeInTheDocument())
  })
})

describe('shops', () => {
  it('rejects a bad GSTIN and saves a good one', async () => {
    renderAt('/admin/more/shops/s1')
    const gstin = await screen.findByLabelText('GSTIN')
    await userEvent.type(gstin, 'BAD')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter a valid 15-character GSTIN.')).toBeInTheDocument()

    await userEvent.clear(gstin)
    await userEvent.type(gstin, '33aaaaa0000a1z5')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Annam Hotel')).toBeInTheDocument() // back on the list
  })
})

describe('logins', () => {
  it('creates a shop owner login', async () => {
    renderAt('/admin/more/users/new')
    await userEvent.type(await screen.findByLabelText('Name'), 'Ravi')
    await userEvent.type(screen.getByLabelText('Mobile number'), '98765 43210')
    await userEvent.type(screen.getByLabelText('PIN'), '1234')
    await userEvent.selectOptions(screen.getByLabelText('Shop'), 'Annam Hotel')
    await userEvent.click(screen.getByRole('button', { name: 'Create login' }))
    expect(await screen.findByText('Ravi')).toBeInTheDocument()
    expect(screen.getByText(/9876543210/)).toBeInTheDocument()
  })

  it('asks for a shop when the role is shop owner', async () => {
    renderAt('/admin/more/users/new')
    await userEvent.type(await screen.findByLabelText('Name'), 'Ravi')
    await userEvent.type(screen.getByLabelText('Mobile number'), '9876543210')
    await userEvent.type(screen.getByLabelText('PIN'), '1234')
    await userEvent.click(screen.getByRole('button', { name: 'Create login' }))
    expect(await screen.findByText('Choose the shop for this shop owner.')).toBeInTheDocument()
  })

  it('says when a mobile number already has a login', async () => {
    renderAt('/admin/more/users/new')
    await userEvent.type(await screen.findByLabelText('Name'), 'Someone')
    await userEvent.type(screen.getByLabelText('Mobile number'), '9200000001')
    await userEvent.type(screen.getByLabelText('PIN'), '1234')
    await userEvent.selectOptions(screen.getByLabelText('Role'), 'distributor')
    await userEvent.click(screen.getByRole('button', { name: 'Create login' }))
    expect(await screen.findByText('That mobile number already has a login.')).toBeInTheDocument()
  })

  it('resets a password and will not let the admin switch themselves off', async () => {
    renderAt('/admin/more/users/demo-dist')
    await userEvent.type(await screen.findByLabelText('New PIN'), '4321')
    await userEvent.click(screen.getByRole('button', { name: 'Reset PIN' }))
    expect(await screen.findByText('PIN changed.')).toBeInTheDocument()
  })

  it('protects the admin’s own login', async () => {
    renderAt('/admin/more/users/demo-admin')
    expect(await screen.findByText('You cannot switch off yourself.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Switch off' })).not.toBeInTheDocument()
  })
})

describe('company settings', () => {
  it('saves valid settings and rejects a bad GSTIN', async () => {
    renderAt('/admin/more/settings')
    const name = await screen.findByLabelText('Company name')
    await userEvent.clear(name)
    await userEvent.type(name, 'RK Agency Coimbatore')
    await userEvent.type(screen.getByLabelText('GSTIN'), 'NOPE')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter a valid 15-character GSTIN.')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('GSTIN'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })
})

describe('more menu', () => {
  it('links to the four setup areas', async () => {
    renderAt('/admin/more')
    for (const label of ['Items', 'Shops', 'Logins', 'Company settings']) {
      expect(await screen.findByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })
})
