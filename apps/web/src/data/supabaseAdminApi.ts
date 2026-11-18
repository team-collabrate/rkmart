import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import { ApiError, type AdminApi, type ApiErrorCode } from './adminApi'
import type { AdminOrderDetail, AdminOrderSummary, DayPdf, Invoice } from './adminOrders'
import type { PaymentInput, ShopBalance } from './payments'
import { loadStatement } from './supabaseStatement'
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

// --- Orders and bills -------------------------------------------------------------------

interface OrderListRow {
  id: string
  shop_id: string
  order_date: string
  status: AdminOrderSummary['status']
  created_at: string
  shops: { name_en: string; name_ta: string | null } | null
  order_items: {
    qty: number | string
    rate: number | string
    products?: { name_en: string; sort_order: number } | null
  }[]
  invoices: { invoice_no: string; status: string }[]
}

interface InvoiceRow {
  id: string
  order_id: string
  invoice_no: string
  issue_date: string
  status: 'issued' | 'cancelled'
  cancelled_reason: string | null
  shop_name: string
  shop_address: string | null
  shop_gstin: string | null
  shop_state_code: string
  taxable_total: number | string
  cgst_total: number | string
  sgst_total: number | string
  igst_total: number | string
  round_off: number | string
  grand_total: number | string
  previous_balance: number | string
  total_due: number | string
  invoice_items: {
    line_no: number
    name_en: string
    name_ta: string | null
    hsn_code: string | null
    unit: string
    qty: number | string
    rate: number | string
    taxable: number | string
    gst_rate: number | string
    cgst: number | string
    sgst: number | string
    igst: number | string
    amount: number | string
  }[]
}

interface OrderDetailRow extends Omit<OrderListRow, 'shops' | 'order_items' | 'invoices'> {
  note: string | null
  shops: {
    name_en: string
    name_ta: string | null
    owner_name: string | null
    phone: string | null
    address: string | null
    gstin: string | null
    state_code: string
  } | null
  order_items: {
    product_id: string
    qty: number | string
    rate: number | string
    products: {
      name_en: string
      name_ta: string | null
      unit: string
      hsn_code: string | null
      gst_rate: number | string
      sort_order: number
    } | null
  }[]
  invoices: InvoiceRow[]
}

function toOrderSummary(row: OrderListRow): AdminOrderSummary {
  return {
    id: row.id,
    shopId: row.shop_id,
    shopNameEn: row.shops?.name_en ?? '',
    shopNameTa: row.shops?.name_ta ?? '',
    orderDate: row.order_date,
    status: row.status,
    itemCount: row.order_items.length,
    itemNames: [...row.order_items]
      .filter((i) => i.products)
      .sort((a, b) => (a.products?.sort_order ?? 0) - (b.products?.sort_order ?? 0))
      .slice(0, 3)
      .map((i) => i.products?.name_en ?? ''),
    total:
      Math.round(
        row.order_items.reduce((sum, i) => sum + Number(i.qty) * Number(i.rate), 0) * 100,
      ) / 100,
    createdAt: row.created_at,
    invoiceNo: row.invoices.find((i) => i.status === 'issued')?.invoice_no ?? null,
  }
}

function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    orderId: row.order_id,
    invoiceNo: row.invoice_no,
    issueDate: row.issue_date,
    status: row.status,
    cancelledReason: row.cancelled_reason ?? '',
    shopName: row.shop_name,
    shopAddress: row.shop_address ?? '',
    shopGstin: row.shop_gstin ?? '',
    shopStateCode: row.shop_state_code,
    taxableTotal: Number(row.taxable_total),
    cgstTotal: Number(row.cgst_total),
    sgstTotal: Number(row.sgst_total),
    igstTotal: Number(row.igst_total),
    roundOff: Number(row.round_off),
    grandTotal: Number(row.grand_total),
    previousBalance: Number(row.previous_balance),
    totalDue: Number(row.total_due),
    lines: [...row.invoice_items]
      .sort((a, b) => a.line_no - b.line_no)
      .map((l) => ({
        lineNo: l.line_no,
        nameEn: l.name_en,
        nameTa: l.name_ta ?? '',
        hsnCode: l.hsn_code ?? '',
        unit: l.unit,
        qty: Number(l.qty),
        rate: Number(l.rate),
        taxable: Number(l.taxable),
        gstRate: Number(l.gst_rate),
        cgst: Number(l.cgst),
        sgst: Number(l.sgst),
        igst: Number(l.igst),
        amount: Number(l.amount),
      })),
  }
}

