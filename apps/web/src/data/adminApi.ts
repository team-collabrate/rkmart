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

  getSettings(): Promise<CompanySettings>
  saveSettings(input: CompanySettings): Promise<CompanySettings>
}
