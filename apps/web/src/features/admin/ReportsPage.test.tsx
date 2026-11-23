// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { ApiProvider } from '../../data/ApiProvider'
import { makeQueryClient } from '../../data/apiContext'
import { createMockAdminApi } from '../../data/mockAdminApi'
import { createMockDeliveryApi } from '../../data/mockDeliveryApi'
import { createMockShopApi } from '../../data/mockShopApi'
import { createMockState } from '../../data/mockState'
import { setLanguage } from '../../i18n'
import { AuthProvider } from '../auth/AuthProvider'
import type { AuthService, Profile } from '../auth/types'

const saved: { blob: Blob; name: string }[] = []
vi.mock('../../lib/files', () => ({
  saveFile: async (blob: Blob, name: string) => {
    saved.push({ blob, name })
  },
  openForPrint: async () => {},
}))

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

beforeEach(() => {
  setLanguage('en')
  saved.length = 0
})

describe('reports', () => {
  it('opens from the More page', async () => {
    renderAt('/admin/more')
    await userEvent.click(await screen.findByRole('link', { name: /Reports/ }))
    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument()
  })

  it('shows the week’s sales by day, shop and item, and what shops owe', async () => {
    renderAt('/admin/more/reports')
    await userEvent.click(await screen.findByRole('button', { name: 'Last 7 days' }))
    expect((await screen.findAllByText(/1 bill/)).length).toBe(2) // the demo has a bill on two days

    await userEvent.click(screen.getByRole('button', { name: 'Shop' }))
    expect(await screen.findByText('Sri Murugan Cafe')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Item' }))
    expect(await screen.findByText('Ponni rice')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Dues' }))
    expect(await screen.findByText(/Last paid/)).toBeInTheDocument()
  })

  it('exports the list that is showing as a CSV file', async () => {
    renderAt('/admin/more/reports')
    await userEvent.click(await screen.findByRole('button', { name: 'Last 7 days' }))
    await userEvent.click(screen.getByRole('button', { name: 'Shop' }))
    await screen.findByText('Sri Murugan Cafe')
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0].name).toMatch(/^sales-by-shop_\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}\.csv$/)
    const text = await saved[0].blob.text()
    expect(text).toContain('Shop,Bills,Taxable value,GST,Total')
    expect(text).toContain('Sri Murugan Cafe')
  })

  it('shows in Tamil', async () => {
    renderAt('/admin/more/reports')
    await screen.findByRole('heading', { name: 'Reports' })
    setLanguage('ta')
    expect(await screen.findByRole('heading', { name: 'அறிக்கைகள்' })).toBeInTheDocument()
  })
})