interface DayPdfRow {
  id: string
  bill_date: string
  version: number
  bill_count: number
  invoice_ids: string[]
  created_at: string
  file_path: string
}

function toDayPdf(row: DayPdfRow): DayPdf {
  return {
    id: row.id,
    billDate: row.bill_date,
    version: row.version,
    billCount: row.bill_count,
    invoiceIds: row.invoice_ids,
    createdAt: row.created_at,
  }
}

function toOrderDetail(row: OrderDetailRow): AdminOrderDetail {
  const issued = row.invoices.find((i) => i.status === 'issued')
  const summary = toOrderSummary({ ...row, shops: row.shops, invoices: row.invoices })
  return {
    ...summary,
    note: row.note ?? '',
    shop: {
      nameEn: row.shops?.name_en ?? '',
      nameTa: row.shops?.name_ta ?? '',
      ownerName: row.shops?.owner_name ?? '',
      phone: row.shops?.phone ?? '',
      address: row.shops?.address ?? '',
      gstin: row.shops?.gstin ?? '',
      stateCode: row.shops?.state_code ?? '',
    },
    lines: [...row.order_items]
      .sort((a, b) => (a.products?.sort_order ?? 0) - (b.products?.sort_order ?? 0))
      .map((i) => ({
        productId: i.product_id,
        nameEn: i.products?.name_en ?? '',
        nameTa: i.products?.name_ta ?? '',
        unit: i.products?.unit ?? '',
        hsnCode: i.products?.hsn_code ?? '',
        gstRate: Number(i.products?.gst_rate ?? 0),
        qty: Number(i.qty),
        rate: Number(i.rate),
      })),
    invoice: issued ? toInvoice(issued) : null,
  }
}

