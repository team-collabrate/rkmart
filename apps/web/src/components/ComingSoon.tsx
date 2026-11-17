import { useTranslation } from 'react-i18next'

/** Placeholder for a screen that a later stage builds. Shows where it fits in the plan. */
export function ComingSoon({ title, stage }: { title: string; stage: number }) {
  const { t } = useTranslation()
  return (
    <section>
      <h1 className="text-2xl">{title}</h1>
      <p className="mt-3 inline-block rounded-xl border-2 border-dashed border-ink px-4 py-3 text-mute">
        {t('pages.comingSoon', { stage })}
      </p>
    </section>
  )
}
