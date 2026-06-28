# mad.builders agent guide

Static marketing site for the mad.builders community, built with Astro. This is
the single source of agent conventions for the repo; CLAUDE.md points here.

## Brand & voice

- The live `/brand` page (`src/pages/brand.astro`) is the single source of truth
  for logo, colour, type and voice. Read it before writing copy or building UI.
  Don't restate its rules here, keep them in one place to avoid drift.
- Apply the humanizer skill at
  [`.agents/skills/humanizer/SKILL.md`](.agents/skills/humanizer/SKILL.md) to all
  prose.

## Stack & commands

- Astro static site. Package manager: pnpm.
- `pnpm dev` for local work (HMR), `pnpm build` to build, `pnpm preview` to serve the build.
- Don't run `pnpm approve-builds`. esbuild and sharp build scripts are
  intentionally declined in `pnpm-workspace.yaml` (rationale in the file).

## Workflow

- Never commit, stage, push, or open a PR unless the user explicitly asks for it.
- Do not run checks, start a dev server, or open the page/browser unless the user
  explicitly asks for it.

## Conventions

- Design tokens live in `src/styles/global.css` (`:root`). Reuse them; never hardcode colours.
- Content and data live in `src/data/*`. Keep the `/brand` page in sync with the real tokens.
- OG/social preview images are not auto-generated; pages fall back to
  `public/og.png`. When creating a new page, ask the user whether it should have
  a custom OG image. If so, drop a 1200×630 PNG in `public/` and pass it to the
  layout: `<Layout title="..." image="/og-yourpage.png">`.

## Page titles

- Format: `Descriptive part - mad.builders`. Lead with the unique, descriptive
  part; brand suffix comes last. Separator is ` - ` (the no-em-dash rule is for
  prose; a hyphen separator in titles is fine).
- Homepage is the exception: brand-forward, `mad.builders - The builders' house
  in Madrid` (set via `DEFAULT_TITLE` in `src/config/seo.ts`).
- Capitalise the descriptive part (sentence case). The `mad.builders` suffix
  stays lowercase, it's the wordmark.
- Keep titles under ~60 chars so they don't truncate in search results. Never
  use a bare generic word like "Home" as a title.
