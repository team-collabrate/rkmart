import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'

interface Status {
  platform: string
  native: boolean
  standalone: boolean
  online: boolean
  serviceWorker: string
  manifest: string
  secureContext: boolean
}

async function readStatus(): Promise<Status> {
  let serviceWorker = 'not supported'
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    serviceWorker = registrations.length
      ? `registered (${registrations[0].active ? 'active' : 'installing'})`
      : 'none registered'
  }
  const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  return {
    platform: Capacitor.getPlatform(),
    native: Capacitor.isNativePlatform(),
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    online: navigator.onLine,
    serviceWorker,
    manifest: manifestLink?.href ?? 'missing',
    secureContext: window.isSecureContext,
  }
}

/** Stage 0 spike: shows whether the PWA and the Capacitor wrapper are wired up. */
export default function StatusSpike() {
  const [status, setStatus] = useState<Status | null>(null)

  useEffect(() => {
    void readStatus().then(setStatus)
    const timer = setTimeout(() => void readStatus().then(setStatus), 2500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <section style={{ padding: 16 }}>
      <h2>PWA and Android status</h2>
      {!status ? (
        <p>Checking…</p>
      ) : (
        <dl
          id="status-list"
          style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 16px' }}
        >
          <dt>Platform</dt>
          <dd>{status.platform}</dd>
          <dt>Running inside the APK</dt>
          <dd>{String(status.native)}</dd>
          <dt>Installed (standalone window)</dt>
          <dd>{String(status.standalone)}</dd>
          <dt>Secure context (needed for PWA)</dt>
          <dd>{String(status.secureContext)}</dd>
          <dt>Service worker</dt>
          <dd>{status.serviceWorker}</dd>
          <dt>Manifest</dt>
          <dd style={{ overflowWrap: 'anywhere' }}>{status.manifest}</dd>
          <dt>Online</dt>
          <dd>{String(status.online)}</dd>
        </dl>
      )}
    </section>
  )
}
