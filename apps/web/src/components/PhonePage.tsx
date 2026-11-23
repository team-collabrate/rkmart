import { ChevronLeft, LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BrandLogo } from './BrandLogo'
import { LanguageSwitch } from './LanguageSwitch'
import { useAuth } from '../features/auth/AuthProvider'

/**
 * The frame of a shop or delivery screen: a white rounded header (logo, language, sign out, then a title row
 * with an optional round back button and one item on the right) over a grey page. One fixed line
 * for the title, so switching language never moves anything.
 */
export function PhonePage({
  title,
  backTo,
  action,
  children,
  bottomSpace = false,
}: {
  title: ReactNode
  backTo?: string
  action?: ReactNode
  children: ReactNode
  /** Leave room for a floating action bar above the navigation. */
  bottomSpace?: boolean
}) {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  return (
    <section
      className={
        '-mx-4 -mb-28 -mt-2 min-h-[calc(100dvh-4rem)] bg-page ' + (bottomSpace ? 'pb-52' : 'pb-40')
      }
    >
      <div className="rounded-b-[2rem] bg-paper px-5 pb-5 pt-5">
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
        <div className="flex h-11 items-center gap-3">
          {backTo && (
            <Link
              to={backTo}
              aria-label={t('admin.common.back')}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-page no-underline"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </Link>
          )}
          <h1 className="block h-11 min-w-0 flex-1 truncate text-[1.625rem] leading-[2.75rem]">
            {title}
          </h1>
          {action}
        </div>
      </div>
      <div className="flex flex-col gap-4 px-4 pt-4">{children}</div>
    </section>
  )
}

/** Grey placeholder rows shown while a list loads. */
export function SkeletonRows({
  count = 4,
  height = 'h-[4.25rem]',
}: {
  count?: number
  height?: string
}) {
  return (
    <ul
      className="overflow-hidden rounded-[1.75rem] border border-line bg-paper"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={`${height} border-b border-line last:border-b-0`} />
      ))}
    </ul>
  )
}
