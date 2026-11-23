import { useTranslation } from 'react-i18next'
import { useAuth } from '../features/auth/AuthProvider'
import type { Language } from '../features/auth/types'

const OPTIONS: Language[] = ['en', 'ta']

/**
 * A two-way pill switch. Each side is one letter ("A" and "அ"), so it is exactly the same size in
 * both languages and nothing around it moves. The chosen side is a filled green circle. The full
 * language name is the button's accessible label.
 */
export function LanguageSwitch() {
  const { t, i18n } = useTranslation()
  const { changeLanguage } = useAuth()
  const current: Language = i18n.language === 'ta' ? 'ta' : 'en'

  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className="flex h-10 w-[5.5rem] shrink-0 gap-1 rounded-full border border-line bg-paper p-1"
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
              'grid h-full flex-1 place-items-center rounded-full text-base font-bold leading-none ' +
              (active ? 'bg-brand text-paper' : 'text-mute')
            }
          >
            <span aria-hidden="true">{lang === 'en' ? 'A' : 'அ'}</span>
          </button>
        )
      })}
    </div>
  )
}
