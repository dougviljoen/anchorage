import { createClient } from '@supabase/supabase-js'
import { env, supabaseBrowserKey } from '../config/env'

let browserClient: ReturnType<typeof createClient> | undefined

export const hasSupabaseFunctions =
  Boolean(env.VITE_SUPABASE_URL) && Boolean(supabaseBrowserKey)

export function getSupabaseBrowserClient() {
  if (!hasSupabaseFunctions || !env.VITE_SUPABASE_URL || !supabaseBrowserKey) {
    return undefined
  }

  browserClient ??= createClient(env.VITE_SUPABASE_URL, supabaseBrowserKey, {
    auth: {
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  })

  return browserClient
}
