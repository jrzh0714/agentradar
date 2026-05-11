// Search queries for GitHub ingestion. Each runs as a separate API call.
// GitHub Search API docs: https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories
export const GITHUB_QUERIES: string[] = [
  'ai agent stars:>50',
  'llm agent stars:>50',
  'mcp server stars:>20',
  'rag framework stars:>50',
  'code agent stars:>20',
  'browser agent stars:>20',
  'workflow automation ai stars:>20',
  'developer tools ai stars:>50',
]

export const GITHUB_RESULTS_PER_QUERY = 10
