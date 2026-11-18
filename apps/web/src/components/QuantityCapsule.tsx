import { Minus, Plus } from 'lucide-react'

// Adapted from the 21st.dev "Quantity" stepper: one rounded capsule holding a minus button, the
// number and a plus button, with a press-down effect. The number is a real input so a quantity like
// 2.5 kg can be typed.

export function QuantityCapsule({
  inputId,
  value,
  unit,
  invalid,
  canDecrease,
  onType,
  onStep,
  decreaseLabel,
  increaseLabel,
  describedBy,
}: {
  inputId: string
  value: string
  unit: string
  invalid: boolean
  canDecrease: boolean
  onType: (value: string) => void
  onStep: (direction: 1 | -1) => void
  decreaseLabel: string
  increaseLabel: string
  describedBy?: string
}) {
  const step =
    'grid size-11 shrink-0 place-items-center text-brand-dark transition-transform active:scale-90 disabled:opacity-35'
  return (
    <div
      className={
        'inline-flex items-center rounded-2xl border bg-paper ' +
        (invalid ? 'border-dashed border-ink' : 'border-line')
      }
    >
      <button
        type="button"
        className={step}
        aria-label={decreaseLabel}
        disabled={!canDecrease}
        onClick={() => onStep(-1)}
      >
        <Minus size={18} aria-hidden="true" />
      </button>
      <input
        id={inputId}
        inputMode="decimal"
        value={value}
        onChange={(e) => onType(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="w-14 bg-transparent text-center text-base font-semibold tabular-nums outline-none"
      />
      <span className="pr-1 text-sm text-mute">{unit}</span>
      <button type="button" className={step} aria-label={increaseLabel} onClick={() => onStep(1)}>
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
