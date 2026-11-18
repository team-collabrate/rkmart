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
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        <Check size={18} aria-hidden="true" />
        {t('delivery.markDelivered')}
      </button>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-ink p-3">
      <label htmlFor={photoId} className="mb-1 block font-semibold">
        {t('delivery.photo')}
      </label>
      <p className="mb-2 text-sm text-mute">{t('delivery.photoHint')}</p>
      <label
        htmlFor={photoId}
        className="btn btn-outline mb-3 cursor-pointer"
        aria-label={t('delivery.photo')}
      >
        <Camera size={18} aria-hidden="true" />
        {photo ? photo.name : t('delivery.photo')}
      </label>
      <input
        id={photoId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
      />
      {error && (
        <div className="mb-3">
          <Banner kind="error">{error}</Banner>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn"
          disabled={mark.isPending}
          onClick={() => {
            setError(null)
            mark.mutate()
          }}
        >
          {mark.isPending ? t('delivery.working') : t('delivery.confirm')}
        </button>
        <button
          type="button"
          className="btn btn-outline"
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
    </div>
  )
}
