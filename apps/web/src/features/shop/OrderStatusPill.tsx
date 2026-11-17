import { useTranslation } from 'react-i18next'
import type { OrderStatus } from '../../data/shopApi'

// Each status has its own outline and fill, so it still reads in black and white,
// and always carries a text label.
const STYLE: Record<OrderStatus, string> = {
  placed: 'border-dashed border-ink bg-paper text-ink',
  billed: 'border-double border-4 border-ink bg-paper text-ink',
  delivered: 'border-solid border-ink bg-ink text-paper',
  cancelled: 'border-solid border-ink bg-paper text-mute line-through',
}

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border-2 px-2 text-xs font-bold ${STYLE[status]}`}
    >
      {t(`shop.status.${status}`)}
    </span>
  )
}
