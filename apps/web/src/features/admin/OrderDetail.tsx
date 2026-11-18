import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FilePlus2, FileText, Save, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { Banner, Loading, PageHeader } from '../../components/ui'
import { useAdminApi } from '../../data/apiContext'
import type { AdminOrderDetail } from '../../data/adminOrders'
import { formatDay, formatTime } from '../../lib/dates'
import { formatINR, formatRupees, roundPaise } from '../../lib/money'
import { displayNames } from '../../lib/names'
import type { Language } from '../auth/types'
import { formatQty, parseQty } from '../shop/cart'
import { OrderStatusPill } from '../shop/OrderStatusPill'
import { errorText, useOrderDetail } from './queries'

type Notice = { kind: 'success' | 'error'; text: string } | null

export function OrderDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const order = useOrderDetail(id)
  // Kept here, so the "saved" message survives the editor restarting with the new quantities.
  const [notice, setNotice] = useState<Notice>(null)

  if (order.isPending) return <Loading />
  if (order.isError) return <Banner kind="error">{errorText(t, order.error)}</Banner>
  // Keyed on what the server holds, so the boxes start fresh after a save or a change elsewhere.
  const signature = order.data.status + JSON.stringify(order.data.lines)
  return <OrderEditor key={signature} order={order.data} notice={notice} setNotice={setNotice} />
}