/** The billing functions raise short codes like "not_placed" or "has_payments". */
export function billingError(error: { message?: string; code?: string }): ApiError {
  const message = error.message ?? ''
  const known: ApiErrorCode[] = [
    'not_found',
    'not_placed',
    'empty_order',
    'bad_quantity',
    'not_in_order',
    'already_cancelled',
    'already_delivered',
    'has_payments',
    'reason_required',
    'not_allowed',
    'not_billed',
    'bad_amount',
    'bad_date',
    'invoice_mismatch',
  ]
  const hit = known.find((code) => message.includes(code))
  if (hit) return new ApiError(hit)
  if (message.includes('not_admin') || error.code === '42501') return new ApiError('forbidden')
  if (message.toLowerCase().includes('fetch')) return new ApiError('network')
  return new ApiError('unknown', message)
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

    async listOrders(date) {
      const { data, error } = await client
        .from('orders')
        .select(
          'id, shop_id, order_date, status, created_at, shops(name_en, name_ta), order_items(qty, rate, products(name_en, sort_order)), invoices(invoice_no, status)',
        )
        .eq('order_date', date)
        .order('created_at', { ascending: false })
      if (error) fail(error)
      return (data as unknown as OrderListRow[]).map(toOrderSummary)
    },

    async getOrderDetail(id) {
      const { data, error } = await client
        .from('orders')
        .select(
          `id, shop_id, order_date, status, note, created_at,
           shops(name_en, name_ta, owner_name, phone, address, gstin, state_code),
           order_items(product_id, qty, rate, products(name_en, name_ta, unit, hsn_code, gst_rate, sort_order)),
           invoices(*, invoice_items(*))`,
        )
        .eq('id', id)
        .maybeSingle()
      if (error) fail(error)
      if (!data) throw new ApiError('not_found')
      return toOrderDetail(data as unknown as OrderDetailRow)
    },

    async adjustOrder(orderId, lines) {
      const { error } = await client.rpc('adjust_order', {
        p_order: orderId,
        p_items: lines.map((l) => ({ product_id: l.productId, qty: l.qty })),
      })
      if (error) throw billingError(error)
    },

    async generateBill(orderId) {
      const { data, error } = await client.rpc('finalize_bill', { p_order: orderId })
      if (error) throw billingError(error)
      return { invoiceId: String(data) }
    },

    async cancelBill(invoiceId, reason) {
      const { error } = await client.rpc('cancel_bill', { p_invoice: invoiceId, p_reason: reason })
      if (error) throw billingError(error)
    },

    onOrdersChanged(callback) {
      // Row level security decides which changes this admin receives.
      const channel = client
        .channel(`orders-live-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => callback())
        .subscribe()
      return () => {
        void client.removeChannel(channel)
      }
    },

    async listDayInvoices(date) {
      const { data, error } = await client
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('issue_date', date)
        .eq('status', 'issued')
        .order('invoice_no', { ascending: true })
      if (error) fail(error)
      return (data as unknown as InvoiceRow[]).map(toInvoice)
    },

    async listDayPdfs(date) {
      const { data, error } = await client
        .from('daily_bill_pdfs')
        .select('id, bill_date, version, bill_count, invoice_ids, created_at, file_path')
        .eq('bill_date', date)
        .order('version', { ascending: true })
      if (error) fail(error)
      return (data as unknown as DayPdfRow[]).map(toDayPdf)
    },

    async saveDayPdf(date, pdf, invoiceIds) {
      // The file goes to the private bucket first; the database then records it and numbers it.
      const path = `${date}/${crypto.randomUUID()}.pdf`
      const upload = await client.storage
        .from('daily-bills')
        .upload(path, pdf, { contentType: 'application/pdf' })
      if (upload.error) throw new ApiError('network')
      const { error } = await client.rpc('record_daily_pdf', {
        p_date: date,
        p_path: path,
        p_invoice_ids: invoiceIds,
      })
      if (error) throw billingError(error)
      const { data, error: readError } = await client
        .from('daily_bill_pdfs')
        .select('id, bill_date, version, bill_count, invoice_ids, created_at, file_path')
        .eq('file_path', path)
        .single()
      if (readError) fail(readError)
      return toDayPdf(data as unknown as DayPdfRow)
    },

    async getDayPdf(id) {
      const { data: row, error } = await client
        .from('daily_bill_pdfs')
        .select('file_path')
        .eq('id', id)
        .maybeSingle()
      if (error) fail(error)
      if (!row) throw new ApiError('not_found')
      const download = await client.storage.from('daily-bills').download(row.file_path as string)
      if (download.error || !download.data) throw new ApiError('network')
      return download.data
    },

    async listBalances() {
      const [balances, last] = await Promise.all([
        client.from('shop_balances').select('shop_id, name_en, name_ta, invoiced, paid, balance'),
        client.from('payments').select('shop_id, paid_on').order('paid_on', { ascending: false }),
      ])
      if (balances.error) fail(balances.error)
      if (last.error) fail(last.error)
      const lastPaid = new Map<string, string>()
      for (const row of last.data as { shop_id: string; paid_on: string }[]) {
        if (!lastPaid.has(row.shop_id)) lastPaid.set(row.shop_id, row.paid_on)
      }
      return (
        balances.data as {
          shop_id: string
          name_en: string
          name_ta: string | null
          invoiced: number | string
          paid: number | string
          balance: number | string
        }[]
      )
        .map((r): ShopBalance => ({
          shopId: r.shop_id,
          nameEn: r.name_en,
          nameTa: r.name_ta ?? '',
          invoiced: Number(r.invoiced),
          paid: Number(r.paid),
          balance: Number(r.balance),
          lastPaymentOn: lastPaid.get(r.shop_id) ?? null,
        }))
        .sort((a, b) => b.balance - a.balance || a.nameEn.localeCompare(b.nameEn))
    },

    async getShopStatement(shopId) {
      return loadStatement(client, shopId)
    },

    async recordPayment(input: PaymentInput) {
      const { data, error } = await client.rpc('record_payment', {
        p_shop: input.shopId,
        p_amount: input.amount,
        p_method: input.method,
        p_paid_on: input.paidOn,
        p_invoice: input.invoiceId,
        p_note: input.note,
      })
      if (error) throw billingError(error)
      return { paymentId: String(data) }
    },

    async voidPayment(paymentId, reason) {
      const { error } = await client.rpc('void_payment', { p_payment: paymentId, p_reason: reason })
      if (error) throw billingError(error)
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
