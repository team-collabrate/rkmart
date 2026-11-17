import type { Language, UserRole } from '../features/auth/types'

export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28] as const

export interface Product {
  id: string
  nameEn: string
  nameTa: string
  category: string
  unit: string
  hsnCode: string
  gstRate: number
  sortOrder: number
  isActive: boolean
}
export type ProductInput = Omit<Product, 'id' | 'isActive'>

export interface Shop {
  id: string
  nameEn: string
  nameTa: string
  ownerName: string
  phone: string
  address: string
  stateCode: string
  gstin: string
  isActive: boolean
}
export type ShopInput = Omit<Shop, 'id' | 'isActive'>

export interface AppUser {
  id: string
  role: UserRole
  fullName: string
  phone: string
  language: Language
  isActive: boolean
  shopId: string | null
  shopName: string | null
}

export interface NewUserInput {
  phone: string
  password: string
  fullName: string
  role: UserRole
  shopId: string | null
  language: Language
}

export interface CompanySettings {
  companyName: string
  tagline: string
  address: string
  phone: string
  gstin: string
  stateCode: string
  bankDetails: string
  invoicePrefix: string
  ratesIncludeGst: boolean
}

/** productId -> rate (rupees, before GST unless settings say otherwise). */
export type RateMap = Record<string, number>
