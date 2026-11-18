// Demo data. Mirrors supabase/seed.sql. HSN codes and GST rates are SAMPLES, not tax advice.
import type { AppUser, CompanySettings, Product, RateMap, Shop } from './types'

const p = (
  n: number,
  nameEn: string,
  nameTa: string,
  category: string,
  unit: string,
  hsnCode: string,
  gstRate: number,
): Product => ({
  id: `p${n}`,
  nameEn,
  nameTa,
  category,
  unit,
  hsnCode,
  gstRate,
  sortOrder: n * 10,
  isActive: true,
})

export const sampleProducts = (): Product[] => [
  p(1, 'Ponni rice', 'பொன்னி அரிசி', 'Rice and flour', 'bag', '1006', 5),
  p(2, 'Idli rice', 'இட்லி அரிசி', 'Rice and flour', 'bag', '1006', 5),
  p(3, 'Rava', 'ரவை', 'Rice and flour', 'kg', '1103', 5),
  p(4, 'Wheat flour', 'கோதுமை மாவு', 'Rice and flour', 'kg', '1101', 0),
  p(5, 'Toor dal', 'துவரம் பருப்பு', 'Pulses', 'kg', '0713', 0),
  p(6, 'Urad dal', 'உளுந்தம் பருப்பு', 'Pulses', 'kg', '0713', 0),
  p(7, 'Sugar', 'சர்க்கரை', 'Staples', 'kg', '1701', 5),
  p(8, 'Salt', 'உப்பு', 'Staples', 'kg', '2501', 0),
  p(9, 'Tea powder', 'டீ தூள்', 'Staples', 'kg', '0902', 5),
  p(10, 'Sunflower oil', 'சூரியகாந்தி எண்ணெய்', 'Oil', 'can', '1512', 5),
  p(11, 'Groundnut oil', 'கடலை எண்ணெய்', 'Oil', 'can', '1508', 5),
  p(12, 'Tamarind', 'புளி', 'Spices', 'kg', '0813', 0),
  p(13, 'Red chilli', 'மிளகாய் வற்றல்', 'Spices', 'kg', '0904', 0),
  p(14, 'Coriander seeds', 'மல்லி', 'Spices', 'kg', '0909', 0),
  p(15, 'Turmeric powder', 'மஞ்சள் தூள்', 'Spices', 'kg', '0910', 0),
]

/** Yesterday's rates, so "same as yesterday" has something to copy in the demo. */
export const SAMPLE_PREVIOUS_RATES: RateMap = {
  p1: 1330,
  p2: 1280,
  p3: 58,
  p4: 44,
  p5: 140,
  p6: 120,
  p7: 46,
  p8: 22,
  p9: 380,
  p10: 790,
  p11: 1850,
  p12: 210,
  p13: 260,
  p14: 130,
  p15: 190,
}

const s = (
  n: number,
  nameEn: string,
  nameTa: string,
  ownerName: string,
  address: string,
): Shop => ({
  id: `s${n}`,
  nameEn,
  nameTa,
  ownerName,
  phone: `910000000${n}`,
  address,
  stateCode: '33',
  gstin: '',
  isActive: true,
})

export const sampleShops = (): Shop[] => [
  s(1, 'Sri Murugan Cafe', '', 'Murugan', 'Town Hall'),
  s(2, 'Lakshmi Stores', '', 'Lakshmi', 'Gandhi Road'),
  s(3, 'Annam Hotel', '', 'Annam', 'Market Street'),
  s(4, 'Kavi Tiffin Centre', '', 'Kavi', 'Bus Stand'),
  s(5, 'Green Leaf', '', 'Gopal', 'Station Road'),
]

export const SAMPLE_USERS: AppUser[] = [
  {
    id: 'demo-admin',
    role: 'admin',
    fullName: 'RK Owner (demo)',
    phone: '9000000001',
    language: 'en',
    isActive: true,
    shopId: null,
    shopName: null,
  },
  {
    id: 'demo-dist',
    role: 'distributor',
    fullName: 'Distributor One (demo)',
    phone: '9200000001',
    language: 'en',
    isActive: true,
    shopId: null,
    shopName: null,
  },
  {
    id: 'demo-shop',
    role: 'shop',
    fullName: 'Murugan (demo)',
    phone: '9100000001',
    language: 'en',
    isActive: true,
    shopId: 's1',
    shopName: 'Sri Murugan Cafe',
  },
]

export const SAMPLE_SETTINGS: CompanySettings = {
  companyName: 'RK Agency',
  tagline: 'Wholesale grocery distributor',
  address: 'Sample address, Tamil Nadu',
  phone: '9000000000',
  gstin: '',
  stateCode: '33',
  bankDetails: '',
  invoicePrefix: 'RK',
  ratesIncludeGst: false,
}
