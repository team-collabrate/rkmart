import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import { ApiError, type AdminApi } from './adminApi'
import type {
  AppUser,
  CompanySettings,
  Product,
  ProductInput,
  RateMap,
  Shop,
  ShopInput,
} from './types'

// Real version of the admin API. Table access is limited by the database's row level security
// (admin only for these tables); logins go through the admin-users edge function, so the
// service-role key never reaches the app.
//
// Status: written in Stage 3, NOT yet run against a live Supabase project.

interface ProductRow {
  id: string
  name_en: string
  name_ta: string | null
  category: string | null
  unit: string
  hsn_code: string | null
  gst_rate: number | string
  sort_order: number
  is_active: boolean
}
interface ShopRow {
  id: string
  name_en: string
  name_ta: string | null
  owner_name: string | null
  phone: string | null
  address: string | null
  state_code: string
  gstin: string | null
  is_active: boolean
}
interface UserRow {
  id: string
  role: AppUser['role']
  full_name: string
  phone: string
  language: AppUser['language']
  is_active: boolean
  shop_id: string | null
  shops: { name_en: string } | null
}
interface SettingsRow {
  company_name: string
  tagline: string | null
  address: string | null
  phone: string | null
  gstin: string | null
  state_code: string
  bank_details: string | null
  invoice_prefix: string
  rates_include_gst: boolean
}

const toProduct = (r: ProductRow): Product => ({
  id: r.id,
  nameEn: r.name_en,
  nameTa: r.name_ta ?? '',
  category: r.category ?? '',
  unit: r.unit,
  hsnCode: r.hsn_code ?? '',
  gstRate: Number(r.gst_rate),
  sortOrder: r.sort_order,
  isActive: r.is_active,
})
const toShop = (r: ShopRow): Shop => ({
  id: r.id,
  nameEn: r.name_en,
  nameTa: r.name_ta ?? '',
  ownerName: r.owner_name ?? '',
  phone: r.phone ?? '',
  address: r.address ?? '',
  stateCode: r.state_code,
  gstin: r.gstin ?? '',
  isActive: r.is_active,
})
const blank = (v: string) => (v.trim() === '' ? null : v.trim())

function fail(error: unknown): never {
  if (error instanceof ApiError) throw error
  const e = error as { code?: string; message?: string; status?: number } | null
  if (e?.code === '23505') throw new ApiError('duplicate_phone')
  if (e?.code === '42501' || e?.status === 401 || e?.status === 403) throw new ApiError('forbidden')
  if (e?.message?.toLowerCase().includes('fetch')) throw new ApiError('network')
  throw new ApiError('unknown', e?.message)
}

