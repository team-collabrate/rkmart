import { QueryClient } from '@tanstack/react-query'
import { createContext, useContext } from 'react'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { ApiError, type AdminApi } from './adminApi'
import type { DeliveryApi } from './deliveryApi'
import type { PushApi } from './pushApi'
import { createMockPushApi } from './mockPushApi'
import { createSupabasePushApi } from './supabasePushApi'
import { createMockDeliveryApi } from './mockDeliveryApi'
import { createSupabaseDeliveryApi } from './supabaseDeliveryApi'
import { createMockAdminApi } from './mockAdminApi'
import { createMockShopApi } from './mockShopApi'
import { createMockState } from './mockState'
import type { ShopApi } from './shopApi'
import { createSupabaseAdminApi } from './supabaseAdminApi'
import { createSupabaseShopApi } from './supabaseShopApi'

export const ApiContext = createContext<AdminApi | null>(null)
export const ShopApiContext = createContext<ShopApi | null>(null)
export const DeliveryApiContext = createContext<DeliveryApi | null>(null)
export const PushApiContext = createContext<PushApi | null>(null)

export function useAdminApi(): AdminApi {
  const value = useContext(ApiContext)
  if (!value) throw new Error('useAdminApi must be used inside <ApiProvider>')
  return value
}

export function useDeliveryApi(): DeliveryApi {
  const value = useContext(DeliveryApiContext)
  if (!value) throw new Error('useDeliveryApi must be used inside <ApiProvider>')
  return value
}

export function usePushApi(): PushApi {
  const value = useContext(PushApiContext)
  if (!value) throw new Error('usePushApi must be used inside <ApiProvider>')
  return value
}

export function useShopApi(): ShopApi {
  const value = useContext(ShopApiContext)
  if (!value) throw new Error('useShopApi must be used inside <ApiProvider>')
  return value
}

/** A release with no server configured can read and write nothing. */
function notConfigured<T extends object>(): T {
  const fail = async (): Promise<never> => {
    throw new ApiError('not_configured')
  }
  return new Proxy({} as T, { get: () => fail })
}

// Which shop is signed in. The demo backend reads this on every call; the real server uses the login token.
let signedInShopId: string | null = null
export function setSignedInShopId(id: string | null) {
  signedInShopId = id
}

export interface Apis {
  admin: AdminApi
  shop: ShopApi
  delivery: DeliveryApi
  push: PushApi
}

/** Picks the real server, the demo backend, or nothing, depending on how the app was built. */
export function createApis(getShopId: () => string | null = () => signedInShopId): Apis {
  if (isSupabaseConfigured()) {
    const client = getSupabase()
    return {
      admin: createSupabaseAdminApi(client),
      shop: createSupabaseShopApi(client),
      delivery: createSupabaseDeliveryApi(client),
      push: createSupabasePushApi(client),
    }
  }
  // Written inline (not via a shared constant) so a real release drops the demo data completely.
  if (import.meta.env.DEV || import.meta.env.VITE_MOCK_AUTH === '1') {
    const state = createMockState({ seedDemo: true })
    return {
      admin: createMockAdminApi({ delayMs: 150, state }),
      shop: createMockShopApi(state, getShopId, { delayMs: 150 }),
      delivery: createMockDeliveryApi(state, { delayMs: 150 }),
      push: createMockPushApi(),
    }
  }
  return {
    admin: notConfigured<AdminApi>(),
    shop: notConfigured<ShopApi>(),
    delivery: notConfigured<DeliveryApi>(),
    push: notConfigured<PushApi>(),
  }
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 } },
  })
}
