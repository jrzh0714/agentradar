/**
 * /feed.xml — RSS 2.0 feed of the weekly digest.
 *
 * Serves the same curated sections as /digest so RSS readers can subscribe.
 * Revalidated hourly — digest content only changes on daily ingestion.
 */
import { getDigestSections } from '@/lib/db/digest'
import { getDisplayTitle } from '@/lib/ingestion/title'

export const revalidate = 3600

const SITE_URL = 'https://agentradarlive.vercel.app'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET(): Promise<Response> {
  const sections = await getDigestSections()

  const items = sections
    .flatMap((section) =>
      section.items.map((item) => {
        const title = getDisplayTitle(item)
        const summary = item.ai_summary?.trim() || item.description?.trim() || ''
        const link = `${SITE_URL}/items/${item.id}`
        const pubDate = item.published_at ? new Date(item.published_at).toUTCString() : ''
        return `    <item>
      <title>${escapeXml(`[${section.title}] ${title}`)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ''}
      <description>${escapeXml(summary)}</description>
    </item>`
      }),
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AgentRadar Weekly Digest</title>
    <link>${SITE_URL}/digest</link>
    <description>A ranked briefing of emerging agent frameworks, model updates, research, MCP tools, and developer workflows.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
