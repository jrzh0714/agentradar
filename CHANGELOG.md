# Changelog

Notable changes are documented here using
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semantic versioning.

## [Unreleased]

## [1.0.0] - 2026-09-09

### Added

- CI checks for linting, types, unit tests, production builds, and production dependency audits.
- Daily AI cost preflight and a durable pipeline lease to prevent overlapping paid runs.
- Security headers, metadata, sitemap, robots rules, manifest, and route error boundaries.
- Restricted URL validation, request-size limits, signup throttling, and accessibility improvements.
- Partial feed indexes plus trigram/GIN search indexes for corpus growth.
- Exact search totals with an explicit first-page indicator.

### Changed

- Default AI provider is OpenAI with the eligible high-volume `gpt-5.4-nano-2026-03-17` snapshot; Anthropic and deterministic mock modes remain supported.
- Server-only database access prefers Supabase secret keys and removes direct Data API access for public roles.
- Public status and health endpoints no longer expose raw pipeline errors or trigger alert spam.
- Product version is now `1.0.0`; digest signup language accurately describes the current waitlist.

### Security

- Added RLS and privilege hardening for operational tables and prevented public access to raw ingestion payloads.
- Removed a credential from the local Git remote URL. The exposed credential must still be revoked by its owner.
