import { useQuery } from '@tanstack/react-query'
import { useShopApi } from '../../data/apiContext'

export const shopKeys = {
  catalog: (date: string) => ['catalog', date] as const,
  orders: ['my-orders'] as const,
  order: (id: string) => ['my-order', id] as const,
}

/** Items the shop can order today (active, with a rate set for the day). */
export function useCatalog(date: string) {
  const api = useShopApi()
  return useQuery({ queryKey: shopKeys.catalog(date), queryFn: () => api.getCatalog(date) })
}

export function useMyOrders() {
  const api = useShopApi()
  return useQuery({ queryKey: shopKeys.orders, queryFn: () => api.listMyOrders() })
}

export function useOrder(id: string | undefined) {
  const api = useShopApi()
  return useQuery({
    queryKey: shopKeys.order(id ?? ''),
    queryFn: () => api.getOrder(id!),
    enabled: Boolean(id),
  })
}