/** Order lines with editable quantities (before billing), the shop's details, and the bill button. */
function OrderEditor({
  order,
  notice,
  setNotice,
}: {
  order: AdminOrderDetail
  notice: Notice
  setNotice: (notice: Notice) => void
}) {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const api = useAdminApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const editable = order.status === 'placed'
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.lines.map((l) => [l.productId, formatQty(l.qty)])),
  )
  const [removed, setRemoved] = useState<Set<string>>(() => new Set())

  // What each line would be after the edits. `null` means the text is not a valid quantity.
  const edited = order.lines.map((l) => {
    const parsed = parseQty(qty[l.productId] ?? '')
    const value = parsed.ok ? parsed.value : null
    return { line: l, value, gone: removed.has(l.productId) }
  })
  const kept = edited.filter((e) => !e.gone)
  const anyInvalid = kept.some((e) => e.value === null)
  const dirty = edited.some(
    (e) => e.gone || (e.value !== null && e.value !== e.line.qty) || e.value === null,
  )
  const subtotal = roundPaise(kept.reduce((sum, e) => sum + (e.value ?? 0) * e.line.rate, 0))

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-order'] })
  }

  const save = useMutation({
    mutationFn: () =>
      api.adjustOrder(
        order.id,
        kept.map((e) => ({ productId: e.line.productId, qty: e.value ?? e.line.qty })),
      ),
    onSuccess: async () => {
      await refresh()
      setNotice({ kind: 'success', text: t('admin.orders.savedChanges') })
    },
    onError: (error) => setNotice({ kind: 'error', text: errorText(t, error) }),
  })

  const bill = useMutation({
    mutationFn: () => api.generateBill(order.id),
    onSuccess: async () => {
      await refresh()
      void navigate(`/admin/orders/${order.id}/bill`)
    },
    onError: (error) => setNotice({ kind: 'error', text: errorText(t, error) }),
  })

  function onSave() {
    if (anyInvalid) {
      setNotice({ kind: 'error', text: t('admin.orders.badQty') })
      return
    }
    if (kept.length === 0) {
      setNotice({ kind: 'error', text: t('admin.orders.nothingLeft') })
      return
    }
    setNotice(null)
    save.mutate()
  }

  const shopNames = displayNames(order.shop.nameEn, order.shop.nameTa, language)

  return (
    <section className="max-w-2xl">
      <PageHeader
        title={shopNames.primary}
        backTo="/admin/orders"
        action={<OrderStatusPill status={order.status} />}
      />
      <p className="-mt-2 mb-4 text-sm text-mute">
        {formatDay(order.orderDate, language)} ·{' '}
        {t('admin.orders.placedAt', { time: formatTime(order.createdAt, language) })}
      </p>

      <div className="mb-4 rounded-xl border-2 border-ink p-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="font-semibold">{t('admin.orders.owner')}</dt>
          <dd>{order.shop.ownerName}</dd>
          <dt className="font-semibold">{t('admin.orders.phone')}</dt>
          <dd>{order.shop.phone}</dd>
          <dt className="font-semibold">{t('admin.orders.address')}</dt>
          <dd>{order.shop.address}</dd>
          <dt className="font-semibold">{t('admin.orders.gstin')}</dt>
          <dd>{order.shop.gstin || t('admin.orders.noGstin')}</dd>
        </dl>
      </div>

      {order.note && (
        <p className="mb-4 rounded-xl border-2 border-dashed border-ink px-3 py-2">
          <span className="font-semibold">{t('admin.orders.note')}: </span>
          {order.note}
        </p>
      )}

      <h2 className="mb-2 text-lg">{t('admin.orders.lines')}</h2>
      <ul className="mb-3 divide-y-2 divide-hair rounded-xl border-2 border-ink">
        {edited.map(({ line, value, gone }) => {
          const names = displayNames(line.nameEn, line.nameTa, language)
          const bad = !gone && value === null
          const inputId = `qty-${line.productId}`
          return (
            <li key={line.productId} className="px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={'font-semibold ' + (gone ? 'text-mute line-through' : '')}>
                    {names.primary}
                  </p>
                  <p className="text-sm text-mute">
                    {t('admin.orders.lineMeta', {
                      unit: line.unit,
                      rate: formatRupees(line.rate),
                      gst: line.gstRate,
                    })}
                  </p>
                </div>
                {!gone && (
                  <p className="whitespace-nowrap font-bold">
                    ₹{formatINR(roundPaise((value ?? 0) * line.rate))}
                  </p>
                )}
              </div>

              {editable ? (
                <div className="mt-2 flex items-center gap-2">
                  {gone ? (
                    <>
                      <span className="font-semibold">{t('admin.orders.removed')}</span>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => {
                          const next = new Set(removed)
                          next.delete(line.productId)
                          setRemoved(next)
                          setNotice(null)
                        }}
                      >
                        <Undo2 size={16} aria-hidden="true" />
                        {t('admin.orders.undoRemove')}
                      </button>
                    </>
                  ) : (
                    <>
                      <label htmlFor={inputId} className="sr-only">
                        {t('admin.orders.qty')} · {names.primary}
                      </label>
                      <input
                        id={inputId}
                        inputMode="decimal"
                        value={qty[line.productId] ?? ''}
                        onChange={(e) => {
                          setQty({ ...qty, [line.productId]: e.target.value })
                          setNotice(null)
                        }}
                        aria-invalid={bad}
                        aria-describedby={bad ? `${inputId}-error` : undefined}
                        className="field w-28"
                      />
                      <span className="text-sm text-mute">{line.unit}</span>
                      <button
                        type="button"
                        className="btn btn-outline ml-auto"
                        aria-label={t('admin.orders.remove', { name: names.primary })}
                        onClick={() => {
                          setRemoved(new Set(removed).add(line.productId))
                          setNotice(null)
                        }}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-sm">
                  {t('admin.orders.qty')}: {formatQty(line.qty)} {line.unit}
                </p>
              )}
              {bad && (
                <p id={`${inputId}-error`} role="alert" className="mt-1 text-sm font-semibold">
                  {t('admin.orders.badQty')}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <div className="mb-1 flex items-baseline justify-between border-t-2 border-ink pt-3">
        <span className="font-semibold">{t('admin.orders.subtotal')}</span>
        <span className="font-display text-2xl font-bold">₹{formatINR(subtotal)}</span>
      </div>
      <p className="mb-4 text-sm text-mute">{t('admin.orders.subtotalNote')}</p>

      {notice && (
        <div className="mb-3">
          <Banner kind={notice.kind}>{notice.text}</Banner>
        </div>
      )}

      {editable ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onSave}
            disabled={!dirty || save.isPending}
          >
            <Save size={18} aria-hidden="true" />
            {save.isPending ? t('admin.common.saving') : t('admin.orders.saveChanges')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => bill.mutate()}
            disabled={dirty || bill.isPending}
          >
            <FilePlus2 size={18} aria-hidden="true" />
            {bill.isPending ? t('admin.orders.generating') : t('admin.orders.generate')}
          </button>
          {dirty && <p className="w-full text-sm text-mute">{t('admin.orders.unsaved')}</p>}
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-mute">{t('admin.orders.notEditable')}</p>
          {order.invoiceNo && (
            <Link to={`/admin/orders/${order.id}/bill`} className="btn no-underline">
              <FileText size={18} aria-hidden="true" />
              {t('admin.orders.viewBill')} · {order.invoiceNo}
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
