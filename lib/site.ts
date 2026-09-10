const DEFAULT_SITE_URL = 'https://agentradarlive.vercel.app'

function resolveSiteUrl(raw: string | undefined): string {
  try {
    const url = new URL(raw || DEFAULT_SITE_URL)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return DEFAULT_SITE_URL
    return url.origin
  } catch {
    return DEFAULT_SITE_URL
  }
}

export const SITE_URL = resolveSiteUrl(process.env.SITE_URL)
