import { useTranslation } from 'react-i18next'
import type { UserRole } from '../features/auth/types'

const STYLE: Record<UserRole, string> = {
  shop: 'role-shop',
  admin: 'role-admin',
  distributor: 'role-dist',
}

/** Role badge: shape + border style + label, so it reads in black and white and for colour-blind users. */
export function RoleChip({ role }: { role: UserRole }) {
  const { t } = useTranslation()
  return <span className={`role-chip ${STYLE[role]}`}>{t(`roles.${role}`)}</span>
}
