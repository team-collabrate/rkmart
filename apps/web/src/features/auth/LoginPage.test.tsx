// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { setLanguage } from '../../i18n'
import { AuthProvider } from './AuthProvider'
import { LoginPage } from './LoginPage'
import { createMockAuth, DEMO_PIN } from './mockAuth'

function renderLogin() {
  const service = createMockAuth(0)
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider service={service}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/shop" element={<p>SHOP AREA</p>} />
          <Route path="/admin/orders" element={<p>ADMIN AREA</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  setLanguage('en')
})

describe('login screen', () => {
  it('asks for a valid phone number first', async () => {
    renderLogin()
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter a valid 10-digit mobile number.')).toBeInTheDocument()
  })

  it('asks for the password', async () => {
    renderLogin()
    await userEvent.type(await screen.findByLabelText('Mobile number'), '9100000001')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter your 4-digit PIN.')).toBeInTheDocument()
  })

  it('shows a clear message for a wrong password', async () => {
    renderLogin()
    await userEvent.type(await screen.findByLabelText('Mobile number'), '9100000001')
    await userEvent.type(screen.getByLabelText('PIN'), '9999')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Wrong mobile number or PIN.')).toBeInTheDocument()
  })

  it('opens the shop area for a shop owner', async () => {
    renderLogin()
    await userEvent.type(await screen.findByLabelText('Mobile number'), '+91 91000 00001')
    await userEvent.type(screen.getByLabelText('PIN'), DEMO_PIN)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.getByText('SHOP AREA')).toBeInTheDocument())
  })

  it('opens the admin area for the admin', async () => {
    renderLogin()
    await userEvent.type(await screen.findByLabelText('Mobile number'), '9000000001')
    await userEvent.type(screen.getByLabelText('PIN'), DEMO_PIN)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.getByText('ADMIN AREA')).toBeInTheDocument())
  })

  it('can show the password and switch to Tamil', async () => {
    renderLogin()
    const password = await screen.findByLabelText('PIN')
    expect(password).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: /Show/ }))
    expect(password).toHaveAttribute('type', 'text')

    await userEvent.click(screen.getByRole('button', { name: 'தமிழ்' }))
    expect(await screen.findByLabelText('மொபைல் எண்')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'உள்நுழை' })).toBeInTheDocument()
  })
})

describe('login lockout', () => {
  it('tells the person to wait after five wrong PINs', async () => {
    renderLogin()
    await userEvent.type(await screen.findByLabelText('Mobile number'), '9100000001')
    for (let i = 1; i <= 5; i++) {
      await userEvent.clear(screen.getByLabelText('PIN'))
      await userEvent.type(screen.getByLabelText('PIN'), '0000')
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    }
    expect(
      await screen.findByText('Too many wrong tries. Wait 15 minutes, then try again.'),
    ).toBeInTheDocument()
  })
})
