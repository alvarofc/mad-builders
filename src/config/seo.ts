export const SITE = 'https://www.mad.builders'

export const DEFAULT_TITLE = 'MAD BUILDERS — Builders, hackers, and dreamers in Madrid'
export const DEFAULT_DESCRIPTION = 'A Madrid-based community for builders, hackers, and dreamers. Ship fast, collaborate, and build things that matter.'
export const OG_IMAGE = '/og.svg'
export const LOCALE = 'en_US'
export const SITE_NAME = 'MAD BUILDERS'
export const THEME_COLOR = '#000000'

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
