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

Once the project is created, open the SQL editor (Database → SQL Editor) and run the contents of `supabase/migrations/001_initial_schema.sql`.

This creates the `items` and `rss_feeds` tables and their indexes.

### Collect credentials

From Project Settings → API:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (e.g. `https://abcdef.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — treat like a password |

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
SUPABASE_SERVICE_ROLE_KEY
AI_PROVIDER                (anthropic or openai)
ANTHROPIC_API_KEY          (if AI_PROVIDER=anthropic)
OPENAI_API_KEY             (if AI_PROVIDER=openai)
GITHUB_TOKEN               (not needed for the web app — only for ingestion scripts)
CRON_SECRET                (required — protects /api/refresh/daily)
DAILY_ENRICH_LIMIT         (optional — max items enriched per cron run, default 150)
```

> **Note:** `GITHUB_TOKEN` is only used by the ingestion scripts and is not needed for the deployed web application. You only need it when running `npm run ingest:github` locally or from a CI environment.

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

# Once satisfied, enrich the full batch
npm run enrich -- --limit 500

# Compute ranking scores
npm run rank
```

After this, the homepage should show enriched, ranked items.

**Cost estimate:** At OpenAI `gpt-4o-mini` rates, enriching 500 items costs approximately $0.50–$1.00. Anthropic `claude-3-5-haiku` is similar. Run `npm run enrich -- --dry-run` to preview which items will be processed before committing to a batch.

---

## 4. Automated daily refresh (Vercel Cron)

AgentRadar ships with a production-ready daily refresh pipeline that runs automatically on Vercel.

### How it works

`vercel.json` schedules `GET /api/refresh/daily` at **08:00 UTC every day**. The route:

1. Ingests from GitHub, HN, and RSS concurrently
2. Enriches up to `DAILY_ENRICH_LIMIT` new items (default: 150) with the configured AI provider
3. Recomputes `ranking_score` for the entire enriched corpus
4. Returns a JSON summary — viewable in Vercel Function logs

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
| `DAILY_ENRICH_LIMIT` | `150` (or lower) | Production |

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
  "ingestionCounts": { "github": 24, "hn": 6, "rss": 12 },
  "enrichedCount": 38,
  "failedCount": 2,
  "rankedCount": 1847,
  "durationMs": 142300
}
```

### Cost estimate

| Items enriched | Model | Estimated cost |
|---|---|---|
| 50 | claude-3-5-haiku | ~$0.05 |
| 150 | claude-3-5-haiku | ~$0.15–$0.30 |
| 150 | gpt-4o-mini | ~$0.15–$0.25 |

Adjust `DAILY_ENRICH_LIMIT` in Vercel env vars to control cost. Items that remain unenriched on one run will be picked up on the next.

### Failure handling

| Failure type | Behaviour |
|---|---|
| One item fails validation | Marked `status='failed'`, retried on next run |
| Billing/quota error | Enrichment stops early; `success: false` in response; items not marked failed |
| Ingestion source unreachable | That source returns 0 items; other sources continue |
| Function timeout | Increase `DAILY_ENRICH_LIMIT` cautiously or reduce it; 150 items ≈ 3–4 min |

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
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | Use `.env.local` |
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
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY` in browser DevTools network responses or page source
- [ ] Vercel Function logs show no errors on page load
- [ ] `GET /api/refresh/daily` without auth header returns `401 Unauthorized`
- [ ] Vercel dashboard → Settings → Cron Jobs shows the daily schedule
- [ ] Manual trigger returns `{ "success": true, ... }` with expected counts

---

## 8. Monitoring

Vercel provides built-in logs at **Project → Functions → Logs**. Since all pages are `force-dynamic` Server Components, each page load appears as a function invocation.

Common errors to watch for:

| Error | Likely cause |
|---|---|
| `Missing Supabase server env vars` | `SUPABASE_SERVICE_ROLE_KEY` not set in Vercel |
| `getTopPicks returned []` (empty homepage) | No enriched items in DB — run the pipeline |
| Function timeout | Supabase query taking too long — check DB indexes |

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # http://localhost:3000
```

The dev server uses `force-dynamic` pages, so it queries Supabase on every request — the same as production.

To develop without making real AI calls:

```bash
npm run enrich -- --mock --limit 5
```

The mock provider returns plausible-looking enrichment data without calling any API.
