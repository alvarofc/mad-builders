# mad.builders — brand guide

The short reference for the identity. The **living version** (rendered from the
real design tokens) is at [`/brand`](src/pages/brand.astro) — run `pnpm dev` and
visit `/brand`. This file is the portable summary.

## Logo

- Wordmark: **`mad.builders`** in **Bricolage Grotesque, 700**.
- The dot + `.builders` are **dimmed** (`--cream-dim`, weight 400); `mad` is full weight.
- Bricolage Grotesque is used **only** for the logo — nowhere else.
- Lockups: **cream on green** or **green on cream**. Nothing else.

**Do:** keep the dimmed dot · give it clear space (~ height of the "m") · use the two approved lockups.
**Don't:** recolour · add shadows/outlines/gradients · change the mad-vs-.builders weight · stretch/condense · set on a busy photo without a scrim.

## Colour

Defined in [`src/styles/global.css`](src/styles/global.css) `:root`.

| Token | Value | Use |
|---|---|---|
| `--green` | `#1a342b` | primary background — the brand green |
| `--green-deep` | `#142a22` | footer / deepest surface |
| `--green-soft` | `#214136` | raised surfaces on green |
| `--cream` | `#f6f5f0` | primary ink on green · light-section background |
| `--cream-dim` | `rgba(246,245,240,0.62)` | secondary text |
| `--cream-faint` | `rgba(246,245,240,0.38)` | kickers / tertiary text |
| `--line` | `rgba(246,245,240,0.14)` | hairline borders |

Sponsor colours (e.g. Samplia red) live **only** inside the sponsor's own logo — never in the core palette.

## Typography

| Font | Role | Where |
|---|---|---|
| **Archivo** (`--font-sans`) | display & body | headings, hero, body, cards, UI — the workhorse |
| **Bricolage Grotesque** | logo only | the `mad.builders` wordmark |
| **IBM Plex Mono** (`--font-mono`) | labels & UI | kickers, buttons, nav, ticker, footer — uppercase, letter-spaced |

## Voice & tone

Terse, lowercase, a little irreverent — like a builder, not a brochure. Ease the edge back (clear, not crude) for VCs and sponsors.

**Do:** lowercase headings ("no bullshit. just building.") · short, concrete, plain words · builder-first, a little Madrid flavour · mono uppercase kickers as section labels.
**Don't:** Title Case / ALL-CAPS headlines · corporate fluff or hype words · jargon when a plain word works · long paragraphs where a line will do.

## Photography

Real moments from the house — rooftops, talks, packed rooms at golden hour. Slightly desaturated (`filter: saturate(0.92)`); edges fade into the green in the strips. Never staged stock.

## Focus areas

`ai · hardware & robotics · healthtech · digital assets` — kept in sync from
[`src/data/site.ts`](src/data/site.ts) (`site.focus`).
