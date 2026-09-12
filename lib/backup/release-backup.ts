import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { chmod, lstat, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

export const RELEASE_BACKUP_TABLES = [
  { name: 'rss_feeds', order: ['id'] },
  { name: 'items', order: ['id'] },
  { name: 'digests', order: ['id'] },
  { name: 'digest_items', order: ['digest_id', 'item_id'] },
  { name: 'digest_summaries', order: ['id'] },
  { name: 'pipeline_runs', order: ['id'] },
  { name: 'subscribers', order: ['id'] },
  { name: 'pipeline_locks', order: ['name'] },
] as const

export type ReleaseBackupTable = (typeof RELEASE_BACKUP_TABLES)[number]
export type BackupRow = Record<string, unknown>

export interface BackupFileManifest {
  rows: number
  compressedBytes: number
  uncompressedBytes: number
  sha256: string
  redactedFields: number
}

export interface ReleaseBackupManifest {
  schemaVersion: 1
  createdAt: string
  format: 'gzip-ndjson'
  pageSize: number
  files: Record<string, BackupFileManifest>
}

export type FetchBackupPage = (
  table: ReleaseBackupTable,
  from: number,
  to: number,
) => Promise<BackupRow[]>

const MIN_PAGE_SIZE = 1
const MAX_PAGE_SIZE = 1_000
const SAFE_LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/

// Exact provider prefixes and JWT structure are strong enough to redact from
// every nested exported value without treating ordinary prose as a secret.
const HIGH_CONFIDENCE_CREDENTIAL_PATTERNS: RegExp[] = [
  /sk-proj-[A-Za-z0-9_-]{32,}\b/g,
  /sk-ant-api\d{2}-[A-Za-z0-9_-]{32,}\b/g,
  /\b(?:github_pat_|gh[opusr]_)[A-Za-z0-9_]{16,}\b/g,
  /\bsb_(?:secret|publishable)_[A-Za-z0-9._-]{10,}\b/g,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g,
]

// Error fields are expected to contain provider diagnostics, so broader
// heuristics are appropriate there. Applying these globally would corrupt
// legitimate URLs such as /sk-agent-guide and natural "bearer" prose.
const ERROR_FIELD_CREDENTIAL_PATTERNS: RegExp[] = [
  /sk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}\b/g,
  /\bBearer\s+[^\s,;]+/gi,
  /\b(?:api[_-]?key|access[_-]?token|auth(?:orization)?|secret)\s*[:=]\s*['"]?[^\s,'";]+/gi,
  /https?:\/\/[^\s/@:]+:[^\s/@]+@/gi,
]

export function parseBackupPageSize(value: string | undefined): number {
  if (value === undefined) return 500
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < MIN_PAGE_SIZE || parsed > MAX_PAGE_SIZE) {
    throw new Error(`--page-size must be an integer from ${MIN_PAGE_SIZE} to ${MAX_PAGE_SIZE}`)
  }
  return parsed
}

export function validateBackupLabel(label: string): string {
  if (!SAFE_LABEL.test(label) || label === '.' || label === '..') {
    throw new Error(
      'Backup label must be 1-80 characters and contain only letters, numbers, dots, underscores, or hyphens',
    )
  }
  return label
}

export function assertServerOnlySupabaseKey(key: string): void {
  if (key.startsWith('sb_secret_')) return

  if (key.startsWith('sb_publishable_')) {
    throw new Error('A publishable Supabase key cannot be used for backups')
  }

  if (key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')) as {
        role?: unknown
      }
      if (payload.role !== 'service_role') throw new Error('wrong role')
    } catch {
      throw new Error('A legacy Supabase JWT must have the service_role role for backups')
    }

    return
  }

  throw new Error('Backup credentials must be an sb_secret key or a legacy service_role JWT')
}

function redactWithPatterns(value: string, patterns: RegExp[]): {
  value: string
  redacted: boolean
} {
  let redacted = false
  let result = value

  for (const pattern of patterns) {
    result = result.replace(pattern, () => {
      redacted = true
      return '[REDACTED]'
    })
  }

  return { value: result, redacted }
}

export function redactCredentialLikeMaterial(value: string): {
  value: string
  redacted: boolean
} {
  const highConfidence = redactWithPatterns(value, HIGH_CONFIDENCE_CREDENTIAL_PATTERNS)
  const errorHeuristics = redactWithPatterns(
    highConfidence.value,
    ERROR_FIELD_CREDENTIAL_PATTERNS,
  )
  return {
    value: errorHeuristics.value,
    redacted: highConfidence.redacted || errorHeuristics.redacted,
  }
}

