import { Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'
import { startPath } from '../../app/roles'
import { LanguageSwitch } from '../../components/LanguageSwitch'
import { isValidPhone, normalizePhone } from '../../lib/phone'
import { useAuth } from './AuthProvider'
import { DEMO_PASSWORD } from './mockAuth'
import { isDemoMode } from './createAuthService'
import type { SignInError } from './types'

type FormError = SignInError | 'phone' | 'password' | null

export function LoginPage() {
  const { t } = useTranslation()
  const { status, profile, signIn } = useAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<FormError>(null)
  const [busy, setBusy] = useState(false)

  if (profile) return <Navigate to={startPath(profile.role)} replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const normalized = normalizePhone(phone)
    if (!isValidPhone(normalized)) return setError('phone')
    if (!password) return setError('password')

    setError(null)
    setBusy(true)
    const result = await signIn(normalized, password)
    setBusy(false)
    if (!result.ok) setError(result.error)
  }

  const phoneInvalid = error === 'phone'
  const passwordInvalid = error === 'password'

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex justify-end">
        <LanguageSwitch />
      </div>

      <div className="mt-8 flex items-center gap-3">
        <img src="/logo.svg" alt="" width={56} height={56} className="rounded-2xl" />
        <div>
          <p className="font-display text-2xl font-bold leading-tight">{t('app.name')}</p>
          <p className="text-sm text-mute">{t('app.tagline')}</p>
        </div>
      </div>

      <h1 className="mt-8 text-3xl">{t('login.title')}</h1>
      <p className="mt-1 text-mute">{t('login.subtitle')}</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="phone" className="mb-1 block font-semibold">
            {t('login.phone')}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="username tel"
            placeholder={t('login.phoneHint')}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              if (error) setError(null)
            }}
            aria-invalid={phoneInvalid}
            aria-describedby={phoneInvalid ? 'form-error' : undefined}
            className="field"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block font-semibold">
            {t('login.password')}
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null)
              }}
              aria-invalid={passwordInvalid}
              aria-describedby={passwordInvalid ? 'form-error' : undefined}
              className="field pr-24"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1.5 top-1/2 flex min-h-9 -translate-y-1/2 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold"
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
              {showPassword ? t('login.hide') : t('login.show')}
            </button>
          </div>
        </div>

        <div id="form-error" role="alert" aria-live="polite" className="min-h-6">
          {error && (
            <p className="rounded-xl border-2 border-dashed border-ink px-3 py-2 font-medium">
              {t(`login.errors.${error}`)}
            </p>
          )}
        </div>

        <button type="submit" className="btn" disabled={busy || status === 'loading'}>
          {busy ? t('login.submitting') : t('login.submit')}
        </button>
      </form>

      {/* Written inline so a real release drops the demo hint completely. */}
      {(import.meta.env.DEV || import.meta.env.VITE_MOCK_AUTH === '1') && isDemoMode() && (
        <aside className="mt-8 rounded-xl border-2 border-dashed border-ink p-3 text-sm">
          <p className="font-bold">{t('login.demoTitle')}</p>
          <p className="mt-1">{t('login.demoBody', { password: DEMO_PASSWORD })}</p>
          <p className="mt-1 text-mute">{t('login.demoAccounts')}</p>
        </aside>
      )}
    </div>
  )
}
