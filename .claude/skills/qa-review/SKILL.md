---
name: qa-review
description: Use after completing each phase. Runs lint, typecheck, tests, and build. Reviews security, broken states, fragile code, and missing docs. Fixes high-impact issues found.
---

# QA Review

Use this skill after each phase is declared complete, before writing a commit message or moving to the next phase.

## Step 1 — Run the full check suite

```bash
npm run lint
npm run typecheck
npm test        # skip if no tests exist yet
npm run build
```

Do not proceed to step 2 if any command fails. Fix every failure first.

## Step 2 — Security audit

Check every file changed in this phase:

- [ ] No secret env vars (`SERVICE_ROLE_KEY`, `API_KEY`, `TOKEN`) referenced in client components or response bodies
- [ ] No raw SQL strings with interpolated user input (use parameterized queries)
- [ ] No unvalidated external API responses stored to the database
- [ ] No unvalidated AI output stored to the database
- [ ] No credentials, tokens, or internal URLs in committed `.env` or config files

## Step 3 — Broken-state review

For every new page and component:

- [ ] Loading state exists and is not a blank void
- [ ] Empty state exists with an explanatory message
- [ ] Error state exists with a user-friendly message (no stack traces visible to end users)
- [ ] Network/API failure is caught and handled — does not crash the page

For every new API route:

- [ ] Invalid input returns 400 with a clear message, not a 500
- [ ] Missing auth returns 401/403, not a data leak
- [ ] Unhandled promise rejections do not silently fail

## Step 4 — Code quality spot-check

Review each changed file for:

- `any` types — replace with proper types or `unknown` + narrowing
- Dead code or commented-out blocks left in — remove
- Hardcoded values that should be constants or env vars
- Missing Zod validation on external inputs
- Duplicate logic that should be extracted to a shared utility

## Step 5 — Fixes

Fix every **high-impact** issue found (security, data loss, broken UI state, TypeScript errors). Log **low-impact** issues as inline `// TODO:` comments with a brief description, or surface them to the user for prioritization. Do not silently ignore anything found.

## Step 6 — Summary

Produce a short QA report:

```
## QA Report — Phase N

### Checks
- lint: pass / fail
- typecheck: pass / fail
- tests: pass / fail / skipped
- build: pass / fail

### Issues found
- [HIGH] ...
- [MED] ...
- [LOW] ...

### Issues fixed in this session
- ...

### Remaining TODOs
- ...
```
