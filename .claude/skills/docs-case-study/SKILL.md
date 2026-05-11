---
name: docs-case-study
description: Use for README, architecture diagrams, portfolio writeups, and interview talking points. Honest — never invents usage metrics, user counts, or outcomes that did not happen.
---

# Docs & Case Study

Use this skill when writing any documentation intended for external audiences: README, architecture writeup, portfolio page, or interview prep notes.

## Honesty rules

- **Never invent metrics.** Do not write "10,000 tools indexed", "used by 500 developers", or any number that was not actually measured.
- **Never claim outcomes that did not occur.** If the app has not been deployed publicly, do not write "live at agentrad.ar".
- **Distinguish speculation from fact.** Intended architecture is fine to describe as intended; present it as a design decision, not a proven result.
- If the user asks you to include a metric you cannot verify, write `[PLACEHOLDER: insert real number]` and flag it to the user.

## README structure

A good README for this project covers:

1. **What it is** — one paragraph, no jargon, explains the value to a developer reader
2. **How it works** — architecture diagram or prose covering the data flow (ingest → enrich → display)
3. **Tech stack** — brief list with the rationale for non-obvious choices
4. **Running locally** — exact commands, required env vars (names only, not values), any seed data steps
5. **Deployment** — how to deploy to Vercel, which env vars to set in the Vercel dashboard
6. **Project structure** — only the non-obvious parts; skip files that explain themselves

## Architecture diagram

Use a simple text-based or Mermaid diagram. The minimum useful diagram shows:

```
External sources → Ingestion (cron/API route) → Supabase
                                                    ↓
                                          AI enrichment (server-only)
                                                    ↓
                                        Next.js App Router (Server Components)
                                                    ↓
                                               User (browser)
```

Expand to include specific APIs (GitHub, HN, RSS) and the AI providers actually used.

## Portfolio writeup

Structure for a case study:

1. **Problem** — what gap AgentRadar fills for developers following GenAI tooling
2. **Architecture decisions** — why Next.js App Router, why Supabase, why AI enrichment server-side
3. **Engineering challenges** — e.g. validating AI output, rate-limiting ingestion, keeping the feed fresh
4. **What I'd do differently** — honest reflection; reviewers respect candor
5. **Links** — repo, live demo (only if actually deployed)

## Interview talking points

When generating talking points, focus on:

- The data pipeline design and tradeoffs (polling vs webhooks, ingestion frequency)
- How AI output is validated and what happens when it fails
- Security decisions (server-side secrets, Zod validation at boundaries)
- Scalability considerations (what breaks first at 10x volume)

Avoid talking points that can't be defended with code — don't claim "highly scalable" without a concrete basis.

## Tone

- Technical but accessible: assume the reader is a senior developer, not a user.
- Active voice, short sentences.
- No marketing language ("blazing fast", "seamless", "powerful").
