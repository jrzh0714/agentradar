# AgentRadar v1.0 release checklist

Treat the current local worktree as a `v1.0.0` release candidate, not an official
release. Do not announce v1, tag the repository, or create a GitHub Release until
every applicable launch gate and production smoke test below is complete.

## Credential and repository gates

- [ ] Revoke the GitHub token that was embedded in the local Git remote URL, then verify that the old credential can no longer authenticate. Do not print the token while testing.
- [ ] Create a separate, expiring, least-privilege token for public GitHub ingestion. Verify its effective permissions and keep repository administration, deployment, and ingestion credentials separate.
- [ ] Scan the current tree **and the complete Git history**, including every local branch and tag. Review GitHub secret-scanning alerts and rotate every confirmed credential; deleting a secret from the latest commit is not sufficient.

```bash
# Current tracked and untracked files, using the repository rules.
gitleaks dir --redact --no-banner --config .gitleaks.toml .

# Full reachable history across local branches and tags.
gitleaks git --redact --no-banner --config .gitleaks.toml .
git log --all --full-history --oneline
```

- [ ] Enable GitHub Dependabot and secret scanning, require the `CI / verify` job on `main`, and protect release tags.

## Database gates

- [ ] Back up each existing database and record a tested restore procedure before applying SQL.
- [ ] For a **fresh, empty database**, apply every SQL file in `supabase/migrations/` in lexical order.
- [ ] For an **existing database**, inventory the live schema and migration records, reconcile the legacy migration filenames with changes already present, and apply only the missing changes in staging before production. Do not blindly rerun every migration or use `supabase db push` until history is reconciled.
- [ ] Confirm `pipeline_runs`, `subscribers`, and `pipeline_locks` have RLS enabled and that `anon` and `authenticated` cannot select server-only data.
- [ ] Confirm `anon` cannot directly select `items.raw_data`, `items.raw_content`, or `items.error_message` through the Data API.
- [ ] Exercise write-denial policies only in a disposable staging project or inside a transaction that is guaranteed to roll back. In production, use read-only negative probes plus catalog/policy inspection unless a non-persisting transaction is proven; never leave test subscribers, locks, or pipeline runs behind.

## Configuration and product gates

- [ ] Configure production from `.env.example`, including `SITE_URL`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, and `MAX_DAILY_AI_COST_USD`.
- [ ] Keep `WAITLIST_ENABLED=false` (or unset) so the form stays hidden and the API fails closed until a reviewed privacy notice, private contact, retention/deletion procedure, abuse controls, double opt-in, and unsubscribe handling exist.
- [ ] Decide the canonical production domain, set `SITE_URL` to it, and verify canonical, sitemap, RSS, and social URLs.
- [ ] In OpenAI Platform data controls, confirm the **exact production API project** is currently enrolled in input/output sharing and eligible for complimentary tokens. A successful model metadata request does not prove enrollment or credit availability.
- [ ] Confirm the API organization has a positive balance, the configured model is still in an eligible tier, and billing/spend limits are acceptable for overages. Treat complimentary tokens as an optimization, not a release dependency or budget guarantee.

## Local candidate verification

The following commands are safe to run locally without external writes. Passing
them establishes a local candidate only; it does not satisfy deployment,
credential, database, or billing gates.

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev --audit-level=high
git diff --check
```

## Staging verification

- [ ] Run one staging refresh with `AI_PROVIDER=mock` and confirm a concurrent request returns `409`.
- [ ] Run `npm run estimate` with the real model and compare the estimate with current provider pricing and the configured daily budget.
- [ ] Run one deliberately small shared-traffic refresh, then verify ingestion, enrichment, translation, ranking, run logging, and actual usage/cost in the OpenAI dashboard.
- [ ] Run `npm run enrich -- --dry-run --eval --limit 3` and compare category, relevance, and summary quality with the previous model. A real-model dry run can consume API tokens even though it does not write to the database.
- [ ] Verify `/api/health` returns `200` when healthy and `503` when a dependency check fails.
- [ ] Verify refresh and estimate endpoints return `401` without `CRON_SECRET`.
- [ ] With the waitlist disabled, verify `/digest` has no email form and `/api/subscribe` returns `503` without creating a subscriber row. If collection is enabled later, test only with a disposable address and delete it immediately.
- [ ] Test homepage, search filters, item detail, digest, RSS, status, language, theme, reduced motion, keyboard navigation, and a mobile viewport.
- [ ] Confirm no server key, AI key, GitHub token, cron secret, raw ingestion payload, subscriber address, or internal error appears in browser responses.

## Production rollout

- [ ] Apply only the production database changes identified by the reconciliation step, then repeat read-only RLS negative probes and policy inspection.
- [ ] Deploy with a conservative `DAILY_ENRICH_LIMIT` and `MAX_DAILY_AI_COST_USD`.
- [ ] Confirm both Vercel cron schedules and run a manual authenticated smoke test.
- [ ] Watch function logs, `/status`, API spend, and database growth for 24 hours.
- [ ] Keep an empty `[Unreleased]` section in `CHANGELOG.md`; put shipped changes under `## [1.0.0] - 2026-09-09` before tagging.
- [ ] Commit and push the verified candidate, create and push an annotated `v1.0.0` tag, then create the GitHub Release from that exact commit.

```bash
git tag -a v1.0.0 -m "AgentRadar v1.0.0"
git push origin main v1.0.0
```

Do not run the tag commands until the launch gates and production smoke tests pass.
