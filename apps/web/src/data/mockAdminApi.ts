import { ApiError, type AdminApi } from './adminApi'
import {
  SAMPLE_PREVIOUS_RATES,
  sampleProducts,
  SAMPLE_SETTINGS,
  sampleShops,
  SAMPLE_USERS,
} from './sampleData'
import type { AppUser, CompanySettings, Product, RateMap, Shop } from './types'

// In-memory demo version of the admin API, used when no Supabase project is configured
// (development, tests, and demo builds only). Not part of a real release.

interface State {
  products: Product[]
  shops: Shop[]
  users: AppUser[]
  /** date -> rates */
  rates: Record<string, RateMap>
  settings: CompanySettings
  nextId: number
}

export function createMockAdminApi(options: { delayMs?: number; today?: string } = {}): AdminApi {
  const { delayMs = 0 } = options
  const wait = () => (delayMs ? new Promise((r) => setTimeout(r, delayMs)) : Promise.resolve())

  const state: State = {
    products: sampleProducts(),
    shops: sampleShops(),
    users: structuredClone(SAMPLE_USERS),
    rates: { '1970-01-01': structuredClone(SAMPLE_PREVIOUS_RATES) },
    settings: structuredClone(SAMPLE_SETTINGS),
    nextId: 100,
  }
  const newId = (prefix: string) => `${prefix}${state.nextId++}`

  return {
    async listProducts() {
      await wait()
      return structuredClone(state.products).sort((a, b) => a.sortOrder - b.sortOrder)
    },

    async saveProduct(input, id) {
      await wait()
      if (id) {
        const found = state.products.find((x) => x.id === id)
        if (!found) throw new ApiError('not_found')
        Object.assign(found, input)
        return structuredClone(found)
      }
      const created: Product = { ...input, id: newId('p'), isActive: true }
      state.products.push(created)
      return structuredClone(created)
    },

    async setProductActive(id, active) {
      await wait()
      const found = state.products.find((x) => x.id === id)
      if (!found) throw new ApiError('not_found')
      found.isActive = active
    },

    async getRates(date) {
      await wait()
      return { ...(state.rates[date] ?? {}) }
    },

    async getPreviousRates(beforeDate) {
      await wait()
      const result: RateMap = {}
      const days = Object.keys(state.rates)
        .filter((d) => d < beforeDate)
        .sort()
      for (const day of days) Object.assign(result, state.rates[day]) // later days overwrite earlier
      return result
    },

    async saveRates(date, rates) {
      await wait()
      for (const rate of Object.values(rates)) {
        if (!Number.isFinite(rate) || rate < 0) throw new ApiError('invalid')
      }
      state.rates[date] = { ...(state.rates[date] ?? {}), ...rates }
    },

    async listShops() {
      await wait()
      return structuredClone(state.shops)
    },

    async saveShop(input, id) {
      await wait()
      if (id) {
        const found = state.shops.find((x) => x.id === id)
        if (!found) throw new ApiError('not_found')
        Object.assign(found, input)
        return structuredClone(found)
      }
      const created: Shop = { ...input, id: newId('s'), isActive: true }
      state.shops.push(created)
      return structuredClone(created)
    },

    async setShopActive(id, active) {
      await wait()
      const found = state.shops.find((x) => x.id === id)
      if (!found) throw new ApiError('not_found')
      found.isActive = active
    },

    async listUsers() {
      await wait()
      return structuredClone(state.users)
    },

    async createUser(input) {
      await wait()
      if (state.users.some((u) => u.phone === input.phone)) throw new ApiError('duplicate_phone')
      const shop = input.shopId ? state.shops.find((x) => x.id === input.shopId) : null
      if (input.role === 'shop' && !shop) throw new ApiError('invalid')
      const user: AppUser = {
        id: newId('u'),
        role: input.role,
        fullName: input.fullName,
        phone: input.phone,
        language: input.language,
        isActive: true,
        shopId: shop?.id ?? null,
        shopName: shop?.nameEn ?? null,
      }
      state.users.push(user)
      return { userId: user.id }
    },

    async resetPassword(userId) {
      await wait()
      if (!state.users.some((u) => u.id === userId)) throw new ApiError('not_found')
    },

    async setUserActive(userId, active) {
      await wait()
      const found = state.users.find((u) => u.id === userId)
      if (!found) throw new ApiError('not_found')
      found.isActive = active
    },

    async getSettings() {
      await wait()
      return { ...state.settings }
    },

    async saveSettings(input) {
      await wait()
      state.settings = { ...input }
      return { ...state.settings }
    },
  }
}
