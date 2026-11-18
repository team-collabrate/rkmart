import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarClock,
  ChevronLeft,
  FilePlus2,
  FileText,
  Info,
  Lock,
  MapPin,
  MessageSquareText,
  Phone,
  Receipt,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { QuantityCapsule } from '../../components/QuantityCapsule'
import { StatusSteps } from '../../components/StatusSteps'
import { Banner, Loading } from '../../components/ui'
import { useAdminApi } from '../../data/apiContext'
import type { AdminOrderDetail } from '../../data/adminOrders'
import { formatDay, formatTime } from '../../lib/dates'
import { formatINR, formatRupees, roundPaise } from '../../lib/money'
import { displayNames } from '../../lib/names'
import type { Language } from '../auth/types'
import { formatQty, parseQty, stepQty } from '../shop/cart'
import { emojiFor } from '../shop/itemVisual'
import { OrderStatusPill } from '../shop/OrderStatusPill'
import { MarkDeliveredPanel } from '../delivery/MarkDeliveredPanel'
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

/** A small icon in a soft circle, leading a row of details. */
function IconDot({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-dark">
      {children}
    </span>
  )
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
    await queryClient.invalidateQueries({ queryKey: ['admin-day-invoices'] })
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

  function step(productId: string, current: number | null, direction: 1 | -1) {
    const base = current ?? order.lines.find((l) => l.productId === productId)?.qty ?? 1
    const next = stepQty(base, direction)
    if (next <= 0) return
    setQty({ ...qty, [productId]: formatQty(next) })
    setNotice(null)
  }

  const shopNames = displayNames(order.shop.nameEn, order.shop.nameTa, language)
  const when = [
    shopNames.secondary,
    formatDay(order.orderDate, language),
    formatTime(order.createdAt, language),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="-mx-4 -mb-28 -mt-2 min-h-[calc(100dvh-4rem)] bg-page px-4 pb-52 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/admin/orders"
          aria-label={t('admin.common.back')}
          className="grid size-11 place-items-center rounded-full bg-paper shadow-[0_1px_2px_rgba(15,26,20,0.08)]"
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
        <OrderStatusPill status={order.status} admin />
      </div>

      <div className="mb-4 rounded-[1.75rem] border border-line bg-paper p-4">
        <div className="flex items-center gap-3">
          <span className="[&>span]:size-14 [&>span]:text-lg">
            <Avatar name={order.shop.nameEn} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[1.375rem] leading-tight">{shopNames.primary}</h1>
            <p className="flex items-center gap-1.5 truncate text-sm text-mute">
              <CalendarClock size={14} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{when}</span>
            </p>
          </div>
        </div>
        <ul className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          <li className="flex items-center gap-3">
            <IconDot>
              <Phone size={18} aria-hidden="true" />
            </IconDot>
            <a href={`tel:${order.shop.phone}`} className="font-medium no-underline">
              {order.shop.phone}
              <span className="text-mute"> · {order.shop.ownerName}</span>
            </a>
          </li>
          <li className="flex items-center gap-3">
            <IconDot>
              <MapPin size={18} aria-hidden="true" />
            </IconDot>
            <span>{order.shop.address}</span>
          </li>
          <li className="flex items-center gap-3">
            <IconDot>
              {order.shop.gstin ? (
                <ShieldCheck size={18} aria-hidden="true" />
              ) : (
                <ShieldAlert size={18} aria-hidden="true" />
              )}
            </IconDot>
            <span className={order.shop.gstin ? 'font-medium' : 'text-mute'}>
              {order.shop.gstin || t('admin.orders.noGstin')}
            </span>
          </li>
        </ul>
      </div>

      <div className="mb-4 rounded-[1.75rem] border border-line bg-paper px-3 py-4">
        <StatusSteps status={order.status} />
      </div>

      {order.note && (
        <p className="mb-4 flex items-center gap-3 rounded-3xl bg-amber-soft p-4 font-medium text-amber">
          <MessageSquareText size={20} aria-hidden="true" className="shrink-0" />
          <span>{order.note}</span>
        </p>
      )}

      <ul className="mb-4 divide-y divide-line overflow-hidden rounded-[1.75rem] border border-line bg-paper">
        {edited.map(({ line, value, gone }) => {
          const names = displayNames(line.nameEn, line.nameTa, language)
          const bad = !gone && value === null
          const inputId = `qty-${line.productId}`
          return (
            <li key={line.productId} className={'p-4 ' + (gone ? 'bg-page' : '')}>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-12 shrink-0 place-items-center rounded-2xl bg-tint-green text-2xl"
                >
                  {emojiFor(line.nameEn, '')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={'font-semibold ' + (gone ? 'text-mute line-through' : '')}>
                    {names.primary}
                  </p>
                  {names.secondary && (
                    <p className="truncate text-sm text-mute">{names.secondary}</p>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                    <span className="rounded-full bg-page px-2 py-0.5">
                      ₹{formatRupees(line.rate)}/{line.unit}
                    </span>
                    <span className="rounded-full bg-page px-2 py-0.5">{line.gstRate}%</span>
                  </p>
                </div>
                {!gone && (
                  <p className="whitespace-nowrap font-display text-lg font-bold">
                    ₹{formatINR(roundPaise((value ?? 0) * line.rate))}
                  </p>
                )}
              </div>

              {editable ? (
                <div className="mt-3 flex items-center justify-between gap-2">
                  {gone ? (
                    <>
                      <span className="font-semibold text-mute">{t('admin.orders.removed')}</span>
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-paper px-4 font-semibold text-brand-dark shadow-[0_0_0_1px_var(--color-line)]"
                        onClick={() => {
                          const next = new Set(removed)
                          next.delete(line.productId)
                          setRemoved(next)
                          setNotice(null)
                        }}
                      >
                        <Undo2 size={18} aria-hidden="true" />
                        {t('admin.orders.undoRemove')}
                      </button>
                    </>
                  ) : (
                    <>
                      <label htmlFor={inputId} className="sr-only">
                        {t('admin.orders.qty')} · {names.primary}
                      </label>
                      <QuantityCapsule
                        inputId={inputId}
                        value={qty[line.productId] ?? ''}
                        unit={line.unit}
                        invalid={bad}
                        canDecrease={(value ?? 0) > 1}
                        describedBy={bad ? `${inputId}-error` : undefined}
                        onType={(v) => {
                          setQty({ ...qty, [line.productId]: v })
                          setNotice(null)
                        }}
                        onStep={(direction) => step(line.productId, value, direction)}
                        decreaseLabel={t('shop.order.decrease', { name: names.primary })}
                        increaseLabel={t('shop.order.increase', { name: names.primary })}
                      />
                      <button
                        type="button"
                        className="grid size-11 place-items-center rounded-2xl bg-red-soft text-red transition-transform active:scale-90"
                        aria-label={t('admin.orders.remove', { name: names.primary })}
                        onClick={() => {
                          setRemoved(new Set(removed).add(line.productId))
                          setNotice(null)
                        }}
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm font-medium text-mute">
                  {formatQty(line.qty)} {line.unit}
                </p>
              )}
              {bad && (
                <p id={`${inputId}-error`} role="alert" className="mt-2 text-sm font-semibold">
                  {t('admin.orders.badQty')}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <div className="mb-4 rounded-[1.75rem] border border-line bg-paper p-4">
        <div className="flex items-center gap-3">
          <IconDot>
            <Receipt size={18} aria-hidden="true" />
          </IconDot>
          <span className="flex-1 font-medium">{t('admin.orders.subtotal')}</span>
          <span className="font-display text-2xl font-bold">₹{formatINR(subtotal)}</span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-mute">
          <Info size={14} aria-hidden="true" className="shrink-0" />
          {t('admin.orders.subtotalNote')}
        </p>
      </div>

      {notice && (
        <div className="mb-4">
          <Banner kind={notice.kind}>{notice.text}</Banner>
        </div>
      )}

      {editable ? (
        <div className="fixed bottom-[6.25rem] left-1/2 z-10 w-full max-w-[30rem] -translate-x-1/2 px-4">
          <div className="rounded-[1.75rem] border border-line bg-paper p-3 shadow-[0_8px_30px_rgba(15,26,20,0.12)]">
            {dirty && (
              <p className="mb-2 flex items-center gap-1.5 px-1 text-xs text-mute">
                <Info size={14} aria-hidden="true" className="shrink-0" />
                {t('admin.orders.unsaved')}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-outline flex-1"
                onClick={onSave}
                disabled={!dirty || save.isPending}
              >
                <Save size={18} aria-hidden="true" />
                {save.isPending ? t('admin.common.saving') : t('admin.orders.saveChanges')}
              </button>
              <button
                type="button"
                className="btn flex-1"
                onClick={() => bill.mutate()}
                disabled={dirty || bill.isPending}
              >
                <FilePlus2 size={18} aria-hidden="true" />
                {bill.isPending ? t('admin.orders.generating') : t('admin.orders.generate')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-line bg-paper p-4">
          <p className="mb-3 flex items-center gap-2 text-sm text-mute">
            <Lock size={16} aria-hidden="true" className="shrink-0" />
            {t('admin.orders.notEditable')}
          </p>
          {order.invoiceNo && (
            <Link to={`/admin/orders/${order.id}/bill`} className="btn w-full no-underline">
              <FileText size={18} aria-hidden="true" />
              {t('admin.orders.viewBill')} · {order.invoiceNo}
            </Link>
          )}
          {order.status === 'billed' && (
            <div className="mt-3">
              <MarkDeliveredPanel orderId={order.id} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
