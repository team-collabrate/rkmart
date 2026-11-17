import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-2xl">{t('shell.notFoundTitle')}</h1>
      <Link to="/" className="btn mt-4 no-underline">
        {t('shell.goHome')}
      </Link>
    </div>
  )
}
