# Database backup and restore

Supabase Free projects do not include managed backups. AgentRadar's release
backup command creates a local logical snapshot under `.release-backups/`. The
directory is ignored by Git and must remain private because it can contain raw
ingestion data and subscriber addresses.

Before a release migration, disable Vercel cron and other database writers, then
run:

```bash
npm run backup:release -- --label YYYYMMDD-before-v1
```

The command requires `SUPABASE_SECRET_KEY` (or the legacy server-only
`SUPABASE_SERVICE_ROLE_KEY`) and `SUPABASE_URL` (with
`NEXT_PUBLIC_SUPABASE_URL` accepted because the project URL is not a secret).
It never reads a browser publishable key. Output directories are created with
mode `0700`, files with mode `0600`, and an existing snapshot is never
overwritten. Reads are ordered and paginated; `--page-size` accepts 1-1000 and
defaults to 500. High-confidence credential shapes are recursively redacted
from every exported JSON value. Broader heuristics are additionally applied to
`items.error_message` and `pipeline_runs.error`; benign `sk-*` URL slugs and
ordinary "bearer" prose elsewhere are preserved.

Treat snapshots made by older ad-hoc procedures as untrusted until their full
decompressed contents have passed a credential scan.

## Verify the snapshot

1. Keep the directory mode at `0700` and each file at `0600`.
2. From inside the snapshot directory, verify the manifest checksum with
   `shasum -a 256 -c manifest.sha256`.
3. For every `*.ndjson.gz` file, compare its compressed byte size and SHA-256
   with `manifest.json`. Decompress it and confirm every line parses as JSON,
   its line count matches `rows`, and its decoded byte count matches
   `uncompressedBytes`.
4. Review each file's `redactedFields` count. It counts string fields redacted
   at any nesting depth. A nonzero count is expected when historical content
   contained credentials; the original secret is not recoverable from this
   logical snapshot.

## Restore procedure

1. Keep Vercel cron jobs disabled and do not trigger manual refreshes.
2. Create a disposable, fresh Supabase project or empty recovery database.
3. Apply the committed files in `supabase/migrations/` in lexical order to
   recreate the schema. For an existing target, inventory it first and apply
   only missing changes.
4. Decode each gzip file as NDJSON and upsert rows in bounded batches with a
   server-only Supabase secret key. Never use the browser publishable key for
   restoration. Load in this order and use the stated conflict target:

   - `rss_feeds`: `.upsert(rows, { onConflict: 'url' })`. Migration `001`
     seeds the same URLs with fresh UUIDs, so a default primary-key upsert is
     unsafe. Keep the archived `id` values in each row; conflict resolution on
     the unique URL updates the seeded row to the archived identity.
   - `items`: `.upsert(rows, { onConflict: 'id' })`.
   - `digests`: `.upsert(rows, { onConflict: 'id' })`.
   - `digest_items`:
     `.upsert(rows, { onConflict: 'digest_id,item_id' })`.
   - `digest_summaries`: `.upsert(rows, { onConflict: 'id' })`.
   - `pipeline_runs`: `.upsert(rows, { onConflict: 'id' })`.
   - `subscribers`: `.upsert(rows, { onConflict: 'id' })`; handle this file as
     personal data and restore it only when the target has equivalent controls.

   Do not restore `pipeline_locks`. They are transient leases and must start
   empty in the recovery database.
5. Compare restored row counts with `manifest.json`, verify primary/foreign-key
   constraints, then run the RLS and Data API negative probes in the release
   checklist.
6. Point a staging deployment at the recovered project and run read-only smoke
   tests before changing production environment variables or re-enabling cron.

This logical snapshot protects application data and relies on the versioned SQL
migrations for schema reconstruction. For future releases, upgrade to a plan
with managed backups or take a `supabase db dump`/`pg_dump` snapshot and test a
full restore into an isolated project.
