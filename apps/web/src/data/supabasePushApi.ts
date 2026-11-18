import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from './adminApi'
import type { PushApi } from './pushApi'
import { billingError } from './supabaseAdminApi'

// Real version of the push API. A device's token is saved through database functions, so a shared
// phone moves to whoever signs in on it, and nobody can remove someone else's device.
//
// Status: written in Stage 8, NOT yet run against a live Supabase project.

export function createSupabasePushApi(client: SupabaseClient): PushApi {
  return {
    async registerToken(platform, token) {
      const { error } = await client.rpc('register_push_token', {
        p_platform: platform,
        p_token: token,
      })
      if (error) {
        throw error.message?.includes('invalid') ? new ApiError('invalid') : billingError(error)
      }
    },

    async forgetToken(token) {
      const { error } = await client.rpc('forget_push_token', { p_token: token })
      if (error) throw billingError(error)
    },
  }
}
