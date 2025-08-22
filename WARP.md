# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is an Astro 5.x project using Bun as the package manager. It follows the standard Astro project structure with TypeScript support and uses the strict TypeScript configuration.

## Development Commands

All commands should be run from the project root:

```bash
# Install dependencies
bun install

# Start development server (localhost:4321)
bun dev

# Build for production
bun build

# Preview production build locally
bun preview

# Run Astro CLI commands
bun astro [command]

# Get help with Astro CLI
bun astro -- --help
```

## Architecture & Structure

### Core Architecture
- **Framework**: Astro 5.x with TypeScript support
- **Package Manager**: Bun (note: uses `bun.lock` instead of other lock files)
- **Build Output**: Static site generated to `./dist/`

### Key Directories
- `src/pages/` - File-based routing; each `.astro` file becomes a route
- `src/layouts/` - Reusable page templates (HTML structure)
- `src/components/` - Astro components (`.astro` files)
- `src/assets/` - Static assets that get processed/optimized by Astro
- `public/` - Static files served as-is (favicon, etc.)
- `.astro/` - Generated type definitions (auto-generated, git-ignored)

### Component Architecture
- **Layout Pattern**: Uses a base `Layout.astro` for HTML structure
- **Component Pattern**: Astro components can include frontmatter (JS/TS) and template markup
- **Asset Handling**: Assets in `src/assets/` are imported and optimized

### TypeScript Configuration
- Extends Astro's strict TypeScript configuration
- Includes all files and `.astro/types.d.ts` for generated types
- Excludes `dist/` build output

### Development Setup
- **VSCode**: Configured with Astro extension recommendation
- **Debugging**: Launch configuration for development server debugging
- **File Processing**: Astro handles TypeScript, asset optimization, and SSG

### Key Files
- `astro.config.mjs` - Main Astro configuration (currently minimal)
- `tsconfig.json` - TypeScript configuration extending Astro's strict preset
- `src/pages/index.astro` - Homepage entry point
- `src/layouts/Layout.astro` - Base HTML template with meta tags and styles

## Astro-Specific Concepts

### File-based Routing
Pages in `src/pages/` automatically become routes. The file structure determines the URL structure.

### Component Frontmatter
Astro components use `---` delimiters for JavaScript/TypeScript code that runs at build time.

### Asset Imports
Assets in `src/assets/` should be imported in component frontmatter and referenced via `.src` property for optimization.

### Static vs Dynamic
This appears to be configured for static site generation (SSG) - all pages are pre-built at build time.
