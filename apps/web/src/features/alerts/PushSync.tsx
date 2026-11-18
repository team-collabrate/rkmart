import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { usePushApi } from '../../data/apiContext'
import { getPushDevice, listenForAlerts } from '../../lib/push'
import { useAuth } from '../auth/AuthProvider'

/**
 * Renders nothing. While someone is signed in it:
 *  - moves this phone's alerts to them (a phone shared by two people follows whoever signs in),
 *  - refreshes the screens when an alert arrives while the app is open,
 *  - opens the right screen when an alert is tapped (Android app).
 */
export function PushSync() {
  const { profile } = useAuth()
  const api = usePushApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profileId = profile?.id ?? null

  useEffect(() => {
    if (!profileId) return
    const device = getPushDevice()
    const token = device.currentToken()
    if (token && device.platform) {
      void device
        .status()
        .then((status) =>
          status === 'on' ? api.registerToken(device.platform!, token) : undefined,
        )
        .catch(() => {
          // Offline or not allowed: it is tried again at the next sign-in.
        })
    }
  }, [profileId, api])

  useEffect(() => {
    if (!profileId) return
    let stop: (() => void) | undefined
    let cancelled = false
    void listenForAlerts({
      onTap: (url) => void navigate(url),
      onReceive: () => void queryClient.invalidateQueries(),
    }).then((remove) => {
      if (cancelled) remove()
      else stop = remove
    })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [profileId, navigate, queryClient])

  return null
}
