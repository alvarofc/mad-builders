export const SITE = 'https://www.mad.builders'

export const DEFAULT_TITLE = "the builders' house in madrid | mad.builders"
export const DEFAULT_DESCRIPTION = "The builders' house, where builders, founders and VCs meet in the heart of Madrid. AI, hardware & robotics, healthtech, digital assets."
export const OG_IMAGE = '/og.png'
export const LOCALE = 'en_US'
export const SITE_NAME = 'mad builders'
export const THEME_COLOR = '#1a342b'

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
