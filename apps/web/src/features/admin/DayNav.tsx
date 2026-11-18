import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { addDays, formatDay, todayISO } from '../../lib/dates'
import type { Language } from '../auth/types'

/** Previous and next day arrows around the day's date. Cannot go past today. */
export function DayNav({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const today = todayISO()
  return (
    <div className="mb-3 flex items-center gap-2">
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => onChange(addDays(date, -1))}
        aria-label={t('admin.orders.previousDay')}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1 text-center">
        <p className="font-display text-lg font-bold">{formatDay(date, language)}</p>
        {date === today && <p className="text-sm text-mute">{t('admin.orders.today')}</p>}
      </div>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => onChange(addDays(date, 1))}
        disabled={date >= today}
        aria-label={t('admin.orders.nextDay')}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
