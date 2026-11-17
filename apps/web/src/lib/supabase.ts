import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Only the public "anon" key belongs in the app. The service-role key must never appear here:
// an APK or a web bundle can be unpacked by anyone.

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
    )
  }
  return client
}
