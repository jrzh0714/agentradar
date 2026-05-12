/**
 * Search queries for GitHub ingestion. Each runs as a separate API call.
 * GitHub Search API docs:
 *   https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories
 *
 * All queries include `fork:false` to exclude forks from results.
 * The GitHub Search API can return fork repos whose star/fork counts reflect
 * the upstream repo rather than the fork itself, which severely distorts ranking.
 *
 * GITHUB_RESULTS_PER_QUERY controls `per_page`. GitHub Search API max is 100.
 * Raise this if the corpus feels thin after fork exclusion.
 */
export const GITHUB_QUERIES: string[] = [
  'ai agent stars:>50 fork:false',
  'llm agent stars:>50 fork:false',
  'mcp server stars:>20 fork:false',
  'rag framework stars:>50 fork:false',
  'code agent stars:>20 fork:false',
  'browser agent stars:>20 fork:false',
  'workflow automation ai stars:>20 fork:false',
  'developer tools ai stars:>50 fork:false',
]

export const GITHUB_RESULTS_PER_QUERY = 15

/**
 * Source IDs (full_name, e.g. "owner/repo") that are permanently excluded from
 * ingestion regardless of what the GitHub Search API returns.
 *
 * Use this for repos whose GitHub metadata is untrustworthy (e.g. implausible
 * star counts that distort ranking) but that are not classified as forks by the
 * API, so fork:false does not filter them.
 *
 * Note: these repos will also be deleted from the DB by scripts/cleanup-github-artifacts.ts.
 */
export const GITHUB_INGESTION_BLOCKLIST: string[] = [
  // Audit 2026-05-12: both repos return ~160–180k stars that appear inconsistent
  // with their age and account size. Stars may reflect a repo transfer or API
  // anomaly. Re-evaluate if/when the star counts stabilise or are explained.
  'affaan-m/everything-claude-code',
  'anomalyco/opencode',
]
