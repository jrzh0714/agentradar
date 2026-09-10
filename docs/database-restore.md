# Database backup and restore

Supabase Free projects do not include managed backups. Before the v1 production
migration, AgentRadar created a local logical snapshot at
`.release-backups/20260909/`. The directory is ignored by Git and must remain
private. It contains gzip-compressed NDJSON for every table touched by the
release migration plus a row-count manifest.

## Verify the snapshot

1. Keep the directory mode at `0700` and each file at `0600`.
2. Compare `manifest.json` with the recorded SHA-256:
   `46ec896b3ec1f5f3c1f4e83b1e790b98942559ffb4dd68b8424e8bc4ef07e513`.
3. Decompress each `*.ndjson.gz` file and confirm every line parses as JSON and
   the line count matches the manifest before relying on the snapshot.

The v1 snapshot contains 6,498 `items`, 120 `pipeline_runs`, 6 `rss_feeds`, and
zero rows in `digests`, `digest_items`, and `digest_summaries`. The
`subscribers` and `pipeline_locks` tables did not exist before the migration.

## Restore procedure

1. Disable Vercel cron jobs and do not trigger manual refreshes.
2. Create a fresh Supabase project or empty recovery database.
3. Apply the committed files in `supabase/migrations/` in lexical order to
   recreate the schema. For an existing target, inventory it first and apply
   only missing changes.
4. Load tables in dependency order: `rss_feeds`, `items`, `digests`,
   `digest_items`, `digest_summaries`, then `pipeline_runs`. Decode each gzip
   file as NDJSON and upsert rows in batches with a server-only Supabase secret
   key. Never use the browser publishable key for restoration.
5. Compare restored row counts with `manifest.json`, verify primary/foreign-key
   constraints, then run the RLS and Data API negative probes in the release
   checklist.
6. Point a staging deployment at the recovered project and run read-only smoke
   tests before changing production environment variables or re-enabling cron.

This logical snapshot protects application data and relies on the versioned SQL
migrations for schema reconstruction. For future releases, upgrade to a plan
with managed backups or take a `supabase db dump`/`pg_dump` snapshot and test a
full restore into an isolated project.
