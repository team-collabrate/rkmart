import { initials } from '../lib/initials'

/** A round badge with a shop's initials, so rows are quick to tell apart. */
export function Avatar({ name, tone = 'green' }: { name: string; tone?: 'green' | 'amber' }) {
  return (
    <span
      aria-hidden="true"
      className={
        'grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold ' +
        (tone === 'amber' ? 'bg-amber-soft text-amber' : 'bg-brand-soft text-brand-dark')
      }
    >
      {initials(name)}
    </span>
  )
}
