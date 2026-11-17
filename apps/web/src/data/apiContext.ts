import { QueryClient } from '@tanstack/react-query'
import { createContext, useContext } from 'react'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { ApiError, type AdminApi } from './adminApi'
import { createMockAdminApi } from './mockAdminApi'
import { createSupabaseAdminApi } from './supabaseAdminApi'

export const ApiContext = createContext<AdminApi | null>(null)

export function useAdminApi(): AdminApi {
  const value = useContext(ApiContext)
  if (!value) throw new Error('useAdminApi must be used inside <ApiProvider>')
  return value
}

/** A release with no server configured can read and write nothing. */
function notConfiguredApi(): AdminApi {
  const fail = async (): Promise<never> => {
    throw new ApiError('not_configured')
  }
  return new Proxy({} as AdminApi, { get: () => fail })
}

export function createAdminApi(): AdminApi {
  if (isSupabaseConfigured()) return createSupabaseAdminApi(getSupabase())
  // Written inline (not via a shared constant) so a real release drops the demo data completely.
  if (import.meta.env.DEV || import.meta.env.VITE_MOCK_AUTH === '1') {
    return createMockAdminApi({ delayMs: 150 })
  }
  return notConfiguredApi()
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 } },
  })
}
