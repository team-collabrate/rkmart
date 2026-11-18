import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatQty, parseQty, stepQty } from './cart'

const STEP_BUTTON =
  'grid size-11 shrink-0 place-items-center rounded-2xl border-2 border-brand bg-brand font-bold text-paper'

/**
 * "Add" when nothing is chosen, otherwise a minus button, a number box and a plus button.
 * The box accepts decimals for items sold by weight, like 2.5 kg.
 */
export function QtyControl({
  name,
  qty,
  onChange,
}: {
  name: string
  qty: number
  onChange: (qty: number) => void
}) {
  const { t } = useTranslation()
  // While the person is typing, show exactly what they typed (for example "2.").
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)

  if (qty <= 0 && draft === null) {
    return (
      <button type="button" className="btn w-full min-w-24" onClick={() => onChange(1)}>
        <Plus size={18} aria-hidden="true" />
        {t('shop.order.add')}
      </button>
    )
  }

  return (
    <div className="flex w-full items-center gap-1">
      <button
        type="button"
        className={STEP_BUTTON}
        aria-label={t('shop.order.decrease', { name })}
        onClick={() => {
          setDraft(null)
          setInvalid(false)
          onChange(stepQty(qty, -1))
        }}
      >
        <Minus size={18} aria-hidden="true" />
      </button>
      <input
        inputMode="decimal"
        value={draft ?? formatQty(qty)}
        aria-label={t('shop.order.quantity', { name })}
        aria-invalid={invalid}
        className="field w-0 min-w-0 flex-1 px-1 text-center"
        onChange={(e) => {
          setDraft(e.target.value)
          const parsed = parseQty(e.target.value)
          setInvalid(!parsed.ok)
          if (parsed.ok && parsed.value !== null) onChange(parsed.value)
        }}
        onBlur={() => {
          // Emptying the box removes the item. A half-typed or invalid entry goes back to the last good number.
          const parsed = parseQty(draft ?? '')
          if (draft !== null && parsed.ok && parsed.value === null) onChange(0)
          setDraft(null)
          setInvalid(false)
        }}
      />
      <button
        type="button"
        className={STEP_BUTTON}
        aria-label={t('shop.order.increase', { name })}
        onClick={() => {
          setDraft(null)
          setInvalid(false)
          onChange(stepQty(qty, 1))
        }}
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