function dayBefore(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export function createSupabaseAdminApi(client: SupabaseClient): AdminApi {
  async function callUsers(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data, error } = await client.functions.invoke('admin-users', { body })
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const status = error.context.status
        if (status === 409) throw new ApiError('duplicate_phone')
        if (status === 401 || status === 403) throw new ApiError('forbidden')
        if (status === 400) throw new ApiError('invalid')
      }
      throw new ApiError('network')
    }
    return (data ?? {}) as Record<string, unknown>
  }

  return {
    async listProducts() {
      const { data, error } = await client
        .from('products')
        .select('*')
        .order('sort_order')
        .order('name_en')
      if (error) fail(error)
      return (data as ProductRow[]).map(toProduct)
    },

    async saveProduct(input: ProductInput, id) {
      const row = {
        name_en: input.nameEn.trim(),
        name_ta: blank(input.nameTa),
        category: blank(input.category),
        unit: input.unit.trim(),
        hsn_code: blank(input.hsnCode),
        gst_rate: input.gstRate,
        sort_order: input.sortOrder,
      }
      const query = id
        ? client.from('products').update(row).eq('id', id)
        : client.from('products').insert(row)
      const { data, error } = await query.select().single<ProductRow>()
      if (error) fail(error)
      return toProduct(data as ProductRow)
    },

    async setProductActive(id, active) {
      const { error } = await client.from('products').update({ is_active: active }).eq('id', id)
      if (error) fail(error)
    },

    async getRates(date) {
      const { data, error } = await client
        .from('daily_rates')
        .select('product_id, rate')
        .eq('rate_date', date)
      if (error) fail(error)
      const map: RateMap = {}
      for (const r of data as { product_id: string; rate: number | string }[]) {
        map[r.product_id] = Number(r.rate)
      }
      return map
    },

    async getPreviousRates(beforeDate) {
      const { data, error } = await client
        .from('daily_rates')
        .select('product_id, rate, rate_date')
        .lt('rate_date', beforeDate)
        .gte('rate_date', dayBefore(beforeDate, 14))
        .order('rate_date', { ascending: true })
      if (error) fail(error)
      const map: RateMap = {}
      // Ascending order: later days overwrite earlier ones, so each item ends with its latest rate.
      for (const r of data as { product_id: string; rate: number | string }[]) {
        map[r.product_id] = Number(r.rate)
      }
      return map
    },

    async saveRates(date, rates) {
      const { data: auth } = await client.auth.getUser()
      const rows = Object.entries(rates).map(([product_id, rate]) => ({
        product_id,
        rate_date: date,
        rate,
        set_by: auth.user?.id ?? null,
      }))
      if (rows.length === 0) return
      const { error } = await client
        .from('daily_rates')
        .upsert(rows, { onConflict: 'product_id,rate_date' })
      if (error) fail(error)
    },

    async listShops() {
      const { data, error } = await client.from('shops').select('*').order('name_en')
      if (error) fail(error)
      return (data as ShopRow[]).map(toShop)
    },

    async saveShop(input: ShopInput, id) {
      const row = {
        name_en: input.nameEn.trim(),
        name_ta: blank(input.nameTa),
        owner_name: blank(input.ownerName),
        phone: blank(input.phone),
        address: blank(input.address),
        state_code: input.stateCode,
        gstin: blank(input.gstin)?.toUpperCase() ?? null,
      }
      const query = id
        ? client.from('shops').update(row).eq('id', id)
        : client.from('shops').insert(row)
      const { data, error } = await query.select().single<ShopRow>()
      if (error) fail(error)
      return toShop(data as ShopRow)
    },

    async setShopActive(id, active) {
      const { error } = await client.from('shops').update({ is_active: active }).eq('id', id)
      if (error) fail(error)
    },

    async listUsers() {
      const { data, error } = await client
        .from('profiles')
        .select('id, role, full_name, phone, language, is_active, shop_id, shops(name_en)')
        .order('role')
        .order('full_name')
      if (error) fail(error)
      return (data as unknown as UserRow[]).map((r) => ({
        id: r.id,
        role: r.role,
        fullName: r.full_name,
        phone: r.phone,
        language: r.language,
        isActive: r.is_active,
        shopId: r.shop_id,
        shopName: r.shops?.name_en ?? null,
      }))
    },

    async createUser(input) {
      const result = await callUsers({ action: 'create', ...input })
      return { userId: String(result.userId) }
    },

    async resetPassword(userId, password) {
      await callUsers({ action: 'reset_password', userId, password })
    },

    async setUserActive(userId, active) {
      await callUsers({ action: 'set_active', userId, active })
    },

    async getSettings() {
      const { data, error } = await client.from('settings').select('*').single<SettingsRow>()
      if (error) fail(error)
      const r = data as SettingsRow
      return {
        companyName: r.company_name,
        tagline: r.tagline ?? '',
        address: r.address ?? '',
        phone: r.phone ?? '',
        gstin: r.gstin ?? '',
        stateCode: r.state_code,
        bankDetails: r.bank_details ?? '',
        invoicePrefix: r.invoice_prefix,
        ratesIncludeGst: r.rates_include_gst,
      }
    },

    async saveSettings(input: CompanySettings) {
      const { error } = await client
        .from('settings')
        .update({
          company_name: input.companyName.trim(),
          tagline: blank(input.tagline),
          address: blank(input.address),
          phone: blank(input.phone),
          gstin: blank(input.gstin)?.toUpperCase() ?? null,
          state_code: input.stateCode,
          bank_details: blank(input.bankDetails),
          invoice_prefix: input.invoicePrefix.trim().toUpperCase(),
          rates_include_gst: input.ratesIncludeGst,
        })
        .eq('id', true)
      if (error) fail(error)
      return input
    },
  }
}
