import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { TFunction } from 'i18next'
import { ApiError } from '../../data/adminApi'
import { useAdminApi } from '../../data/apiContext'

export const keys = {
  products: ['products'] as const,
  shops: ['shops'] as const,
  users: ['users'] as const,
  settings: ['settings'] as const,
  rates: (date: string) => ['rates', date] as const,
  previousRates: (date: string) => ['rates-previous', date] as const,
  orders: (date: string) => ['admin-orders', date] as const,
  order: (id: string) => ['admin-order', id] as const,
}

export function useProducts() {
  const api = useAdminApi()
  return useQuery({ queryKey: keys.products, queryFn: () => api.listProducts() })
}

export function useShops() {
  const api = useAdminApi()
  return useQuery({ queryKey: keys.shops, queryFn: () => api.listShops() })
}

export function useUsers() {
  const api = useAdminApi()
  return useQuery({ queryKey: keys.users, queryFn: () => api.listUsers() })
}

export function useSettings() {
  const api = useAdminApi()
  return useQuery({ queryKey: keys.settings, queryFn: () => api.getSettings() })
}

export function useRates(date: string) {
  const api = useAdminApi()
  return useQuery({ queryKey: keys.rates(date), queryFn: () => api.getRates(date) })
}

export function usePreviousRates(date: string) {
  const api = useAdminApi()
  return useQuery({ queryKey: keys.previousRates(date), queryFn: () => api.getPreviousRates(date) })
}

/** The day's orders. Refreshes when the server says an order changed, and every 30 seconds as a back-up. */
export function useOrders(date: string) {
  const api = useAdminApi()
  const queryClient = useQueryClient()
  useEffect(
    () =>
      api.onOrdersChanged(() => {
        void queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
        void queryClient.invalidateQueries({ queryKey: ['admin-order'] })
      }),
    [api, queryClient],
  )
  return useQuery({
    queryKey: keys.orders(date),
    queryFn: () => api.listOrders(date),
    refetchInterval: 30_000,
  })
}

export function useOrderDetail(id: string | undefined) {
  const api = useAdminApi()
  return useQuery({
    queryKey: keys.order(id ?? ''),
    queryFn: () => api.getOrderDetail(id!),
    enabled: Boolean(id),
  })
}

/** A failed request in plain words, in the current language. */
export function errorText(t: TFunction, error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'unknown'
  return t(`admin.apiErrors.${code}`)
}
