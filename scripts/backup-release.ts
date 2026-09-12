/**
 * Export all AgentRadar release tables to a private, local logical snapshot.
 *
 * Usage:
 *   npm run backup:release
 *   npm run backup:release -- --label 20260911-before-v1 --page-size 500
 *
 * The output is always .release-backups/<label>. Existing directories are
 * never overwritten. Disable writers (including Vercel cron) before running.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertServerOnlySupabaseKey,
  defaultBackupLabel,
  parseBackupPageSize,
  type BackupRow,
  type ReleaseBackupTable,
  validateBackupLabel,
  writeReleaseBackup,
} from '@/lib/backup/release-backup'

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return value
}

async function main() {
  const label = validateBackupLabel(argumentValue('--label') ?? defaultBackupLabel())
  const pageSize = parseBackupPageSize(argumentValue('--page-size'))
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing server credentials: set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY',
    )
  }
  assertServerOnlySupabaseKey(key)

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const fetchPage = async (table: ReleaseBackupTable, from: number, to: number) => {
    let query = supabase.from(table.name).select('*')
    for (const column of table.order) query = query.order(column, { ascending: true })
    const { data, error } = await query.range(from, to)
    if (error) throw new Error(`Failed to export ${table.name}: ${error.message}`)
    return (data ?? []) as BackupRow[]
  }

  const result = await writeReleaseBackup({
    workspaceRoot: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
    label,
    pageSize,
    fetchPage,
  })

  console.log(`Release backup written to ${result.directory}`)
  for (const [filename, file] of Object.entries(result.manifest.files)) {
    console.log(
      `  ${filename}: ${file.rows} rows, ${file.compressedBytes} bytes, ${file.redactedFields} redacted field(s)`,
    )
  }
  console.log(`  manifest.json sha256: ${result.manifestSha256}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
