import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { setLanguage, type Language } from './i18n'

// Stage 0 spike pages exist only in dev builds, or when built with VITE_SPIKES=1.
// In a normal production build this whole branch is removed.
const spikesEnabled = import.meta.env.DEV || import.meta.env.VITE_SPIKES === '1'
const PdfSpike: ComponentType | null = spikesEnabled
  ? lazy(() => import('./spikes/PdfSpike'))
  : null
const StatusSpike: ComponentType | null = spikesEnabled
  ? lazy(() => import('./spikes/StatusSpike'))
  : null

function useHashRoute(): string {
  const [route, setRoute] = useState(() => location.hash.split('?')[0] || '#/')
  useEffect(() => {
    const onChange = () => setRoute(location.hash.split('?')[0] || '#/')
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export default function App() {
  const { t, i18n } = useTranslation()
  const route = useHashRoute()
  const current = (i18n.language === 'ta' ? 'ta' : 'en') as Language

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '2px solid #000',
        }}
      >
        <a href="#/" style={{ color: 'inherit', textDecoration: 'none' }}>
          <strong style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>
            {t('app.name')}
          </strong>
          <div style={{ fontSize: 12, color: '#4a4a4a' }}>{t('app.tagline')}</div>
        </a>
        <div role="group" aria-label={t('common.language')} style={{ display: 'flex', gap: 6 }}>
          {(['en', 'ta'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              aria-pressed={current === lang}
              style={{
                padding: '4px 12px',
                border: '2px solid #000',
                borderRadius: 999,
                fontWeight: 600,
                background: current === lang ? '#000' : '#fff',
                color: current === lang ? '#fff' : '#000',
              }}
            >
              {lang === 'en' ? t('common.english') : t('common.tamil')}
            </button>
          ))}
        </div>
      </header>

      <main>
        <Suspense fallback={<p style={{ padding: 16 }}>Loading…</p>}>
          {route === '#/spikes/pdf' && PdfSpike ? (
            <PdfSpike />
          ) : route === '#/spikes/status' && StatusSpike ? (
            <StatusSpike />
          ) : (
            <section style={{ padding: 16 }}>
              <h1>{t('stage0.title')}</h1>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
                <span className="role-chip role-shop">{t('roles.shop')}</span>
                <span className="role-chip role-admin">{t('roles.admin')}</span>
                <span className="role-chip role-dist">{t('roles.distributor')}</span>
              </div>
              {spikesEnabled && (
                <ul style={{ lineHeight: 2 }}>
                  <li>
                    <a href="#/spikes/pdf">{t('stage0.pdf')}</a>
                  </li>
                  <li>
                    <a href="#/spikes/status">
                      {t('stage0.pwa')} / {t('stage0.native')}
                    </a>
                  </li>
                </ul>
              )}
            </section>
          )}
        </Suspense>
      </main>
    </div>
  )
}
