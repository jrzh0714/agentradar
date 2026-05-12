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

## 4. Ongoing pipeline

There is currently no automated scheduling. Run the pipeline manually as needed:

```bash
# Daily or weekly refresh
npm run ingest:all
npm run enrich -- --limit 100
npm run rank
```

### Optional: Vercel Cron (automated)

To automate ingestion, you can add a Vercel Cron job. This requires:

1. Creating API route handlers that call the ingestion and enrichment logic
2. Declaring cron schedules in `vercel.json` or `vercel.ts`

This is not implemented in the current codebase but is a straightforward extension.

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
