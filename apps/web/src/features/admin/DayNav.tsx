import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { addDays, formatDay, todayISO } from '../../lib/dates'
import type { Language } from '../auth/types'

// Fixed size, single line, no animation: the same height in English and in Tamil.
const ARROW =
  'grid size-11 shrink-0 place-items-center rounded-full bg-paper shadow-[0_1px_2px_rgba(15,26,20,0.08)] disabled:opacity-40'

/** A grey pill with round arrow buttons around the day's date. Cannot go past today. */
export function DayNav({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const today = todayISO()
  return (
    <div className="flex h-14 items-center justify-between gap-2 rounded-full bg-page p-1.5">
      <button
        type="button"
        className={ARROW}
        onClick={() => onChange(addDays(date, -1))}
        aria-label={t('admin.orders.previousDay')}
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <div className="min-w-0 text-center">
        <p className="h-6 truncate font-display text-lg font-bold leading-6">
          {formatDay(date, language)}
        </p>
        <p className="h-4 truncate text-xs leading-4 text-mute">
          {date === today ? t('admin.orders.today') : ''}
        </p>
      </div>
      <button
        type="button"
        className={ARROW}
        onClick={() => onChange(addDays(date, 1))}
        disabled={date >= today}
        aria-label={t('admin.orders.nextDay')}
      >
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  )
}
