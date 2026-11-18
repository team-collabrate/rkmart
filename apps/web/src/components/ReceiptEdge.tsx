import { useId } from 'react'

/** A torn-paper zigzag along the bottom of a receipt. Drawn in the card colour, so it reads as paper. */
export function ReceiptEdge() {
  const id = useId()
  return (
    <svg aria-hidden="true" className="block h-2.5 w-full text-paper" focusable="false">
      <defs>
        <pattern id={id} width="14" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 0h14L7 10z" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="10" fill={`url(#${id})`} />
    </svg>
  )
}

/** Soft circles for the corner of a green card. Decoration only. */
export function CardGlow() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 200 200"
      className="pointer-events-none absolute -right-10 -top-10 size-48 text-white/10"
    >
      <circle cx="100" cy="100" r="96" fill="currentColor" />
      <circle cx="100" cy="100" r="62" fill="currentColor" />
      <circle cx="100" cy="100" r="30" fill="currentColor" />
    </svg>
  )
}
