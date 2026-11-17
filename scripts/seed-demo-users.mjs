// DEV ONLY. Creates 2 distributors and one owner for each shop loaded by supabase/seed.sql,
// all with the same password from DEMO_PASSWORD. Never run this against production.
//
//   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  DEMO_PASSWORD=...  \
//   node scripts/seed-demo-users.mjs
import { adminClient, createUser, requireEnv } from './lib/admin-client.mjs'

const password = requireEnv('DEMO_PASSWORD')
const admin = adminClient()

const shops = await admin.from('shops').select('id, name_en, owner_name, phone').order('created_at')
if (shops.error) throw new Error(shops.error.message)
if (shops.data.length === 0) {
  console.error('No shops found. Load supabase/seed.sql first.')
  process.exit(1)
}

for (const [i, name] of ['Distributor One', 'Distributor Two'].entries()) {
  await createUser(admin, {
    phone: `920000000${i + 1}`,
    password,
    fullName: name,
    role: 'distributor',
  })
  console.log(`Created ${name} (920000000${i + 1})`)
}

for (const shop of shops.data) {
  await createUser(admin, {
    phone: shop.phone,
    password,
    fullName: shop.owner_name || shop.name_en,
    role: 'shop',
    shopId: shop.id,
  })
  console.log(`Created owner of ${shop.name_en} (${shop.phone})`)
}
