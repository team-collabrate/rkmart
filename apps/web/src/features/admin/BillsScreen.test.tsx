// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { ApiProvider } from '../../data/ApiProvider'
import { makeQueryClient } from '../../data/apiContext'
import { createMockAdminApi } from '../../data/mockAdminApi'
import { createMockState } from '../../data/mockState'
import { setLanguage } from '../../i18n'
import { todayISO } from '../../lib/dates'
import { AuthProvider } from '../auth/AuthProvider'
import type { AuthService, Profile } from '../auth/types'

// The real PDF library and the browser's download are replaced: these tests are about the screen.
const made = vi.hoisted(() => ({ calls: [] as string[][] }))
vi.mock('../../lib/pdf/makeDayPdf', () => ({
  makeDayPdf: async (_settings: unknown, invoices: { invoiceNo: string }[]) => {
    made.calls.push(invoices.map((i) => i.invoiceNo))
    return new Blob(['%PDF-fake'], { type: 'application/pdf' })
  },
}))
const delivered = vi.hoisted(() => ({ saved: [] as string[], printed: [] as string[] }))
vi.mock('../../lib/files', () => ({
  saveFile: async (_blob: Blob, name: string) => void delivered.saved.push(name),
  openForPrint: async (_blob: Blob, name: string) => void delivered.printed.push(name),
}))

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

/** The demo has two old bills; this makes `billed` of today's three orders into bills too. */
async function renderBills(billed: string[] = []) {
  const state = createMockState({ seedDemo: true })
  const api = createMockAdminApi({ state })
  for (const id of billed) await api.generateBill(id)
  render(
    <MemoryRouter initialEntries={['/admin/bills']}>
      <AuthProvider service={adminSession}>
        <ApiProvider api={api} client={makeQueryClient()}>
          <App />
        </ApiProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
  return { state, api }
}

beforeEach(() => {
  setLanguage('en')
  made.calls = []
  delivered.saved = []
  delivered.printed = []
})

describe("today's bills", () => {
  it('says so when nothing has been billed yet', async () => {
    await renderBills()
    expect(await screen.findByText(/No bills on this day yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Make PDF/ })).not.toBeInTheDocument()
  })

  it('lists the day’s bills with the total and makes one PDF of all of them', async () => {
    const { state } = await renderBills(['o3', 'o4'])
    expect(await screen.findByText('2 bills · ₹9,153.00')).toBeInTheDocument()
    expect(screen.getAllByText('Not in a PDF yet')).toHaveLength(2)

    await userEvent.click(screen.getByRole('button', { name: 'Make PDF of all bills (2)' }))
    expect(
      await screen.findByText('PDF version 1 is ready and saved (2 bills).'),
    ).toBeInTheDocument()
    expect(made.calls).toEqual([[expect.stringMatching(/0003$/), expect.stringMatching(/0004$/)]])
    expect(state.dayPdfs).toHaveLength(1)
    await waitFor(() => expect(screen.getAllByText('In PDF v1')).toHaveLength(2))
  })

  it('prints and downloads the PDF that was just made', async () => {
    await renderBills(['o3'])
    await userEvent.click(await screen.findByRole('button', { name: 'Make PDF of all bills (1)' }))
    await screen.findByText(/PDF version 1 is ready/)

    await userEvent.click(screen.getByRole('button', { name: 'Print' }))
    await userEvent.click(screen.getByRole('button', { name: 'Download' }))
    await waitFor(() => expect(delivered.saved).toHaveLength(1))
    expect(delivered.printed).toEqual([`rk-bills-${todayISO()}-v1.pdf`])
    expect(delivered.saved).toEqual([`rk-bills-${todayISO()}-v1.pdf`])
  })

  it('offers a PDF of only the new bills after one was made, and numbers it version 2', async () => {
    const { api } = await renderBills(['o3'])
    await userEvent.click(await screen.findByRole('button', { name: 'Make PDF of all bills (1)' }))
    await screen.findByText(/PDF version 1 is ready/)
    expect(screen.getByText('Every bill is already in a saved PDF.')).toBeInTheDocument()

    // Another order is billed after the first PDF.
    await api.generateBill('o4')
    const only = await screen.findByRole(
      'button',
      { name: 'Make PDF of only the 1 new bills' },
      { timeout: 3000 },
    )
    expect(
      screen.getByRole('button', { name: 'Make PDF of all 2 bills again' }),
    ).toBeInTheDocument()
    await userEvent.click(only)
    expect(
      await screen.findByText('PDF version 2 is ready and saved (1 bills).'),
    ).toBeInTheDocument()
    expect(made.calls[1]).toEqual([expect.stringMatching(/0004$/)])
  })

  it('downloads or prints an earlier version again from the saved list', async () => {
    await renderBills(['o3'])
    await userEvent.click(await screen.findByRole('button', { name: 'Make PDF of all bills (1)' }))
    await screen.findByText(/PDF version 1 is ready/)

    const row = (await screen.findByText(/^Version 1 · 1 bills/)).closest('li')!
    await userEvent.click(within(row).getByRole('button', { name: 'Download version 1' }))
    await waitFor(() => expect(delivered.saved).toEqual([`rk-bills-${todayISO()}-v1.pdf`]))
    await userEvent.click(within(row).getByRole('button', { name: 'Print version 1' }))
    await waitFor(() => expect(delivered.printed).toHaveLength(1))
  })

  it('goes back a day to yesterday’s bill', async () => {
    const { state } = await renderBills()
    await screen.findByText(/No bills on this day yet/)
    await userEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(await screen.findByText('Sri Murugan Cafe')).toBeInTheDocument()
    const yesterday = state.invoices.find((i) => i.orderId === 'o2')!
    expect(screen.getByText(yesterday.invoiceNo)).toBeInTheDocument()
  })

  it('shows the screen in Tamil', async () => {
    await renderBills(['o3'])
    await screen.findByRole('button', { name: 'Make PDF of all bills (1)' })
    await userEvent.click(screen.getByRole('button', { name: 'தமிழ்' }))
    expect(
      await screen.findByRole('button', { name: 'எல்லா பில்களுக்கும் PDF (1)' }),
    ).toBeInTheDocument()
  })
})
