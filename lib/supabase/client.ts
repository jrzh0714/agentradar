'use client'

import { createClient } from '@supabase/supabase-js'

// Anon key client — safe to use in browser. Read-only access only.
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase client env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createClient(url, key)
}
