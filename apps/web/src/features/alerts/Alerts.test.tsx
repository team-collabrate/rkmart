// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { ApiProvider } from '../../data/ApiProvider'
import { makeQueryClient } from '../../data/apiContext'
import { createMockAdminApi } from '../../data/mockAdminApi'
import { createMockDeliveryApi } from '../../data/mockDeliveryApi'
import { createMockPushApi } from '../../data/mockPushApi'
import { createMockShopApi } from '../../data/mockShopApi'
import { createMockState } from '../../data/mockState'
import { setLanguage } from '../../i18n'
import type { EnableResult, PushDevice, PushStatus } from '../../lib/push'
import { AuthProvider } from '../auth/AuthProvider'
import type { AuthService, Profile } from '../auth/types'
import { AlertsCard } from './AlertsCard'

const shop: Profile = {
  id: 'u1',
  role: 'shop',
  shopId: 's1',
  fullName: 'Murugan',
  phone: '9100000001',
  language: 'en',
}

/** A device that behaves as told, and remembers what the card asked of it. */
function fakeDevice(start: PushStatus, enable: EnableResult) {
  let status = start
  let token: string | null = start === 'on' ? 'tok-12345678' : null
  const calls: string[] = []
  const device: PushDevice = {
    platform: 'android',
    currentToken: () => token,
    status: async () => status,
    enable: async () => {
      calls.push('enable')
      if (enable.status === 'on') {
        status = 'on'
        token = enable.token ?? null
      }
      return enable
    },
    disable: async () => {
      calls.push('disable')
      status = 'off'
      const old = token
      token = null
      return old
    },
  }
  return { device, calls }
}

function renderCard(device: PushDevice, profile: Profile = shop) {
  const state = createMockState({ seedDemo: true })
  const push = createMockPushApi()
  const service: AuthService = {
    getSession: async () => profile,
    signIn: async () => ({ ok: false, error: 'unknown' }),
    signOut: async () => {},
    saveLanguage: async () => {},
    onSignedOut: () => () => {},
  }
  render(
    <MemoryRouter>
      <AuthProvider service={service}>
        <ApiProvider
          api={createMockAdminApi({ state })}
          shopApi={createMockShopApi(state, () => 's1')}
          deliveryApi={createMockDeliveryApi(state)}
          pushApi={push}
          client={makeQueryClient()}
        >
          <AlertsCard device={device} />
        </ApiProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
  return push
}

beforeEach(() => setLanguage('en'))

describe('alerts card', () => {
  it('turns alerts on and saves this device for the signed-in person', async () => {
    const { device, calls } = fakeDevice('off', {
      status: 'on',
      platform: 'android',
      token: 'fcm-token-1234',
    })
    const push = renderCard(device)
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on alerts' }))
    expect(await screen.findByText('Alerts are on for this device.')).toBeInTheDocument()
    expect(calls).toEqual(['enable'])
    expect(push.devices).toEqual([{ platform: 'android', token: 'fcm-token-1234' }])
  })

  it('turns alerts off and forgets the device', async () => {
    const { device } = fakeDevice('on', { status: 'on' })
    const push = renderCard(device)
    push.devices.push({ platform: 'android', token: 'tok-12345678' })
    await userEvent.click(await screen.findByRole('button', { name: 'Turn off alerts' }))
    expect(await screen.findByRole('button', { name: 'Turn on alerts' })).toBeInTheDocument()
    expect(push.devices).toEqual([])
  })

  it('explains what to do when the person said no', async () => {
    const { device } = fakeDevice('off', { status: 'denied' })
    const push = renderCard(device)
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on alerts' }))
    expect(await screen.findByText(/Alerts are blocked/)).toBeInTheDocument()
    expect(push.devices).toEqual([])
  })

  it('says so when this build has no alerts set up, instead of a button that does nothing', async () => {
    const { device } = fakeDevice('not_configured', { status: 'on' })
    renderCard(device)
    expect(await screen.findByText(/not set up in this version/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn on alerts' })).not.toBeInTheDocument()
  })

  it('says so when the browser cannot show alerts', async () => {
    const { device } = fakeDevice('unsupported', { status: 'on' })
    renderCard(device)
    expect(await screen.findByText(/cannot show alerts/)).toBeInTheDocument()
  })

  it('undoes the device when the server would not take it, and says so', async () => {
    const { device, calls } = fakeDevice('off', {
      status: 'on',
      platform: 'android',
      token: 'short',
    })
    const push = renderCard(device)
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on alerts' }))
    expect(
      await screen.findByText('Could not change alerts. Please try again.'),
    ).toBeInTheDocument()
    expect(calls).toEqual(['enable', 'disable'])
    expect(push.devices).toEqual([])
    expect(await screen.findByRole('button', { name: 'Turn on alerts' })).toBeInTheDocument()
  })

  it('describes what an admin gets, differently from a shop owner', async () => {
    const { device } = fakeDevice('off', { status: 'on' })
    renderCard(device, { ...shop, role: 'admin', shopId: null })
    expect(await screen.findByText(/when a shop places an order/)).toBeInTheDocument()
  })

  it('is not shown to a distributor', async () => {
    const { device } = fakeDevice('off', { status: 'on' })
    renderCard(device, { ...shop, role: 'distributor', shopId: null })
    await waitFor(() => expect(screen.queryByText('Alerts')).not.toBeInTheDocument())
  })

  it('shows in Tamil', async () => {
    const { device } = fakeDevice('off', { status: 'on' })
    renderCard(device, { ...shop, language: 'ta' })
    expect(await screen.findByRole('heading', { name: 'அறிவிப்புகள்' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'அறிவிப்புகளை ஆன் செய்' })).toBeInTheDocument()
  })
})
