export const SITE = 'https://www.mad.builders'

export const DEFAULT_TITLE = "the builders' house in Madrid | mad.builders"
export const DEFAULT_DESCRIPTION = "The builders' house, where builders, founders and VCs meet in the heart of Madrid. AI, hardware & robotics, healthtech, digital assets."
export const OG_IMAGE = '/og.png'
export const LOCALE = 'en_US'
export const SITE_NAME = 'mad builders'
export const THEME_COLOR = '#1a342b'

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

// Organization JSON-LD for the homepage, so search engines can identify the brand.
export const ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'mad.builders',
  url: SITE,
  logo: absoluteUrl('/icon-512.png'),
  description: DEFAULT_DESCRIPTION,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Pl. del Callao, 1',
    addressLocality,
    postalCode: '28013',
    addressCountry,
  },
}
