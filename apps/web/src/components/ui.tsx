import { ArrowLeft } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

/** Page title with an optional back link and one action button on the right. */
export function PageHeader({
  title,
  backTo,
  action,
}: {
  title: string
  backTo?: string
  action?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="mb-4">
      {backTo && (
        <Link
          to={backTo}
          className="mb-2 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold no-underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('admin.common.back')}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">{title}</h1>
        {action}
      </div>
    </div>
  )
}

/** Label, input and an error line. `error` is a translation key. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-sm text-mute">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-semibold">
          {t(error)}
        </p>
      )}
    </div>
  )
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'onChange' | 'value'> & {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
}

export function TextField({ id, label, value, onChange, hint, error, ...rest }: TextFieldProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="field"
        {...rest}
      />
    </Field>
  )
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  error,
  hint,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  error?: string
  hint?: string
  placeholder?: string
}) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="field"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

/** On/off switch drawn as a labelled checkbox (reads in black and white, works with a keyboard). */
export function CheckField({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-6 accent-black"
      />
      <label htmlFor={id} className="font-semibold">
        {label}
        {hint && <span className="block text-sm font-normal text-mute">{hint}</span>}
      </label>
    </div>
  )
}

/** A message box. Error: dashed border. Success: solid. Both carry a text label, never colour alone. */
export function Banner({
  kind,
  children,
}: {
  kind: 'error' | 'success' | 'info'
  children: ReactNode
}) {
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className={
        'rounded-xl border-2 px-3 py-2 font-medium ' +
        (kind === 'error' ? 'border-dashed border-ink' : 'border-solid border-line bg-pale')
      }
    >
      {children}
    </p>
  )
}

/** "On" is solid black, "Off" is a dashed outline. */
export function StatusPill({ active }: { active: boolean }) {
  const { t } = useTranslation()
  return (
    <span
      className={
        'inline-block rounded-full border-2 px-2 text-xs font-bold ' +
        (active ? 'border-line bg-brand text-paper' : 'border-dashed border-ink text-ink')
      }
    >
      {active ? t('admin.common.on') : t('admin.common.off')}
    </span>
  )
}

export function Loading() {
  const { t } = useTranslation()
  return (
    <p role="status" className="py-6 text-mute">
      {t('common.loading')}
    </p>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border-2 border-dashed border-ink px-4 py-6 text-mute">{children}</p>
  )
}
