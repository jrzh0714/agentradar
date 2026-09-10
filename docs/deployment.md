# AgentRadar — Deployment Guide

This guide covers deploying AgentRadar to Vercel with a Supabase backend.

---

## Prerequisites

- [Vercel account](https://vercel.com) (free tier works)
- [Supabase account](https://supabase.com) (free tier works)
- GitHub repository with the AgentRadar codebase
- OpenAI or Anthropic API key
- GitHub personal access token (for ingestion)

---

## 1. Supabase setup

### Create a project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → New project
2. Choose a region close to your Vercel deployment region
3. Save the database password somewhere safe

### Run migrations

For a **new, empty project**, open the SQL editor (Database → SQL Editor) and
run every file in `supabase/migrations/` in lexical order.

For an **existing project**, first back up the database and inventory both its
schema and recorded migration history. Reconcile the legacy migration filenames
with what is already present, then apply only missing changes in staging before
production. Do not rerun every migration against an existing database, and do
not assume `supabase db push` will discover legacy files before reconciliation.

The final hardening migration revokes direct Data API access from public roles,
protects operational tables with RLS, and creates the pipeline lease table.

### Collect credentials

From Project Settings → API:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (e.g. `https://abcdef.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | Secret key — treat like a password; legacy projects may temporarily use `SUPABASE_SERVICE_ROLE_KEY` |

---

## 2. Vercel deployment

### Import the project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Framework preset: **Next.js** (auto-detected)
4. Leave build and output settings at defaults

### Add environment variables

In Vercel project settings → Environment Variables, add all of the following for the **Production** environment (and optionally Preview/Development):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
SITE_URL                  (canonical production origin)
AI_PROVIDER                (anthropic or openai)
ANTHROPIC_API_KEY          (if AI_PROVIDER=anthropic)
OPENAI_API_KEY             (if AI_PROVIDER=openai)
GITHUB_TOKEN               (required for scheduled GitHub ingestion and star refresh)
WAITLIST_ENABLED            (optional; defaults off—keep false until privacy and operations review)
CRON_SECRET                (required — protects /api/refresh/daily)
DAILY_ENRICH_LIMIT         (optional — max items enriched per cron run, default 30; hard cap 50)
MAX_DAILY_AI_COST_USD      (optional — defaults to 1.00; caps the conservative full-run AI estimate)
```

> **Note:** `GITHUB_TOKEN` is server-only. It is required in production because
> the daily refresh and weekly star refresh call GitHub from deployed routes.

### Waitlist safety gate

Email collection is disabled unless the server-only `WAITLIST_ENABLED` value is
exactly `true` (ignoring case and surrounding whitespace). With the variable
missing, empty, or false, `/digest` hides the form and `/api/subscribe` returns
`503` without reading or storing the request body. Leave it false until the
privacy notice, private contact, retention and deletion procedure, abuse
controls, double opt-in, and unsubscribe handling are reviewed. Redeploy after
changing the variable.

### Deploy

Click Deploy. Vercel builds and deploys the Next.js app. The first deploy will succeed but the app will show 0 items — the database is empty until you run the data pipeline.

---

## 3. Initial data load

Run these commands locally, pointing at the production Supabase instance via `.env.local`:

```bash
# Fetch items from all sources
npm run ingest:all

# Enrich with AI — start with a small batch to verify costs
npm run enrich -- --limit 20

# Once satisfied, intentionally raise the one-run budget for a larger batch.
# The CLI still hard-caps a single invocation at 500 items.
MAX_DAILY_AI_COST_USD=3 npm run enrich -- --limit 500

# Compute ranking scores
npm run rank
```

After this, the homepage should show enriched, ranked items.

Run the authenticated `/api/pipeline/estimate` endpoint before committing to a
batch, compare it with current provider pricing, and confirm complimentary-token
enrollment for the production API project.

### Complimentary OpenAI tokens

For an eligible OpenAI organization, enable sharing of API inputs and outputs
for the exact project whose key is stored in `OPENAI_API_KEY`. The pinned default
model, `gpt-5.4-nano-2026-03-17`, is in the high-volume complimentary-token
group. The benefit applies automatically only while the project is enrolled and
the API account has a positive balance.

The allowance is shared across eligible models and organization traffic, resets
at 00:00 UTC, and a request that crosses the remaining allowance is billed in
full. AgentRadar cannot observe traffic from other projects, so keep
`MAX_DAILY_AI_COST_USD` enabled and verify usage grouped by service tier in the
OpenAI Usage dashboard after the first run. Only public source content is sent
to the model; subscriber addresses are not part of AI prompts.

---

## 4. Automated daily refresh (Vercel Cron)

AgentRadar ships with a production-ready daily refresh pipeline that runs automatically on Vercel.

### How it works

`vercel.json` schedules `GET /api/refresh/daily` at **08:00 UTC every day**. The route:

1. Ingests from GitHub, HN, and RSS concurrently
2. Fixes blank / placeholder titles on newly ingested items (before enrichment)
3. Estimates all paid AI phases, including worst-case enrichment retries, and
   aborts if the total exceeds `MAX_DAILY_AI_COST_USD`
4. Enriches up to `DAILY_ENRICH_LIMIT` new items (default: 30; hard cap: 50) with the configured AI provider
5. Reclassifies, ranks, updates trends, translates, and generates digest summaries
6. Returns a JSON summary — viewable in Vercel Function logs

A database-backed lease rejects overlapping refreshes, including concurrent
manual and scheduled requests.

### Setup

**Step 1 — Generate a secret:**

```bash
openssl rand -hex 32
```

**Step 2 — Add to Vercel:**

In Vercel project settings → Environment Variables, add:

| Variable | Value | Environment |
|---|---|---|
| `CRON_SECRET` | `<generated secret>` | Production, Preview |
| `DAILY_ENRICH_LIMIT` | `30` (or lower) | Production |
| `MAX_DAILY_AI_COST_USD` | `1.00` (or lower) | Production |

Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` to every cron request, so the route rejects any unauthorized calls.

**Step 3 — Redeploy:**

Push or trigger a new deployment. The cron job activates automatically once `vercel.json` is deployed.

### Verify the cron is registered

In the Vercel dashboard → Project → Settings → Cron Jobs, you should see:

```
0 8 * * *   GET /api/refresh/daily
```

### Manual trigger

Useful for testing or forcing an immediate refresh:

```bash
# From any machine with curl
curl -X POST https://your-app.vercel.app/api/refresh/daily \
  -H "Authorization: Bearer $CRON_SECRET"

# Locally (reads CRON_SECRET from .env.local)
curl -X POST http://localhost:3000/api/refresh/daily \
  -H "Authorization: Bearer $(grep ^CRON_SECRET .env.local | cut -d= -f2)"
```

A successful response looks like:

```json
{
  "success": true,
  "ingestionCounts": { "github": 12, "hn": 4, "rss": 8 },
  "titleFixedCount": 3,
  "enrichedCount": 20,
  "failedCount": 1,
  "rankedCount": 842,
  "durationMs": 94200
}
```

> **Note:** The numbers above are illustrative. Actual counts depend on your corpus size, how many new items each source returns, and the value of `DAILY_ENRICH_LIMIT`.

### Cost estimate

Call `/api/pipeline/estimate` with the cron bearer token or use `npm run estimate`.
Unknown models fail closed until conservative enrichment, translation, and
summary rates are added to `MODEL_RATES`. The daily refresh includes the maximum
reclassification, translation, and digest-summary phases in its estimate and
fails closed when the total exceeds `MAX_DAILY_AI_COST_USD`.
Pricing changes over time; review the configured rate before changing models.

### Failure handling

| Failure type | Behaviour |
|---|---|
| One item fails validation | Marked `status='failed'`, retried on next run |
| Billing/quota error | Enrichment stops early; `success: false` in response; items not marked failed |
| Ingestion source unreachable | That source returns 0 items; other sources continue |
| Cost estimate above limit | No paid AI phase runs; raise the budget only after reviewing the estimate |
| Concurrent refresh | Returns `409`; wait for the active lease to expire or complete |
| Function timeout | Reduce `DAILY_ENRICH_LIMIT` and review function logs |

### Manual pipeline (no cron)

If you prefer to run the pipeline manually:

```bash
npm run ingest:all
npm run enrich -- --limit 100
npm run rank
```

---

## 5. Data quality maintenance

### After adding new GitHub queries

```bash
npm run ingest:github
npm run enrich -- --limit 50
npm run rank
```

### If titles appear blank or as "Untitled article"

```bash
# Preview what the script would fix
npm run cleanup:titles -- --dry-run

# Apply fixes
npm run cleanup:titles
```

The script resolves blank, null, or placeholder titles using URL slug derivation and description extraction — the same logic used at render time by `getDisplayTitle()`. HN items are skipped (their titles are handled display-only).

### If fork artifacts appear in rankings

```bash
# Preview what would be deleted
npm run cleanup:github -- --dry-run

# Apply
npm run cleanup:github

# Then re-ingest and re-rank
npm run ingest:github
npm run rank
```

### Adding a repo to the blocklist

1. Edit `GITHUB_INGESTION_BLOCKLIST` in `config/github-queries.ts`
2. Run `npm run cleanup:github` to remove the existing DB rows
3. The next `ingest:github` run will automatically skip the blocked repo

---

## 6. Vercel environment per context

| Variable | Production | Preview | Development |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ (use staging project) | Use `.env.local` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | ✅ | Use `.env.local` |
| `SUPABASE_SECRET_KEY` | ✅ | ✅ | Use `.env.local` |
| `AI_PROVIDER` | ✅ | Optional | Use `.env.local` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | ✅ | Optional | Use `.env.local` |

For Preview deployments, you can point to a separate staging Supabase project to avoid contaminating production data during development.

---

## 7. Post-deployment checklist

- [ ] Homepage loads with enriched items
- [ ] Search returns results for query "agent"
- [ ] An item detail page loads (`/items/[any-valid-id]`)
- [ ] Digest page shows 6 sections
- [ ] `/items/00000000-0000-0000-0000-000000000000` shows the not-found page
- [ ] No `SUPABASE_SECRET_KEY`, legacy service role key, `OPENAI_API_KEY`, or `CRON_SECRET` in browser responses or page source
- [ ] `anon` and `authenticated` cannot read server-only tables or raw item payload columns through the Supabase Data API
- [ ] Vercel Function logs show no errors on page load
- [ ] `GET /api/refresh/daily` without auth header returns `401 Unauthorized`
- [ ] Vercel dashboard → Settings → Cron Jobs shows the daily schedule
- [ ] Manual trigger returns `{ "success": true, ... }` with expected counts

---

## 8. Monitoring

Vercel provides built-in logs at **Project → Functions → Logs**. Public content
pages use ISR, while search and operational endpoints remain dynamic.

Common errors to watch for:

| Error | Likely cause |
|---|---|
| `Missing Supabase server env vars` | `SUPABASE_SECRET_KEY` (or the legacy service role key) is not set in Vercel |
| `getTopPicks returned []` (empty homepage) | No enriched items in DB — run the pipeline |
| Function timeout | Supabase query taking too long — check DB indexes |

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # http://localhost:3000
```

The dev server bypasses production ISR behavior and may query Supabase more often than production.

To develop without making real AI calls:

```bash
npm run enrich -- --mock --limit 5
```

The mock provider returns plausible-looking enrichment data without calling any API.
