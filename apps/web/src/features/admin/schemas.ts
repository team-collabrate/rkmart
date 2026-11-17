import { z } from 'zod'
import { GST_RATES } from '../../data/types'
import { isValidPhone, normalizePhone } from '../../lib/phone'

// Form checks. Each message is a translation key (see i18n "admin.errors"), so the same check
// reads correctly in English and Tamil.

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const required = 'admin.errors.required'

const optionalPhone = z
  .string()
  .transform((v) => (v.trim() === '' ? '' : normalizePhone(v)))
  .refine((v) => v === '' || isValidPhone(v), { message: 'admin.errors.phone' })

const optionalGstin = z
  .string()
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => v === '' || GSTIN.test(v), { message: 'admin.errors.gstin' })

const stateCode = z.string().regex(/^[0-9]{2}$/, { message: 'admin.errors.stateCode' })

export const productSchema = z.object({
  nameEn: z.string().trim().min(1, { message: required }),
  nameTa: z.string().trim(),
  category: z.string().trim(),
  unit: z.string().trim().min(1, { message: required }),
  hsnCode: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[0-9]{4,8}$/.test(v), { message: 'admin.errors.hsn' }),
  gstRate: z
    .number({ message: 'admin.errors.gstRate' })
    .refine((v) => (GST_RATES as readonly number[]).includes(v), {
      message: 'admin.errors.gstRate',
    }),
  sortOrder: z.number({ message: 'admin.errors.number' }).int({ message: 'admin.errors.number' }),
})

export const shopSchema = z.object({
  nameEn: z.string().trim().min(1, { message: required }),
  nameTa: z.string().trim(),
  ownerName: z.string().trim(),
  phone: optionalPhone,
  address: z.string().trim(),
  stateCode,
  gstin: optionalGstin,
})

export const userSchema = z
  .object({
    fullName: z.string().trim().min(1, { message: required }),
    phone: z
      .string()
      .transform((v) => normalizePhone(v))
      .refine(isValidPhone, { message: 'admin.errors.phone' }),
    password: z
      .string()
      .min(8, { message: 'admin.errors.password' })
      .max(72, { message: 'admin.errors.password' }),
    role: z.enum(['admin', 'distributor', 'shop']),
    shopId: z.string().nullable(),
    language: z.enum(['en', 'ta']),
  })
  .refine((u) => u.role !== 'shop' || Boolean(u.shopId), {
    message: 'admin.errors.shopRequired',
    path: ['shopId'],
  })

export const passwordSchema = z.object({
  password: z
    .string()
    .min(8, { message: 'admin.errors.password' })
    .max(72, { message: 'admin.errors.password' }),
})

export const settingsSchema = z.object({
  companyName: z.string().trim().min(1, { message: required }),
  tagline: z.string().trim(),
  address: z.string().trim(),
  phone: optionalPhone,
  gstin: optionalGstin,
  stateCode,
  bankDetails: z.string().trim(),
  invoicePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,6}$/, { message: 'admin.errors.prefix' }),
  ratesIncludeGst: z.boolean(),
})

/** Turns a zod result into { field: translationKey } for the form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_')
    if (!errors[key]) errors[key] = issue.message
  }
  return errors
}
