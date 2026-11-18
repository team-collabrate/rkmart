/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** "1" includes the Stage 0 spike pages in a production build. Leave unset for real releases. */
  readonly VITE_SPIKES?: string
  /** "1" allows the demo login in a production build. Never set this for a real release. */
  readonly VITE_MOCK_AUTH?: string
  /** Public VAPID key for browser alerts (Web Push). */
  readonly VITE_VAPID_PUBLIC_KEY?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
