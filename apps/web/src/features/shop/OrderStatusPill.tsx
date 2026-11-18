import { useTranslation } from 'react-i18next'
import type { OrderStatus } from '../../data/shopApi'

// A coloured dot and tint, and always the status in words, so it never relies on colour alone.
const STYLE: Record<OrderStatus, { pill: string; dot: string }> = {
  placed: { pill: 'bg-amber-soft text-amber', dot: 'bg-amber' },
  billed: { pill: 'bg-blue-soft text-blue', dot: 'bg-blue' },
  delivered: { pill: 'bg-brand-soft text-brand-dark', dot: 'bg-brand' },
  cancelled: { pill: 'bg-red-soft text-red line-through', dot: 'bg-red' },
}

// The admin calls a fresh order "New"; the shop sees "Placed".
const ADMIN_LABEL = {
  placed: 'filterPlaced',
  billed: 'filterBilled',
  delivered: 'filterDelivered',
} as const

export function OrderStatusPill({
  status,
  admin = false,
}: {
  status: OrderStatus
  admin?: boolean
}) {
  const { t } = useTranslation()
  const style = STYLE[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${style.pill}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {admin && status !== 'cancelled'
        ? t(`admin.orders.${ADMIN_LABEL[status]}`)
        : t(`shop.status.${status}`)}
    </span>
  )
}
