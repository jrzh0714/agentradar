export interface RssFeedConfig {
  name: string
  url: string
  categoryHint?: string
}

// Canonical feed list — keep in sync with supabase/migrations/001_initial_schema.sql seed.
// The rss_feeds table is the live source of truth; this file is for reference and re-seeding.
export const RSS_FEEDS: RssFeedConfig[] = [
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss.xml',
    categoryHint: 'ai-research',
  },
  {
    name: 'Hugging Face Blog',
    url: 'https://huggingface.co/blog/feed.xml',
    categoryHint: 'ai-research',
  },
  {
    name: 'GitHub Blog',
    url: 'https://github.blog/feed/',
    categoryHint: 'developer-tools',
  },
  {
    name: 'LangChain Blog',
    url: 'https://www.langchain.com/blog/rss.xml',
    categoryHint: 'agent-frameworks',
  },
  {
    name: 'Vercel Blog',
    url: 'https://vercel.com/atom',
    categoryHint: 'developer-tools',
  },
  {
    name: "Simon Willison's Blog",
    url: 'https://simonwillison.net/atom/everything/',
    categoryHint: 'ai-engineering',
  },
]
