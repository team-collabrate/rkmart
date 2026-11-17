import { todayISO } from '../lib/dates'
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
}

export interface MockState {
  products: Product[]
  shops: Shop[]
  users: AppUser[]
  /** date -> rates */
  rates: Record<string, RateMap>
  settings: CompanySettings
  orders: MockOrder[]
  nextId: number
}

function daysAgo(n: number): string {
  return todayISO(new Date(Date.now() - n * 86_400_000))
}

/**
 * `seedDemo` makes a fresh demo comfortable to try: today's rates are already set, and the first
 * shop has two past orders. Tests leave it off to start from an empty day.
 */
export function createMockState(options: { seedDemo?: boolean } = {}): MockState {
  const state: MockState = {
    products: sampleProducts(),
    shops: sampleShops(),
    users: structuredClone(SAMPLE_USERS),
    rates: { '1970-01-01': structuredClone(SAMPLE_PREVIOUS_RATES) },
    settings: structuredClone(SAMPLE_SETTINGS),
    orders: [],
    nextId: 100,
  }

  if (options.seedDemo) {
    // Today's rates: yesterday's with a few small changes, as a real morning would look.
    state.rates[todayISO()] = { ...SAMPLE_PREVIOUS_RATES, p1: 1350, p10: 780 }

    state.orders.push(
      {
        id: 'o1',
        shopId: 's1',
        orderDate: daysAgo(3),
        status: 'delivered',
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
        status: 'billed',
        note: 'Morning delivery please',
        createdAt: `${daysAgo(1)}T04:40:00.000Z`,
        items: [
          { productId: 'p1', qty: 4, rate: 1330 },
          { productId: 'p9', qty: 5, rate: 380 },
          { productId: 'p10', qty: 6, rate: 790 },
        ],
      },
    )
  }
  return state
}
