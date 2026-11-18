import { WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOnlineStatus } from '../lib/useOnlineStatus'

export function OfflineBanner() {
  const { t } = useTranslation()
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b-2 border-line bg-pale px-4 py-2 text-sm font-medium"
    >
      <WifiOff size={18} aria-hidden="true" />
      {t('shell.offline')}
    </div>
  )
}
