import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Check } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banner } from '../../components/ui'
import { useDeliveryApi } from '../../data/apiContext'
import { errorText } from '../admin/queries'

/**
 * "Mark delivered" with a confirmation step and an optional photo of the signed paper copy.
 * Used by the delivery person's list, and by the admin when they deliver a bill themselves.
 */
export function MarkDeliveredPanel({ orderId, onDone }: { orderId: string; onDone?: () => void }) {
  const { t } = useTranslation()
  const api = useDeliveryApi()
  const queryClient = useQueryClient()
  const photoId = useId()
  const [open, setOpen] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mark = useMutation({
    mutationFn: () => api.markDelivered(orderId, photo ?? undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deliveries'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-order'] })
      onDone?.()
    },
    onError: (e) => setError(errorText(t, e)),
  })

  if (!open) {
    return (
      <button type="button" className="btn h-12 w-full rounded-full" onClick={() => setOpen(true)}>
        <Check size={20} aria-hidden="true" className="shrink-0" />
        <span className="truncate">{t('delivery.markDelivered')}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* The photo is optional. The full explanation is kept for screen readers. */}
      <p className="sr-only">{t('delivery.photoHint')}</p>
      <label
        htmlFor={photoId}
        className="btn btn-outline h-12 w-full cursor-pointer rounded-full"
        aria-label={t('delivery.photo')}
      >
        <Camera size={20} aria-hidden="true" className="shrink-0" />
        <span className="truncate">{photo ? photo.name : t('delivery.photoShort')}</span>
      </label>
      <input
        id={photoId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
      />
      {error && <Banner kind="error">{error}</Banner>}
      <button
        type="button"
        className="btn h-12 w-full rounded-full"
        disabled={mark.isPending}
        onClick={() => {
          setError(null)
          mark.mutate()
        }}
      >
        <Check size={20} aria-hidden="true" className="shrink-0" />
        <span className="truncate">
          {mark.isPending ? t('delivery.working') : t('delivery.confirm')}
        </span>
      </button>
      <button
        type="button"
        className="btn btn-outline h-11 w-full rounded-full"
        disabled={mark.isPending}
        onClick={() => {
          setOpen(false)
          setPhoto(null)
          setError(null)
        }}
      >
        {t('delivery.notYet')}
      </button>
    </div>
  )
}
