import { randomUUID } from 'node:crypto'
import { createServerClient } from '@/lib/supabase/server'

export interface PipelineLease {
  name: string
  ownerToken: string
}

export async function acquirePipelineLease(
  name: string,
  ttlMs = 10 * 60 * 1_000,
): Promise<PipelineLease | null> {
  const supabase = createServerClient()
  const now = new Date()
  const ownerToken = randomUUID()

  const { error: cleanupError } = await supabase
    .from('pipeline_locks')
    .delete()
    .eq('name', name)
    .lt('expires_at', now.toISOString())
  if (cleanupError) throw new Error(`Pipeline lease cleanup failed: ${cleanupError.message}`)

  const { error } = await supabase.from('pipeline_locks').insert({
    name,
    owner_token: ownerToken,
    acquired_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttlMs).toISOString(),
  })

  if (error?.code === '23505') return null
  if (error) throw new Error(`Pipeline lease acquisition failed: ${error.message}`)
  return { name, ownerToken }
}

export async function releasePipelineLease(lease: PipelineLease): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('pipeline_locks')
    .delete()
    .eq('name', lease.name)
    .eq('owner_token', lease.ownerToken)
  if (error) throw new Error(`Pipeline lease release failed: ${error.message}`)
}
