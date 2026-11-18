// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppShell } from '../components/AppShell'
import { AuthProvider } from '../features/auth/AuthProvider'
import type { AuthService, Profile } from '../features/auth/types'
import { setLanguage } from '../i18n'
import { RequireRole } from './RequireRole'

function serviceFor(profile: Profile | null): AuthService {
  return {
    getSession: async () => profile,
    signIn: async () => ({ ok: false, error: 'unknown' }),
    signOut: async () => {},
    saveLanguage: async () => {},
    onSignedOut: () => () => {},
  }
}

const user = (role: Profile['role']): Profile => ({
  id: `u-${role}`,
  role,
  shopId: role === 'shop' ? 's1' : null,
  fullName: `Test ${role}`,
  phone: '9000000001',
  language: 'en',
})

function renderAt(path: string, profile: Profile | null) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider service={serviceFor(profile)}>
        <Routes>
          <Route path="/login" element={<p>LOGIN PAGE</p>} />
          <Route
            path="/shop"
            element={
              <RequireRole role="shop">
                <AppShell />
              </RequireRole>
            }
          >
            <Route index element={<p>SHOP HOME</p>} />
          </Route>
          <Route
            path="/admin"
            element={
              <RequireRole role="admin">
                <AppShell />
              </RequireRole>
            }
          >
            <Route path="orders" element={<p>ADMIN ORDERS</p>} />
            <Route path="rates" element={<p>ADMIN RATES</p>} />
          </Route>
          <Route path="/delivery" element={<p>DELIVERY HOME</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => setLanguage('en'))

describe('route guard', () => {
  it('sends a signed-out visitor to the login page', async () => {
    renderAt('/admin/orders', null)
    expect(await screen.findByText('LOGIN PAGE')).toBeInTheDocument()
  })

  it('lets the right role in', async () => {
    renderAt('/admin/orders', user('admin'))
    expect(await screen.findByText('ADMIN ORDERS')).toBeInTheDocument()
  })

  it('sends a shop owner away from the admin area to their own', async () => {
    renderAt('/admin/orders', user('shop'))
    expect(await screen.findByText('SHOP HOME')).toBeInTheDocument()
    expect(screen.queryByText('ADMIN ORDERS')).not.toBeInTheDocument()
  })

  it('sends a distributor to the delivery area', async () => {
    renderAt('/shop', user('distributor'))
    expect(await screen.findByText('DELIVERY HOME')).toBeInTheDocument()
  })
})

describe('app shell', () => {
  it('shows the shop owner four tabs', async () => {
    renderAt('/shop', user('shop'))
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Home', 'Order', 'Orders', 'Payments'])
  })

  it('shows the admin five tabs and switches them to Tamil', async () => {
    // Not Orders: that screen has its own header with the language switch.
    renderAt('/admin/rates', user('admin'))
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getAllByRole('link')).toHaveLength(5)

    await userEvent.click(screen.getByRole('button', { name: 'தமிழ்' }))
    expect(await within(nav).findByText('பாக்கி')).toBeInTheDocument()
  })

  it('shows who is signed in, with a role badge', async () => {
    renderAt('/shop', user('shop'))
    expect((await screen.findAllByText('Shop owner')).length).toBeGreaterThan(0)
    expect(screen.getByText('Test shop')).toBeInTheDocument()
  })
})
