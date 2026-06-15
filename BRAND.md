# mad.builders brand guide

The short reference for the identity. The **living version** (rendered from the
real design tokens) is at [`/brand`](src/pages/brand.astro). Run `pnpm dev` and
visit `/brand`. This file is the portable summary.

## Logo

- Wordmark: **`mad.builders`** in **Bricolage Grotesque, 500** (medium).
- `mad` sits at weight 500; the dot and `.builders` drop to weight 400 and `--cream-dim`.
- Bricolage Grotesque is used **only** for the logo, nowhere else.
- Lockups: **cream on green** or **green on cream**. Nothing else.

**Do:** keep the dimmed dot · give it clear space (~ height of the "m") · use the two approved lockups.
**Don't:** recolour · add shadows, outlines or gradients · change the mad vs .builders weight · stretch or condense · set on a busy photo without a scrim.

## Colour

Defined in [`src/styles/global.css`](src/styles/global.css) `:root`.

| Token | Value | Use |
|---|---|---|
| `--green` | `#1a342b` | primary background, the brand green |
| `--green-deep` | `#142a22` | footer, deepest surface |
| `--green-soft` | `#214136` | raised surfaces on green |
| `--cream` | `#f6f5f0` | primary ink on green, light-section background |
| `--cream-dim` | `rgba(246,245,240,0.62)` | secondary text |
| `--cream-faint` | `rgba(246,245,240,0.38)` | kickers, tertiary text |
| `--line` | `rgba(246,245,240,0.14)` | hairline borders |

Sponsor colours (e.g. Samplia red) live **only** inside the sponsor's own logo, never in the core palette.

## Typography

| Font | Role | Where |
|---|---|---|
| **Bricolage Grotesque** | logo | the `mad.builders` wordmark, nowhere else |
| **Archivo** (`--font-sans`) | body | headings, hero, body, cards, UI. the workhorse |
| **IBM Plex Mono** (`--font-mono`) | other | kickers, buttons, nav, ticker, footer. uppercase, letter-spaced |

## Voice & tone

Terse, lowercase, a little irreverent. It should sound like a builder, not a
brochure. Ease off for VCs and sponsors: stay clear, skip the crude.

**Do:** lowercase headings ("no bullshit. just building.") · short, concrete, plain words · builder-first with a little Madrid flavour · periods and commas over em-dashes.
**Don't:** Title Case or ALL-CAPS headlines · corporate fluff or hype words · jargon when a plain word works · em-dash pile-ups and other "AI tells".

## Photography

Real moments from the house: rooftops, talks, packed rooms at golden hour. Slightly desaturated (`filter: saturate(0.92)`); edges fade into the green in the strips. Never staged stock.

## Focus areas

`ai · hardware & robotics · healthtech · digital assets`, kept in sync from
[`src/data/site.ts`](src/data/site.ts) (`site.focus`).
