import { Ban, Check, ClipboardList, ReceiptText, Truck, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { OrderStatus } from '../data/shopApi'

// Adapted from the 21st.dev "Steps" component: numbered markers joined by a track that fills in as
// each step completes, with a soft halo on the step in progress. Here the markers are icons.

const STEPS: { status: Exclude<OrderStatus, 'cancelled'>; icon: LucideIcon }[] = [
  { status: 'placed', icon: ClipboardList },
  { status: 'billed', icon: ReceiptText },
  { status: 'delivered', icon: Truck },
]

/** Where an order is: placed, billed, delivered. A cancelled order shows one red marker. */
export function StatusSteps({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()

  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-red-soft p-3 text-red">
        <span className="grid size-10 place-items-center rounded-full bg-paper">
          <Ban size={20} aria-hidden="true" />
        </span>
        <span className="font-semibold">{t('shop.status.cancelled')}</span>
      </div>
    )
  }

  const current = STEPS.findIndex((s) => s.status === status)

  return (
    <ol aria-label={t('admin.orders.title')} className="flex items-start">
      {STEPS.map(({ status: key, icon: Icon }, index) => {
        const state = index < current ? 'complete' : index === current ? 'current' : 'upcoming'
        const last = index === STEPS.length - 1
        return (
          <li
            key={key}
            aria-current={state === 'current' ? 'step' : undefined}
            className={'relative flex flex-1 flex-col items-center gap-1.5 ' + (last ? '' : 'pr-0')}
          >
            {/* The track to the next marker: grey, with a green fill once this step is done. */}
            {!last && (
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-5 h-1 w-full -translate-y-1/2 rounded-full bg-line"
              >
                <span
                  className={
                    'block h-full rounded-full bg-brand transition-all duration-500 ' +
                    (state === 'complete' ? 'w-full' : 'w-0')
                  }
                />
              </span>
            )}
            <span
              aria-hidden="true"
              className={
                'relative z-[1] grid size-10 place-items-center rounded-full transition-colors ' +
                (state === 'complete'
                  ? 'bg-brand text-paper'
                  : state === 'current'
                    ? 'bg-brand-soft text-brand-dark ring-4 ring-brand/20'
                    : 'bg-page text-rail')
              }
            >
              {state === 'complete' ? <Check size={20} /> : <Icon size={20} />}
            </span>
            <span
              className={
                'text-xs font-semibold ' + (state === 'upcoming' ? 'text-mute' : 'text-ink')
              }
            >
              {t(`shop.status.${key}`)}
            </span>
            <span className="sr-only">
              {state === 'complete' ? '✓' : state === 'current' ? '●' : '○'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
