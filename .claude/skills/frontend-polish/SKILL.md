---
name: frontend-polish
description: Use for Next.js pages, layouts, and components. Produces clean developer-tool aesthetic with shadcn/ui and Tailwind. Requires empty states and loading states. No unnecessary animations or complexity.
---

# Frontend Polish

Use this skill when building or refining any UI: pages, layouts, components, responsive behavior, loading states, or empty states.

## Aesthetic

AgentRadar targets developers. The visual language should feel like a high-quality dev tool or dashboard:

- **Dark-first** (or neutral), high-contrast, data-dense but not cluttered.
- Monospace or neutral-weight type for metadata (dates, tags, scores).
- Let content breathe — generous spacing, not packed.
- shadcn/ui components as the baseline; extend with Tailwind utilities, not custom CSS.
- No gratuitous animations, parallax, or decorative gradients unless they serve readability.

## Required states for every data-driven component

Every component that fetches or receives async data must implement all three:

| State | Requirement |
|-------|-------------|
| **Loading** | Skeleton or spinner — never a blank void |
| **Empty** | Informative message explaining why nothing is here (e.g. "No tools indexed yet — ingestion runs every hour") |
| **Error** | User-facing message without leaking technical detail; log full error server-side |

## Component rules

- Read the existing component and type files before creating new ones.
- Prefer composing existing shadcn/ui primitives over writing raw HTML.
- Keep components small and single-purpose. Extract shared logic when it appears in two or more places — not before.
- No `any` in props or return types.
- Server Components by default; add `'use client'` only when interactivity requires it.
- Do not fetch data inside client components — fetch in Server Components or Route Handlers and pass as props.

## Responsive behavior

- Mobile-first Tailwind classes.
- Card grids: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` as the default pattern.
- Navigation: collapsible or bottom-bar on mobile.

## What not to do

- No `useEffect` for data fetching — use Server Components or SWR/React Query if client-side refresh is needed.
- No inline styles.
- No third-party animation libraries unless the user requests them.
- No placeholder content in committed code (`lorem ipsum`, `Coming soon`, `TODO: add data`).

## Checklist before marking done

- [ ] Loading state implemented
- [ ] Empty state implemented with an explanatory message
- [ ] Error state implemented
- [ ] Responsive at mobile and desktop widths
- [ ] No `any` in types
- [ ] `'use client'` added only where required
- [ ] No data fetching inside client components
