export interface RssFeedConfig {
  name: string
  url: string
}

// Seed list for Phase 2 ingestion. Move to rss_feeds Supabase table when
// runtime configurability is needed.
export const RSS_FEEDS: RssFeedConfig[] = [
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss.xml',
  },
  {
    name: 'Anthropic News',
    url: 'https://www.anthropic.com/rss.xml',
  },
  {
    name: 'GitHub Blog',
    url: 'https://github.blog/feed/',
  },
  {
    name: 'LangChain Blog',
    url: 'https://blog.langchain.dev/rss/',
  },
  {
    name: 'Vercel Blog',
    url: 'https://vercel.com/atom',
  },
  {
    name: "Simon Willison's Blog",
    url: 'https://simonwillison.net/atom/everything/',
  },
]
