import { useTranslation } from 'react-i18next'
import type { UserRole } from '../features/auth/types'

/** Who is signed in, as a quiet green label. The role name is always printed, never colour alone. */
export function RoleChip({ role }: { role: UserRole }) {
  const { t } = useTranslation()
  return (
    <span className="hidden rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark min-[400px]:inline">
      {t(`roles.${role}`)}
    </span>
  )
}
