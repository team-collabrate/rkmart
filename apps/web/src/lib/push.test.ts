// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { getPushDevice, listenForAlerts, urlBase64ToUint8Array } from './push'

describe('public key conversion', () => {
  it('turns a base64url key into the bytes a browser wants', () => {
    // "subjects?_d" in standard base64 is "c3ViamVjdHM/X2Q=", written base64url without padding.
    expect([...urlBase64ToUint8Array('c3ViamVjdHM_X2Q')]).toEqual([
      ...new TextEncoder().encode('subjects?_d'),
    ])
    expect([...urlBase64ToUint8Array('-__-')]).toEqual([251, 255, 254])
  })
})

describe('the demo browser device', () => {
  beforeEach(() => localStorage.clear())

  it('is off until turned on, then on, then off again', async () => {
    const device = getPushDevice()
    expect(device.platform).toBe('web')
    expect(await device.status()).toBe('off')

    const result = await device.enable()
    expect(result).toMatchObject({ status: 'on', platform: 'web' })
    expect(result.token).toMatch(/^demo-device-/)
    expect(device.currentToken()).toBe(result.token)
    expect(await device.status()).toBe('on')

    expect(await device.disable()).toBe(result.token)
    expect(device.currentToken()).toBeNull()
    expect(await device.status()).toBe('off')
  })
})

describe('listening for alerts in a browser', () => {
  it('does nothing outside the Android app (the service worker handles taps there)', async () => {
    const stop = await listenForAlerts({ onTap: () => {}, onReceive: () => {} })
    expect(typeof stop).toBe('function')
    stop()
  })
})
