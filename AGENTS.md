# mad.builders agent guide

Static marketing site for the mad.builders community, built with Astro. This is
the single source of agent conventions for the repo; CLAUDE.md points here.

## Brand & voice

Read the brand guide before writing copy or building UI:

- The live `/brand` page (`src/pages/brand.astro`) is the single source of truth
  for logo, colour, type and voice.
- Voice: terse, lowercase, plain. A builder talking, not a brochure.
- Writing style: apply the humanizer skill at
  [`.agents/skills/humanizer/SKILL.md`](.agents/skills/humanizer/SKILL.md) to all
  prose. No em-dashes, no Title Case headings, no "AI tells". Plain punctuation.

## Stack & commands

- Astro static site. Package manager: pnpm.
- `pnpm dev` for local work (HMR), `pnpm build` to build, `pnpm preview` to serve the build.
- esbuild and sharp build scripts are declined in `pnpm-workspace.yaml`; their
  binaries ship prebuilt, so this is expected. Do not run `approve-builds`.

## Conventions

- Design tokens live in `src/styles/global.css` (`:root`). Reuse them; never hardcode colours.
- Content and data live in `src/data/*`. Keep the `/brand` page in sync with the real tokens.

<!-- This section is maintained by the coding agent via lore (https://github.com/BYK/opencode-lore) -->
<!-- End lore-managed section -->
