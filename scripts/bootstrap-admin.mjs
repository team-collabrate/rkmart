// Creates the FIRST admin login. After this, the admin creates every other login in the app.
//
//   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  \
//   ADMIN_PHONE=98xxxxxxxx  ADMIN_PASSWORD=...  ADMIN_NAME="RK Owner"  \
//   node scripts/bootstrap-admin.mjs
import { adminClient, createUser, requireEnv } from './lib/admin-client.mjs'

const admin = adminClient()

const existing = await admin.from('profiles').select('id').eq('role', 'admin').limit(1)
if (existing.error) throw new Error(existing.error.message)
if (existing.data.length > 0) {
  console.error('An admin already exists. Create more logins from the app.')
  process.exit(1)
}

const id = await createUser(admin, {
  phone: requireEnv('ADMIN_PHONE'),
  password: requireEnv('ADMIN_PASSWORD'),
  fullName: process.env.ADMIN_NAME || 'Admin',
  role: 'admin',
  language: process.env.ADMIN_LANGUAGE === 'ta' ? 'ta' : 'en',
})
console.log(`Admin created (id ${id}). Sign in with the phone number and password.`)