function sanitizeNestedValue(
  value: unknown,
  includeErrorHeuristics: boolean,
): { value: unknown; redactedFields: number } {
  if (typeof value === 'string') {
    const highConfidence = redactWithPatterns(value, HIGH_CONFIDENCE_CREDENTIAL_PATTERNS)
    const result = includeErrorHeuristics
      ? redactWithPatterns(highConfidence.value, ERROR_FIELD_CREDENTIAL_PATTERNS)
      : { value: highConfidence.value, redacted: false }
    return {
      value: result.value,
      redactedFields: highConfidence.redacted || result.redacted ? 1 : 0,
    }
  }

  if (Array.isArray(value)) {
    let redactedFields = 0
    const sanitized = value.map((entry) => {
      const result = sanitizeNestedValue(entry, includeErrorHeuristics)
      redactedFields += result.redactedFields
      return result.value
    })
    return { value: sanitized, redactedFields }
  }

  if (value !== null && typeof value === 'object') {
    let redactedFields = 0
    const sanitized: BackupRow = {}
    for (const [key, entry] of Object.entries(value)) {
      const result = sanitizeNestedValue(entry, includeErrorHeuristics)
      sanitized[key] = result.value
      redactedFields += result.redactedFields
    }
    return { value: sanitized, redactedFields }
  }

  return { value, redactedFields: 0 }
}

export function sanitizeBackupRow(
  tableName: string,
  row: BackupRow,
): { row: BackupRow; redactedFields: number } {
  const errorFields =
    tableName === 'items' ? ['error_message'] : tableName === 'pipeline_runs' ? ['error'] : []
  const designatedErrorFields = new Set(errorFields)
  const sanitized: BackupRow = {}
  let redactedFields = 0

  for (const [field, value] of Object.entries(row)) {
    const result = sanitizeNestedValue(value, designatedErrorFields.has(field))
    sanitized[field] = result.value
    redactedFields += result.redactedFields
  }

  return { row: sanitized, redactedFields }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function ensurePrivateBackupRoot(root: string): Promise<void> {
  if (await pathExists(root)) {
    const info = await lstat(root)
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`Backup root is not a regular directory: ${root}`)
    }
    await chmod(root, 0o700)
    return
  }

  await mkdir(root, { mode: 0o700 })
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function exportTable(options: {
  table: ReleaseBackupTable
  directory: string
  pageSize: number
  fetchPage: FetchBackupPage
}): Promise<BackupFileManifest> {
  const { table, directory, pageSize, fetchPage } = options
  const filename = `${table.name}.ndjson.gz`
  const filePath = join(directory, filename)
  let rows = 0
  let uncompressedBytes = 0
  let redactedFields = 0

  async function* ndjsonLines() {
    for (let offset = 0; ; offset += pageSize) {
      const page = await fetchPage(table, offset, offset + pageSize - 1)
      if (page.length > pageSize) {
        throw new Error(`${table.name} returned more than the requested page size`)
      }

      for (const sourceRow of page) {
        const sanitized = sanitizeBackupRow(table.name, sourceRow)
        const line = `${JSON.stringify(sanitized.row)}\n`
        rows += 1
        redactedFields += sanitized.redactedFields
        uncompressedBytes += Buffer.byteLength(line)
        yield line
      }

      if (page.length < pageSize) break
    }
  }

  await pipeline(
    ndjsonLines(),
    createGzip({ level: 9 }),
    createWriteStream(filePath, { flags: 'wx', mode: 0o600 }),
  )
  await chmod(filePath, 0o600)

  const fileStats = await stat(filePath)
  return {
    rows,
    compressedBytes: fileStats.size,
    uncompressedBytes,
    sha256: await sha256File(filePath),
    redactedFields,
  }
}

export async function writeReleaseBackup(options: {
  workspaceRoot: string
  label: string
  pageSize: number
  fetchPage: FetchBackupPage
  createdAt?: Date
}): Promise<{ directory: string; manifest: ReleaseBackupManifest; manifestSha256: string }> {
  const label = validateBackupLabel(options.label)
  const pageSize = parseBackupPageSize(String(options.pageSize))
  const workspaceRoot = resolve(options.workspaceRoot)
  const backupRoot = join(workspaceRoot, '.release-backups')
  const directory = join(backupRoot, label)

  await ensurePrivateBackupRoot(backupRoot)
  if (await pathExists(directory)) {
    throw new Error(`Refusing to overwrite existing backup: ${directory}`)
  }

  // mkdir without recursive:true is the overwrite/race guard. Once reserved,
  // a failed run remains visibly incomplete and must be inspected manually.
  await mkdir(directory, { mode: 0o700 })
  await chmod(directory, 0o700)

  const manifest: ReleaseBackupManifest = {
    schemaVersion: 1,
    createdAt: (options.createdAt ?? new Date()).toISOString(),
    format: 'gzip-ndjson',
    pageSize,
    files: {},
  }

  for (const table of RELEASE_BACKUP_TABLES) {
    manifest.files[`${table.name}.ndjson.gz`] = await exportTable({
      table,
      directory,
      pageSize,
      fetchPage: options.fetchPage,
    })
  }

  const manifestPath = join(directory, 'manifest.json')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  })
  await chmod(manifestPath, 0o600)

  const manifestSha256 = await sha256File(manifestPath)
  const checksumPath = join(directory, 'manifest.sha256')
  await writeFile(checksumPath, `${manifestSha256}  manifest.json\n`, {
    flag: 'wx',
    mode: 0o600,
  })
  await chmod(checksumPath, 0o600)

  // Re-read the manifest so an unexpected partial write cannot be reported as
  // a successful snapshot.
  JSON.parse(await readFile(manifestPath, 'utf8'))

  return { directory, manifest, manifestSha256 }
}

export function defaultBackupLabel(now = new Date()): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}
