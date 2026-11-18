import type { AdminOrderDetail, AdminOrderSummary, DayPdf, Invoice } from './adminOrders'
import type { CartLine } from './shopApi'
import type {
  AppUser,
  CompanySettings,
  NewUserInput,
  Product,
  ProductInput,
  RateMap,
  Shop,
  ShopInput,
} from './types'

export type ApiErrorCode =
  | 'duplicate_phone'
  | 'invalid'
  | 'not_found'
  | 'forbidden'
  | 'network'
  | 'not_configured'
  | 'shop_inactive'
  | 'empty_order'
  | 'bad_quantity'
  | 'inactive_item'
  | 'no_rate'
  | 'not_placed'
  | 'already_delivered'
  | 'already_cancelled'
  | 'has_payments'
  | 'reason_required'
  | 'not_in_order'
  | 'unknown'

/** A failure the screens can show in plain words. `code` picks the translated message. */
export class ApiError extends Error {
  code: ApiErrorCode
  constructor(code: ApiErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

/** Everything the admin screens need. Implemented by Supabase and by an in-memory demo version. */
export interface AdminApi {
  listProducts(): Promise<Product[]>
  saveProduct(input: ProductInput, id?: string): Promise<Product>
  setProductActive(id: string, active: boolean): Promise<void>

  /** Rates saved for one day. */
  getRates(date: string): Promise<RateMap>
  /** The most recent earlier rate of each item (used for "same as yesterday"). */
  getPreviousRates(beforeDate: string): Promise<RateMap>
  saveRates(date: string, rates: RateMap): Promise<void>

  listShops(): Promise<Shop[]>
  saveShop(input: ShopInput, id?: string): Promise<Shop>
  setShopActive(id: string, active: boolean): Promise<void>

  listUsers(): Promise<AppUser[]>
  createUser(input: NewUserInput): Promise<{ userId: string }>
  resetPassword(userId: string, password: string): Promise<void>
  setUserActive(userId: string, active: boolean): Promise<void>

  /** Orders of one day, newest first. */
  listOrders(date: string): Promise<AdminOrderSummary[]>
  getOrderDetail(id: string): Promise<AdminOrderDetail>
  /** Fix quantities after packing (placed orders only). Lines left out are removed. */
  adjustOrder(orderId: string, lines: CartLine[]): Promise<void>
  /** Makes the GST bill for a placed order. */
  generateBill(orderId: string): Promise<{ invoiceId: string }>
  /** Cancels a bill (its number stays used). The order goes back to placed. */
  cancelBill(invoiceId: string, reason: string): Promise<void>
  /** Calls back when orders change. Returns a function that stops listening. */
  onOrdersChanged(callback: () => void): () => void

  /** The issued bills of one day, in invoice-number order (cancelled bills are left out). */
  listDayInvoices(date: string): Promise<Invoice[]>
  /** Saved PDFs of one day, oldest first. */
  listDayPdfs(date: string): Promise<DayPdf[]>
  /** Saves a PDF holding these bills and gives it the next version number for the day. */
  saveDayPdf(date: string, pdf: Blob, invoiceIds: string[]): Promise<DayPdf>
  /** Gets a saved PDF back, to download or print again. */
  getDayPdf(id: string): Promise<Blob>

  getSettings(): Promise<CompanySettings>
  saveSettings(input: CompanySettings): Promise<CompanySettings>
}
