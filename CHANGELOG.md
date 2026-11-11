# Changelog

Notable changes are documented here using
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semantic versioning.

## [Unreleased]

### Changed

- Refresh the interface with shared navigation, homepage search and topic shortcuts, readable card typography, and larger mobile controls in both color themes.
- Describe successful refresh batches without claiming the entire backlog is processed, and prevent standalone translation from overlapping scheduled refreshes.
- Recreate cached OpenAI clients after key rotation, classify rejected authentication, and redact masked credentials from diagnostics.
- Add a read-only `check:connections` command for database and model-access checks without completion tokens.
- Base public freshness on completed refresh runs and show delayed or unconfirmed states.
- Replace unsupported trending claims with recommendations and restrict rolling digest selections to seven days.
- Lead the homepage with three briefs; keep navigation and source actions accessible on mobile.
- Explain AI estimates, distinguish repository activity from publication, and support copying brief permalinks.
- Add search pagination, complete section collections, and separate load errors from zero matches.

## [1.0.0] - 2026-09-09

### Added

- CI checks for linting, types, unit tests, production builds, and production dependency audits.
- Daily AI cost preflight and a durable pipeline lease to prevent overlapping paid runs.
- Security headers, metadata, sitemap, robots rules, manifest, and route error boundaries.
- Restricted URL validation, request-size limits, signup throttling, and accessibility improvements.
- Partial feed indexes plus trigram/GIN search indexes for corpus growth.
- Exact search totals with an explicit first-page indicator.
- Private, paginated release backups with integrity manifests and recursive credential redaction.
- A generated social sharing image with route-specific Open Graph and Twitter metadata.

### Changed

- Default AI provider is OpenAI with the eligible high-volume `gpt-5.4-nano-2026-03-17` snapshot; Anthropic and deterministic mock modes remain supported.
- Server-only database access prefers Supabase secret keys and removes direct Data API access for public roles.
- Public status and health endpoints no longer expose raw pipeline errors or trigger alert spam.
- Product version is now `1.0.0`; digest signup language accurately describes the current waitlist.
- Item detail pages are included in the sitemap, and ranking pagination now uses a stable tie-break.
- Theme controls render consistently during hydration, with stronger dark-mode contrast and larger external-link targets.

### Security

- Added RLS and privilege hardening for operational tables and prevented public access to raw ingestion payloads.
- Removed a credential from the local Git remote URL. The exposed credential must still be revoked by its owner.
- Successful enrichment retries now clear stale provider error text.
