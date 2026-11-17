import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'
import type { AdminApi } from './adminApi'
import { ApiContext, createAdminApi, makeQueryClient } from './apiContext'

/** Gives the screens their data source and a query cache. `api` and `client` can be replaced in tests. */
export function ApiProvider({
  children,
  api,
  client,
}: {
  children: ReactNode
  api?: AdminApi
  client?: QueryClient
}) {
  const value = useMemo(() => api ?? createAdminApi(), [api])
  const queryClient = useMemo(() => client ?? makeQueryClient(), [client])
  return (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={value}>{children}</ApiContext.Provider>
    </QueryClientProvider>
  )
}
