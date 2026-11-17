import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartLines } from './cart'

export interface Label {
  en: string
  ta: string
}

interface CartState {
  /** Whose cart this is. A different person signing in on the same phone starts with an empty cart. */
  ownerId: string | null
  lines: CartLines
  /** Item names kept with the cart, so an item that stops being available can still be named. */
  labels: Record<string, Label>
  note: string
  claim: (ownerId: string) => void
  setQty: (productId: string, qty: number, label?: Label) => void
  replace: (lines: CartLines, labels?: Record<string, Label>) => void
  setNote: (note: string) => void
  clear: () => void
}

/** The cart lives on the phone, so it survives closing the app. Only ids, names and quantities are kept. */
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      ownerId: null,
      lines: {},
      labels: {},
      note: '',

      claim: (ownerId) => {
        if (get().ownerId !== ownerId) set({ ownerId, lines: {}, labels: {}, note: '' })
      },

      setQty: (productId, qty, label) =>
        set((state) => {
          const lines = { ...state.lines }
          const labels = { ...state.labels }
          if (qty > 0) {
            lines[productId] = qty
            if (label) labels[productId] = label
          } else {
            delete lines[productId]
            delete labels[productId]
          }
          return { lines, labels }
        }),

      replace: (lines, labels = {}) => set({ lines: { ...lines }, labels: { ...labels } }),
      setNote: (note) => set({ note }),
      clear: () => set({ lines: {}, labels: {}, note: '' }),
    }),
    { name: 'rk.cart', version: 2 },
  ),
)
