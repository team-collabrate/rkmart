import { useTranslation } from 'react-i18next'
import { useAuth } from '../features/auth/AuthProvider'
import type { Language } from '../features/auth/types'

const OPTIONS: Language[] = ['en', 'ta']

/** A small two-way switch: the chosen language is a filled green pill. */
export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const { changeLanguage } = useAuth()
  const current: Language = i18n.language === 'ta' ? 'ta' : 'en'

  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className="flex gap-0.5 rounded-full bg-page p-1"
    >
      {OPTIONS.map((lang) => {
        const active = current === lang
        return (
          <button
            key={lang}
            type="button"
            onClick={() => changeLanguage(lang)}
            aria-pressed={active}
            aria-label={lang === 'en' ? t('common.english') : t('common.tamil')}
            className={
              'min-h-8 rounded-full px-3 text-sm font-semibold ' +
              (active ? 'bg-brand text-paper' : 'text-ink')
            }
          >
            {lang === 'en' ? (compact ? 'EN' : t('common.english')) : t('common.tamil')}
          </button>
        )
      })}
    </div>
  )
}
