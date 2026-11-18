import { todayISO } from '../lib/dates'
import type { DayPdf, Invoice } from './adminOrders'
import { issueInvoice } from './mockBilling'
import type { PaymentMethod } from './payments'
import {
  SAMPLE_PREVIOUS_RATES,
  SAMPLE_SETTINGS,
  SAMPLE_USERS,
  sampleProducts,
  sampleShops,
} from './sampleData'
import type { OrderStatus } from './shopApi'
import type { AppUser, CompanySettings, Product, RateMap, Shop } from './types'

// The demo "server": one in-memory store shared by the admin and shop demo APIs, so a rate the
// admin sets is what the shop sees. Used in development, tests and demo builds only.

export interface MockOrder {
  id: string
  shopId: string
  orderDate: string
  status: OrderStatus
  note: string
  createdAt: string
  items: { productId: string; qty: number; rate: number }[]
  /** Set when the order is delivered. */
  deliveredAt?: string
}

export interface MockPayment {
  id: string
  shopId: string
  amount: number
  invoiceId: string | null
  method: PaymentMethod
  paidOn: string
  note: string
  createdAt: string
}

export interface MockState {
  products: Product[]
  shops: Shop[]
  users: AppUser[]
  /** date -> rates */
  rates: Record<string, RateMap>
  settings: CompanySettings
  orders: MockOrder[]
  invoices: Invoice[]
  /** financial year code -> last invoice number used */
  invoiceCounters: Record<string, number>
  payments: MockPayment[]
  /** Saved day PDFs (the demo keeps the file in memory). */
  dayPdfs: { meta: DayPdf; blob: Blob }[]
  nextId: number
  /** Called whenever orders change, like the live updates from the real server. */
  listeners: Set<() => void>
}

/** Tells every open screen that orders changed. */
export function notifyOrdersChanged(state: MockState): void {
  state.listeners.forEach((callback) => callback())
}

function daysAgo(n: number): string {
  return todayISO(new Date(Date.now() - n * 86_400_000))
}

/**
 * `seedDemo` makes a fresh demo comfortable to try: today's rates are already set, the first shop
 * has two past orders with bills, and three other shops have just placed orders for the admin.
 * Tests leave it off to start from an empty day.
 */
export function createMockState(options: { seedDemo?: boolean } = {}): MockState {
  const state: MockState = {
    products: sampleProducts(),
    shops: sampleShops(),
    users: structuredClone(SAMPLE_USERS),
    rates: { '1970-01-01': structuredClone(SAMPLE_PREVIOUS_RATES) },
    settings: structuredClone(SAMPLE_SETTINGS),
    orders: [],
    invoices: [],
    invoiceCounters: {},
    payments: [],
    dayPdfs: [],
    nextId: 100,
    listeners: new Set(),
  }

  if (options.seedDemo) {
    // Today's rates: yesterday's with a few small changes, as a real morning would look.
    state.rates[todayISO()] = { ...SAMPLE_PREVIOUS_RATES, p1: 1350, p10: 780 }

    const today = todayISO()
    state.orders.push(
      {
        id: 'o1',
        shopId: 's1',
        orderDate: daysAgo(3),
        status: 'placed',
        note: '',
        createdAt: `${daysAgo(3)}T05:10:00.000Z`,
        items: [
          { productId: 'p1', qty: 4, rate: 1320 },
          { productId: 'p5', qty: 10, rate: 138 },
          { productId: 'p7', qty: 20, rate: 45 },
        ],
      },
      {
        id: 'o2',
        shopId: 's1',
        orderDate: daysAgo(1),
        status: 'placed',
        note: 'Morning delivery please',
        createdAt: `${daysAgo(1)}T04:40:00.000Z`,
        items: [
          { productId: 'p1', qty: 4, rate: 1330 },
          { productId: 'p9', qty: 5, rate: 380 },
          { productId: 'p10', qty: 6, rate: 790 },
        ],
      },
    )
    // Bill the two old orders the way the real server would, then mark the older one delivered.
    issueInvoice(state, 'o1', daysAgo(3))
    issueInvoice(state, 'o2', daysAgo(1))
    state.orders[0].status = 'delivered'
    state.orders[0].deliveredAt = `${daysAgo(2)}T07:30:00.000Z`
    // The first shop has paid part of its older bill.
    state.payments.push({
      id: 'pay1',
      shopId: 's1',
      amount: 5000,
      invoiceId: null,
      method: 'upi',
      paidOn: daysAgo(2),
      note: '',
      createdAt: `${daysAgo(2)}T10:00:00.000Z`,
    })

    state.orders.push(
      {
        id: 'o3',
        shopId: 's2',
        orderDate: today,
        status: 'placed',
        note: '',
        createdAt: `${today}T03:20:00.000Z`,
        items: [
          { productId: 'p1', qty: 2, rate: 1350 },
          { productId: 'p7', qty: 15, rate: 46 },
        ],
      },
      {
        id: 'o4',
        shopId: 's3',
        orderDate: today,
        status: 'placed',
        note: 'Call before delivery',
        createdAt: `${today}T03:45:00.000Z`,
        items: [
          { productId: 'p10', qty: 4, rate: 780 },
          { productId: 'p9', qty: 3, rate: 380 },
          { productId: 'p5', qty: 8, rate: 140 },
        ],
      },
      {
        id: 'o5',
        shopId: 's5',
        orderDate: today,
        status: 'placed',
        note: '',
        createdAt: `${today}T04:05:00.000Z`,
        items: [
          { productId: 'p1', qty: 3, rate: 1350 },
          { productId: 'p3', qty: 10, rate: 58 },
        ],
      },
    )
  }
  return state
}
