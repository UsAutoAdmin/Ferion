# Ferion

Enterprise parts intelligence for salvage operators. Ferion is the enterprise tier of [Part Scout](https://www.partscout.app): it takes an entire auction sale list (Copart, IAA) or yard inventory and values every vehicle against a proven parts catalog — what each lot is worth in parts, how fast those parts sell, and where coverage is missing.

Design language follows [Atoms](https://atoms.co) — see [`BRAND.md`](./BRAND.md).

## Stack

- Next.js 14 (App Router), React 18, TypeScript
- Tailwind CSS 3 with semantic design tokens (`app/globals.css`, `tailwind.config.ts`)
- Vitest for unit tests
- Planned: Supabase (shared catalog with Part Scout), Clerk (auth), OpenAI (make-code resolution and model-year expansion)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in keys
npm run dev                  # http://localhost:3000
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (single run) |

## Structure

```
app/                 Routes (App Router)
  auctions/          Auction Analysis
  catalog/           Parts catalog
  yards/             Monitored yards
components/
  ui/                Design-system primitives (Button, Card, Badge, Stat, Container)
  nav-items.ts       Single source of truth for top-level nav
lib/utils/           Pure helpers (formatting, class merging) + colocated tests
BRAND.md             Color system, type, component conventions
```

## Conventions

- Use semantic tokens (`bg-surface`, `text-fg-muted`, `text-accent`) — never raw hex in components.
- One `accent` (sand) button per screen.
- Pure logic lives in `lib/` with a colocated `*.test.ts`; UI stays thin.
- Route-level auth gating belongs in a `layout.tsx`; API routes re-check authorization themselves.
