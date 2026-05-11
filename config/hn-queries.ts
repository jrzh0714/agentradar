// Search queries for Hacker News Algolia ingestion.
// Each runs as a separate API call against the HN Algolia search endpoint.
// Docs: https://hn.algolia.com/api
export const HN_QUERIES: string[] = [
  'llm agent',
  'ai agent framework',
  'model context protocol',
  'rag retrieval augmented',
  'claude anthropic',
  'openai',
  'ai coding tool',
  'open source llm',
]

// How many hits to fetch per query (max 50 per Algolia page)
export const HN_HITS_PER_QUERY = 20

// Only ingest stories published within this many hours
export const HN_LOOKBACK_HOURS = 48
