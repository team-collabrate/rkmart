import { ApiError } from './adminApi'
import type { PushApi, PushPlatform } from './pushApi'

/** Demo version: remembers the registered devices in memory so screens and tests can look at them. */
export function createMockPushApi(
  devices: { platform: PushPlatform; token: string }[] = [],
): PushApi & { devices: typeof devices } {
  return {
    devices,
    async registerToken(platform, token) {
      if (token.trim().length < 8) throw new ApiError('invalid')
      const existing = devices.find((d) => d.token === token)
      if (existing) existing.platform = platform
      else devices.push({ platform, token })
    },
    async forgetToken(token) {
      const index = devices.findIndex((d) => d.token === token)
      if (index >= 0) devices.splice(index, 1)
    },
  }
}
