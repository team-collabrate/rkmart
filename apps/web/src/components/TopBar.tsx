import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../features/auth/AuthProvider'
import { BrandLogo } from './BrandLogo'
import { LanguageSwitch } from './LanguageSwitch'

/** The first line of an admin screen: the brand logo, the language switch and sign out. Fixed height. */
export function TopBar() {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  return (
    <div className="mb-4 flex h-11 items-center justify-between gap-3">
      <BrandLogo size={44} />
      <div className="flex items-center gap-2">
        <LanguageSwitch />
        <button
          type="button"
          onClick={() => void signOut()}
          className="grid size-10 place-items-center rounded-full bg-page"
          aria-label={t('shell.signOut')}
        >
          <LogOut size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
