import { Eye, EyeOff, Lock, Smartphone } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'
import { startPath } from '../../app/roles'
import { BrandLogo } from '../../components/BrandLogo'
import { LanguageSwitch } from '../../components/LanguageSwitch'
import { isValidPhone, normalizePhone } from '../../lib/phone'
import { isPin } from '../../lib/pin'
import { useAuth } from './AuthProvider'
import { isDemoMode } from './createAuthService'
import { DEMO_PIN } from './mockAuth'
import type { SignInError } from './types'

type FormError = SignInError | 'phone' | 'password' | null

// Built to stay still, like the other screens: fixed heights, one line per element, no animation.
const BOX =
  'flex h-14 items-center gap-3 rounded-2xl border-[1.5px] bg-page px-4 focus-within:border-brand '

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
    if (!isPin(password)) return setError('password')

    setError(null)
    setBusy(true)
    const result = await signIn(normalized, password)
    setBusy(false)
    if (!result.ok) setError(result.error)
  }

  const phoneInvalid = error === 'phone'
  const passwordInvalid = error === 'password'

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-page">
      <div className="h-56 rounded-b-[2rem] bg-brand px-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-paper">
        <div className="flex h-12 items-center justify-between gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-paper">
            <BrandLogo size={44} />
          </span>
          <LanguageSwitch />
        </div>
        <p className="mt-5 h-9 truncate font-display text-[1.75rem] font-bold leading-9">
          {t('app.name')}
        </p>
        <p className="h-6 truncate text-white/85">{t('app.tagline')}</p>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="relative -mt-14 mb-6 flex flex-col gap-4 px-4"
      >
        <div className="flex flex-col gap-4 rounded-[1.75rem] border border-line bg-paper p-5 shadow-[0_8px_30px_rgba(15,26,20,0.08)]">
          <div>
            <h1 className="h-9 truncate text-[1.75rem] leading-9">{t('login.title')}</h1>
            <p className="h-6 truncate text-mute">{t('login.subtitle')}</p>
          </div>

          <div>
            <label
              htmlFor="phone"
              className="mb-1.5 block h-5 truncate text-sm font-semibold text-mute"
            >
              {t('login.phone')}
            </label>
            <div className={BOX + (phoneInvalid ? 'border-dashed border-ink' : 'border-line')}>
              <Smartphone size={20} aria-hidden="true" className="shrink-0 text-mute" />
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
                className="min-w-0 flex-1 bg-transparent text-lg outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block h-5 truncate text-sm font-semibold text-mute"
            >
              {t('login.password')}
            </label>
            <div className={BOX + (passwordInvalid ? 'border-dashed border-ink' : 'border-line')}>
              <Lock size={20} aria-hidden="true" className="shrink-0 text-mute" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={4}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))
                  if (error) setError(null)
                }}
                aria-invalid={passwordInvalid}
                aria-describedby={passwordInvalid ? 'form-error' : undefined}
                className="min-w-0 flex-1 bg-transparent text-lg tracking-[0.4em] outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="grid size-10 shrink-0 place-items-center rounded-full text-mute"
                aria-pressed={showPassword}
                aria-label={showPassword ? t('login.hide') : t('login.show')}
              >
                {showPassword ? (
                  <EyeOff size={20} aria-hidden="true" />
                ) : (
                  <Eye size={20} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div id="form-error" role="alert" aria-live="polite" className="h-6">
            {error && (
              <p className="truncate font-semibold text-red">{t(`login.errors.${error}`)}</p>
            )}
          </div>

          <button
            type="submit"
            className="btn h-14 w-full rounded-full text-base"
            disabled={busy || status === 'loading'}
          >
            {busy ? t('login.submitting') : t('login.submit')}
          </button>
        </div>

        {/* Written inline so a real release drops the demo hint completely. */}
        {(import.meta.env.DEV || import.meta.env.VITE_MOCK_AUTH === '1') && isDemoMode() && (
          <aside className="rounded-[1.75rem] border border-line bg-paper p-4 text-sm">
            <p className="font-bold">{t('login.demoTitle')}</p>
            <p className="mt-1">{t('login.demoBody', { password: DEMO_PIN })}</p>
            <p className="mt-1 text-mute">{t('login.demoAccounts')}</p>
          </aside>
        )}
      </form>
    </div>
  )
}
