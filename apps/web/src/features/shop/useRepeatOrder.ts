import { useNavigate } from 'react-router'
import type { OrderDetail } from '../../data/shopApi'
import { useCart } from './cartStore'

/** Puts an earlier order's items back in the cart and opens the review screen. */
export function useRepeatOrder() {
  const navigate = useNavigate()
  return (order: OrderDetail) => {
    const lines = Object.fromEntries(order.lines.map((l) => [l.productId, l.qty]))
    const labels = Object.fromEntries(
      order.lines.map((l) => [l.productId, { en: l.nameEn, ta: l.nameTa }]),
    )
    useCart.getState().replace(lines, labels)
    void navigate('/shop/order/review', { state: { repeated: true } })
  }
}
