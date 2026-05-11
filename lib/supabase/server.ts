import { createClient } from '@supabase/supabase-js'

// Service role client — server-only. Never import this from client components.
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase server env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}
