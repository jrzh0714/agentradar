import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { describe, it } from 'node:test'
import { createGunzip } from 'node:zlib'
import {
  assertServerOnlySupabaseKey,
  parseBackupPageSize,
  redactCredentialLikeMaterial,
  RELEASE_BACKUP_TABLES,
  sanitizeBackupRow,
  validateBackupLabel,
  writeReleaseBackup,
} from './release-backup'

async function gunzipText(path: string): Promise<string> {
  const chunks: Buffer[] = []
  await pipeline(
    createReadStream(path),
    createGunzip(),
    new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk))
        callback()
      },
    }),
  )
  return Buffer.concat(chunks).toString('utf8')
}

function fakeOpenAiToken(): string {
  return ['sk', 'proj', 'Ab3_'.repeat(12)].join('-')
}

describe('release backup', () => {
  it('uses broad credential heuristics only for designated error fields', () => {
    const token = fakeOpenAiToken()
    const direct = redactCredentialLikeMaterial(
      `provider failure: Bearer example.token ${token}`,
    )
    assert.equal(direct.redacted, true)
    assert.doesNotMatch(direct.value, /example\.token|sk-proj/)

    const item = sanitizeBackupRow('items', {
      id: '1',
      error_message: `provider failure: ${token}`,
      description: 'https://example.com/sk-agent-framework-release-notes',
    })
    assert.equal(item.redactedFields, 1)
    assert.equal(item.row.error_message, 'provider failure: [REDACTED]')
    assert.match(String(item.row.description), /sk-agent-framework-release-notes/)

    const prefixed = redactCredentialLikeMaterial(
      `provider rejected xx${token}`,
    )
    assert.doesNotMatch(prefixed.value, /sk-proj/)
  })

  it('validates labels and bounded page sizes', () => {
    assert.equal(validateBackupLabel('20260911-before-v1'), '20260911-before-v1')
    assert.throws(() => validateBackupLabel('../outside'), /Backup label/)
    assert.equal(parseBackupPageSize(undefined), 500)
    assert.equal(parseBackupPageSize('1000'), 1_000)
    assert.throws(() => parseBackupPageSize('1001'), /page-size/)

    assert.doesNotThrow(() => assertServerOnlySupabaseKey('sb_secret_example'))
    assert.throws(
      () => assertServerOnlySupabaseKey('sb_publishable_example'),
      /publishable Supabase key/,
    )
    assert.throws(
      () => assertServerOnlySupabaseKey('unrecognized-secret-format'),
      /must be an sb_secret key or a legacy service_role JWT/,
    )
    const anonPayload = Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')
    assert.throws(
      () => assertServerOnlySupabaseKey(`eyJ.${anonPayload}.signature`),
      /service_role role/,
    )
  })

  it('writes private, paginated gzip files with verified manifest metadata', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'agentradar-backup-test-'))
    const sourceRows = Object.fromEntries(
      RELEASE_BACKUP_TABLES.map(({ name }) => [name, [] as Record<string, unknown>[]]),
    ) as Record<string, Record<string, unknown>[]>
    const nestedJwt = `eyJ${'A'.repeat(42)}.${'B'.repeat(180)}.${'C'.repeat(50)}`
    assert.equal(nestedJwt.length, 277)
    sourceRows.items = [
      {
        id: '1',
        error_message: `provider rejected ${fakeOpenAiToken()}`,
        raw_data: {
          story_text: nestedJwt,
          _highlightResult: { story_text: { value: `token=${nestedJwt}` } },
          url: 'https://example.com/sk-agent-framework-release-notes',
          prose: 'The bearer of good news documented the release.',
        },
      },
      { id: '2', error_message: null },
      { id: '3', error_message: 'ordinary validation failure' },
    ]
    const requests: Array<{ table: string; from: number; to: number }> = []

    const result = await writeReleaseBackup({
      workspaceRoot,
      label: 'snapshot',
      pageSize: 2,
      createdAt: new Date('2026-09-11T00:00:00.000Z'),
      fetchPage: async (table, from, to) => {
        requests.push({ table: table.name, from, to })
        return sourceRows[table.name].slice(from, to + 1)
      },
    })

    assert.equal((await stat(join(workspaceRoot, '.release-backups'))).mode & 0o777, 0o700)
    assert.equal((await stat(result.directory)).mode & 0o777, 0o700)
    assert.equal((await stat(join(result.directory, 'items.ndjson.gz'))).mode & 0o777, 0o600)
    assert.deepEqual(
      requests.filter(({ table }) => table === 'items'),
      [
        { table: 'items', from: 0, to: 1 },
        { table: 'items', from: 2, to: 3 },
      ],
    )

    const itemText = await gunzipText(join(result.directory, 'items.ndjson.gz'))
    assert.doesNotMatch(itemText, /sk-proj/)
    assert.doesNotMatch(itemText, /eyJAAAA/)
    assert.match(itemText, /ordinary validation failure/)
    assert.match(itemText, /sk-agent-framework-release-notes/)
    assert.match(itemText, /bearer of good news/)
    assert.equal(itemText.trim().split('\n').length, 3)

    const file = result.manifest.files['items.ndjson.gz']
    assert.equal(file.rows, 3)
    assert.equal(file.redactedFields, 3)
    assert.equal(file.uncompressedBytes, Buffer.byteLength(itemText))
    const compressed = await readFile(join(result.directory, 'items.ndjson.gz'))
    assert.equal(file.compressedBytes, compressed.byteLength)
    assert.equal(file.sha256, createHash('sha256').update(compressed).digest('hex'))

    await assert.rejects(
      writeReleaseBackup({
        workspaceRoot,
        label: 'snapshot',
        pageSize: 2,
        fetchPage: async () => [],
      }),
      /Refusing to overwrite/,
    )
  })
})
