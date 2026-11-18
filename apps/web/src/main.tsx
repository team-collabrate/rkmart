import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { registerSW } from 'virtual:pwa-register'
import './i18n'
import './index.css'
import './components.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ApiProvider } from './data/ApiProvider'
import { AuthProvider } from './features/auth/AuthProvider'
import { initNative } from './native'

// Load the Tamil fonts now, in every language, so switching to Tamil never makes text jump.
if (typeof document !== 'undefined' && 'fonts' in document) {
  for (const weight of [400, 500, 600, 700]) {
    void document.fonts.load(`${weight} 1em "Noto Sans Tamil Fit"`, 'அ').catch(() => {})
  }
}

// Registers the service worker so the PWA can be installed and loads fast.
registerSW({ immediate: true })
void initNative().catch((error) => console.warn('Native setup failed', error))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ApiProvider>
            <App />
          </ApiProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
