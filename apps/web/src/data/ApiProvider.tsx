import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useAuth } from '../features/auth/AuthProvider'
import type { AdminApi } from './adminApi'
import {
  ApiContext,
  DeliveryApiContext,
  ShopApiContext,
  createApis,
  makeQueryClient,
  setSignedInShopId,
} from './apiContext'
import type { DeliveryApi } from './deliveryApi'
import type { ShopApi } from './shopApi'

/**
 * Gives the screens their data sources and a query cache.
 * `api`, `shopApi` and `client` can be replaced in tests.
 */
export function ApiProvider({
  children,
  api,
  shopApi,
  deliveryApi,
  client,
}: {
  children: ReactNode
  api?: AdminApi
  shopApi?: ShopApi
  deliveryApi?: DeliveryApi
  client?: QueryClient
}) {
  const { profile } = useAuth()

  // The demo backend asks "which shop is signed in?" on every call, so keep the answer fresh.
  useEffect(() => {
    setSignedInShopId(profile?.shopId ?? null)
  }, [profile])

  const defaults = useMemo(
    () => (api && shopApi && deliveryApi ? null : createApis()),
    [api, shopApi, deliveryApi],
  )
  const queryClient = useMemo(() => client ?? makeQueryClient(), [client])

  return (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={api ?? defaults!.admin}>
        <ShopApiContext.Provider value={shopApi ?? defaults!.shop}>
          <DeliveryApiContext.Provider value={deliveryApi ?? defaults!.delivery}>
            {children}
          </DeliveryApiContext.Provider>
        </ShopApiContext.Provider>
      </ApiContext.Provider>
    </QueryClientProvider>
  )
}
