import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banner } from '../../components/ui'
import { usePushApi } from '../../data/apiContext'
import { getPushDevice, type PushDevice } from '../../lib/push'
import { useAuth } from '../auth/AuthProvider'

/**
 * Turn alerts on or off for this phone or browser. Shown to shop owners (deliveries, payments,
 * reminders) and to the admin (new orders). `device` can be replaced in tests.
 */
export function AlertsCard({ device: given }: { device?: PushDevice }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const api = usePushApi()
  const queryClient = useQueryClient()
  const device = useMemo(() => given ?? getPushDevice(), [given])
  const [message, setMessage] = useState<string | null>(null)

  const status = useQuery({ queryKey: ['push-status'], queryFn: () => device.status() })

  const turnOn = useMutation({
    mutationFn: async () => {
      const result = await device.enable()
      if (result.status === 'on' && result.token && result.platform) {
        await api.registerToken(result.platform, result.token)
      }
      return result.status
    },
    onSuccess: async (result) => {
      setMessage(result === 'on' ? null : t(`alerts.${result}`))
      await queryClient.invalidateQueries({ queryKey: ['push-status'] })
    },
    onError: async () => {
      // The device is on but the server did not take the token: undo, so the screen tells the truth.
      await device.disable()
      setMessage(t('alerts.failed'))
      await queryClient.invalidateQueries({ queryKey: ['push-status'] })
    },
  })

  const turnOff = useMutation({
    mutationFn: async () => {
      const token = await device.disable()
      if (token) await api.forgetToken(token)
    },
    onSuccess: async () => {
      setMessage(null)
      await queryClient.invalidateQueries({ queryKey: ['push-status'] })
    },
    onError: () => setMessage(t('alerts.failed')),
  })

  if (!profile || profile.role === 'distributor') return null
  const state = status.data
  const busy = turnOn.isPending || turnOff.isPending

  return (
    <section
      className="mt-6 max-w-2xl rounded-2xl border border-line p-4"
      aria-labelledby="alerts-title"
    >
      <h2 id="alerts-title" className="text-lg">
        {t('alerts.title')}
      </h2>
      <p className="mt-1 h-6 truncate text-mute">
        {t(`alerts.about.${profile.role === 'admin' ? 'admin' : 'shop'}`)}
      </p>

      {state === 'on' ? (
        <>
          <p className="mt-3 font-semibold">{t('alerts.on')}</p>
          <button
            type="button"
            className="btn btn-outline mt-3"
            disabled={busy}
            onClick={() => turnOff.mutate()}
          >
            <BellOff size={18} aria-hidden="true" />
            {t('alerts.turnOff')}
          </button>
        </>
      ) : state === 'off' ? (
        <button type="button" className="btn mt-3" disabled={busy} onClick={() => turnOn.mutate()}>
          <Bell size={18} aria-hidden="true" />
          {busy ? t('alerts.working') : t('alerts.turnOn')}
        </button>
      ) : state ? (
        <p className="mt-3 rounded-2xl border-2 border-dashed border-ink px-3 py-2 font-medium">
          {t(`alerts.${state}`)}
        </p>
      ) : null}

      {message && (
        <div className="mt-3">
          <Banner kind="error">{message}</Banner>
        </div>
      )}
    </section>
  )
}
