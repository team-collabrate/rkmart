import { useQuery } from '@tanstack/react-query'
import { useShopApi } from '../../data/apiContext'

/** The signed-in shop's bills and payments. Shared by the payments screen and the home card. */
export function useMyStatement() {
  const api = useShopApi()
  return useQuery({ queryKey: ['my-statement'], queryFn: () => api.getMyStatement() })
}
