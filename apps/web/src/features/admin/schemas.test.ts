import { describe, expect, it } from 'vitest'
import { fieldErrors, productSchema, settingsSchema, shopSchema, userSchema } from './schemas'

const product = {
  nameEn: 'Sugar',
  nameTa: 'சர்க்கரை',
  category: 'Staples',
  unit: 'kg',
  hsnCode: '1701',
  gstRate: 5,
  sortOrder: 70,
}

describe('item form', () => {
  it('accepts a good item', () => {
    expect(productSchema.safeParse(product).success).toBe(true)
  })

  it('needs an English name and a unit', () => {
    const r = productSchema.safeParse({ ...product, nameEn: ' ', unit: '' })
    expect(r.success).toBe(false)
    if (!r.success)
      expect(fieldErrors(r.error)).toEqual({
        nameEn: 'admin.errors.required',
        unit: 'admin.errors.required',
      })
  })

  it('checks HSN code and GST slab', () => {
    const hsn = productSchema.safeParse({ ...product, hsnCode: '17A1' })
    expect(!hsn.success && fieldErrors(hsn.error).hsnCode).toBe('admin.errors.hsn')
    const slab = productSchema.safeParse({ ...product, gstRate: 7 })
    expect(!slab.success && fieldErrors(slab.error).gstRate).toBe('admin.errors.gstRate')
    expect(productSchema.safeParse({ ...product, hsnCode: '' }).success).toBe(true)
  })
})

describe('shop form', () => {
  const shop = {
    nameEn: 'Annam Hotel',
    nameTa: '',
    ownerName: '',
    phone: '+91 98765 43210',
    address: '',
    stateCode: '33',
    gstin: '33aaaaa0000a1z5',
  }

  it('cleans the phone and GSTIN', () => {
    const r = shopSchema.safeParse(shop)
    expect(r.success && r.data.phone).toBe('9876543210')
    expect(r.success && r.data.gstin).toBe('33AAAAA0000A1Z5')
  })

  it('allows no phone and no GSTIN', () => {
    expect(shopSchema.safeParse({ ...shop, phone: '', gstin: '' }).success).toBe(true)
  })

  it('rejects a bad phone, GSTIN or state code', () => {
    const r = shopSchema.safeParse({ ...shop, phone: '123', gstin: 'BAD', stateCode: '3' })
    expect(!r.success && fieldErrors(r.error)).toEqual({
      phone: 'admin.errors.phone',
      gstin: 'admin.errors.gstin',
      stateCode: 'admin.errors.stateCode',
    })
  })
})

describe('login form', () => {
  const user = {
    fullName: 'Ravi',
    phone: '98765 43210',
    password: '1234',
    role: 'shop' as const,
    shopId: 's1',
    language: 'ta' as const,
  }

  it('accepts a shop owner linked to a shop', () => {
    const r = userSchema.safeParse(user)
    expect(r.success && r.data.phone).toBe('9876543210')
  })

  it('needs a shop for a shop owner but not for others', () => {
    const noShop = userSchema.safeParse({ ...user, shopId: null })
    expect(!noShop.success && fieldErrors(noShop.error).shopId).toBe('admin.errors.shopRequired')
    expect(userSchema.safeParse({ ...user, role: 'distributor', shopId: null }).success).toBe(true)
  })

  it('needs a valid phone and a 4-digit PIN', () => {
    const r = userSchema.safeParse({ ...user, phone: '12', password: 'short' })
    expect(!r.success && fieldErrors(r.error)).toEqual({
      phone: 'admin.errors.phone',
      password: 'admin.errors.password',
    })
  })
})

describe('company settings form', () => {
  const settings = {
    companyName: 'RK Agency',
    tagline: '',
    address: '',
    phone: '',
    gstin: '',
    stateCode: '33',
    bankDetails: '',
    invoicePrefix: 'rk',
    ratesIncludeGst: false,
  }

  it('upper-cases the invoice prefix', () => {
    const r = settingsSchema.safeParse(settings)
    expect(r.success && r.data.invoicePrefix).toBe('RK')
  })

  it('rejects a long or odd prefix', () => {
    expect(settingsSchema.safeParse({ ...settings, invoicePrefix: 'TOOLONG1' }).success).toBe(false)
    expect(settingsSchema.safeParse({ ...settings, invoicePrefix: 'R/K' }).success).toBe(false)
  })
})
