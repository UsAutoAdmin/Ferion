# Ferion — Brand & UI Reference

Ferion is the enterprise tier of Part Scout: auction-scale parts valuation for salvage operators, buyers, and recyclers. Where Part Scout is a light, cream-and-forest-green tool for individual resellers, Ferion is dark, quiet, and numeric — the visual language is borrowed from [Atoms](https://atoms.co).

Everything below is implemented as CSS variables in `app/globals.css` and exposed to Tailwind in `tailwind.config.ts`. Use the semantic token in code, never the raw hex.

---

## 1. Color system

### Surfaces

| Token | Tailwind | Hex | Use |
|---|---|---|---|
| `--surface` | `bg-surface` | `#000000` | Page background. True black, like Atoms. |
| `--surface-raised` | `bg-surface-raised` | `#0C0C0C` | Cards, panels. |
| `--surface-overlay` | `bg-surface-overlay` | `#141414` | Modals, dropdowns, popovers. |

### Type

| Token | Tailwind | Hex | Use |
|---|---|---|---|
| `--fg` | `text-fg` | `#FFF7DD` | Headings and primary text. Atoms renders this at 90% opacity — `body` defaults to `text-fg/90`. Warm cream, never pure white. |
| `--fg-muted` | `text-fg-muted` | `#C8BEA8` | Body copy, descriptions. |
| `--fg-subtle` | `text-fg-subtle` | `#8A8A8A` | Captions, helper text, eyebrow labels. |

### Brand accents

| Token | Tailwind | Hex | Use |
|---|---|---|---|
| `--accent` | `text-accent` / `bg-accent` | `#C8AD86` | **Sand.** The signature. Highlight phrase in the hero, primary accent CTA, active states, stat numerals. |
| `--accent-hover` | `bg-accent-hover` | `#D7BE98` | Hover of sand elements. |
| `--accent-deep` | `border-accent-deep` | `#957951` | **Bronze.** Card hover borders, muted accents, chart secondaries. |
| `--accent-bright` | `text-accent-bright` | `#E8A85F` | **Copper.** Emphasis numerals, warnings, "target" stats. |
| `--accent-rust` | `bg-accent-rust` | `#9E5B3A` | **Rust.** Destructive actions, negative deltas. |

### Secondary / data-viz

Use these for charts and category coding only — never for CTAs.

| Token | Hex |
|---|---|
| `teal` | `#6E8F8D` |
| `slate` | `#3F5875` |
| `sage` | `#5A7A4F` |
| `olive` | `#8C8976` |
| `taupe` | `#AF9888` |

### Hairlines & status

| Token | Use |
|---|---|
| `border-line/10` | Standard card and divider border — `rgba(255,255,255,0.11)`, Atoms' exact hairline. |
| `border-line/20` | Secondary button outline. |
| `success` / `warning` / `danger` | Map to sage / copper / rust. |

### Color rules

- **Black + cream + sand is the brand.** If a screen is gray-on-gray with no sand, it doesn't look like Ferion.
- **One sand CTA per screen.** Everything else is cream-fill (`primary`), outline (`secondary`), or text (`ghost`).
- **Hairlines are white at 11%, never gray hex borders.** This is what makes cards sit "in" the black rather than "on" it.
- **No pure white.** `#FFFFFF` appears nowhere in type. Cream only.
- **No gradients.** Depth comes from the three surface levels and soft shadows.
- **Don't reuse Part Scout's forest green.** Ferion is a sibling, not a skin.

---

## 2. Typography

- **Typeface:** [Switzer](https://www.fontshare.com/fonts/switzer) (Fontshare, free) — Atoms' typeface. Loaded via `<link>` in `app/layout.tsx`; falls back to Inter / system sans.
- **Body weight:** 400. Headings 500 (`font-medium`), never 700. Atoms' headings are light and large; weight comes from size, not boldness.
- **Tracking:** headings `tracking-tight`; eyebrows uppercase with `tracking-eyebrow` (0.18em); the wordmark `tracking-[0.22em]`.

| Role | Classes |
|---|---|
| Hero H1 | `text-4xl font-medium tracking-tight sm:text-5xl md:text-6xl` with one `text-accent` phrase |
| Page H1 | `text-3xl font-medium tracking-tight sm:text-4xl text-fg` |
| Section H2 | `text-2xl font-medium tracking-tight sm:text-3xl text-fg` |
| Card title | `text-base font-medium text-fg` |
| Body | `text-sm` / `text-base`, `text-fg-muted`, `leading-relaxed` |
| Eyebrow | `text-xs font-medium uppercase tracking-eyebrow text-accent` (or `text-fg-subtle`) |
| Stat numeral | `text-3xl sm:text-4xl font-medium tracking-tight text-accent` |

---

## 3. Components (`components/ui/`)

| Component | Notes |
|---|---|
| `Button` | Variants: `primary` (cream fill), `secondary` (hairline outline), `ghost` (text), `accent` (sand — one per screen), `danger` (rust). Sizes `sm`/`md`/`lg`. Renders `<Link>` when `href` is passed. |
| `Card` | `bg-surface-raised`, `border-line/10`, `rounded-brand-lg`, `shadow-brand-sm`. Hover → `border-accent-deep/60`. |
| `Badge` | Pill. `neutral` is Atoms' category tag (cream at 11%). |
| `Stat` | Eyebrow label + large numeral + optional hint. |
| `Container` | `default` (7xl) / `narrow` (2xl) / `wide` (1600px). |
| `PageHeader` | Eyebrow + title + description + actions, with bottom hairline. |

### Radii & shadows

Radii match Part Scout (`brand-sm` 6px, `brand-md` 8px, `brand-lg` 12px) so ported components keep their shape. Shadows are deeper (40–60% black) because they sit on black; `shadow-accent-glow` exists for focused/selected states.

---

## 4. Layout

- Header: sticky, `h-14` mobile / `h-16` desktop, `bg-surface/90 backdrop-blur`, bottom hairline.
- Section rhythm: `py-16 sm:py-20` marketing; `py-10 sm:py-14` app page headers.
- Band sections (stats) use `bg-surface-raised/60` with `border-y border-line/10`.
- Tap targets ≥ 44px on mobile.

---

## 5. Voice

Same operator-grade voice as Part Scout — short, numeric, no hype — but one register more institutional. The audience is a buyer or ops lead valuing hundreds of lots, not a weekend flipper.

- Lead with the number: "500+ lots per run," "70% pre-2015 coverage."
- Name the source: "Copart sale list," "IAA run list," "the catalog."
- Terms: *lot, sale list, run list, coverage, sell-through, catalog, yard.*
- Avoid: emojis, exclamation points, "AI-powered," "seamless."

---

## 6. Copy-paste palette

```css
--surface:         #000000;
--surface-raised:  #0C0C0C;
--surface-overlay: #141414;
--fg:              #FFF7DD;  /* use at 90% */
--fg-muted:        #C8BEA8;
--fg-subtle:       #8A8A8A;
--accent:          #C8AD86;  /* sand — the signature */
--accent-hover:    #D7BE98;
--accent-deep:     #957951;  /* bronze */
--accent-bright:   #E8A85F;  /* copper */
--accent-rust:     #9E5B3A;  /* rust */
--teal:            #6E8F8D;
--slate:           #3F5875;
--sage:            #5A7A4F;
--olive:           #8C8976;
--taupe:           #AF9888;
--line:            rgba(255,255,255,0.11);
```
