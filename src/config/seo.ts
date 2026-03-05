export const SITE = 'https://www.mad.builders'

export const DEFAULT_TITLE = 'MAD BUILDERS — Where founders build.'
export const DEFAULT_DESCRIPTION = 'A free workspace, a curated community, and a launchpad for founders building real companies. Curated. Selective. Based in Madrid.'
export const OG_IMAGE = '/og.svg'
export const LOCALE = 'en_US'
export const SITE_NAME = 'MAD BUILDERS'
export const THEME_COLOR = '#FFFFFF'

// Fill in when available
export const SAME_AS: string[] = [
  // 'https://twitter.com/...',
  // 'https://www.linkedin.com/company/...',
  // 'https://github.com/...',
]

export const addressLocality = 'Madrid'
export const addressCountry = 'ES'

// Helper to create absolute URLs
export function absoluteUrl(path = '/'): string {
  try {
    return new URL(path, SITE).toString()
  } catch {
    return SITE
  }
}
