/**
 * Static UI translations — English + Simplified Chinese.
 * DB content (ai_summary_zh etc.) is handled separately by TranslatedText.
 */

export const translations = {
  en: {
    // ── Nav ────────────────────────────────────────────────────────────────
    'nav.search':         'search',
    'nav.digest':         'digest',
    'nav.status':         'status',
    'nav.home':           'home',
    'nav.back_feed':      '← back to feed',
    'nav.back_home':      '← home',

    // ── Common ─────────────────────────────────────────────────────────────
    'common.beta':        'beta',
    'common.today':       'today',
    'common.see_all':     'See all',
    'common.view_source': 'View source',
    'common.by':          'by',
    'common.published':   'published',
    'common.stars':       'stars',
    'common.forks':       'forks',
    'common.points':      'points',
    'common.comments':    'comments',
    'common.trending':    '↑ trending',
    'common.updated_daily':   'updated daily',
    'common.last_updated':    'last updated',

    // ── Homepage hero ──────────────────────────────────────────────────────
    'home.tagline':       'Track emerging AI agents, developer tools, open-source projects, and model updates in one curated feed.',
    'home.description':   'Items are continuously ingested from GitHub, Hacker News, and technical blogs, enriched by AI to extract category, maturity, and relevance, then ranked by a composite score that weighs signal quality, recency, and community adoption.',
    'home.enriched_items':   'enriched items',
    'home.github_repos':     'GitHub repos',
    'home.rss_articles':     'RSS articles',
    'home.hn_stories':       'HN stories',
    'home.items_indexed':    'items indexed',
    'home.ai_enriched_ranked': 'AI-enriched & ranked',

    // ── Homepage sections ──────────────────────────────────────────────────
    'home.trending_now':      'Trending Now',
    'home.trending_desc':     'Fast-rising items gaining traction in the last 48 hours.',
    'home.no_trending':       'No trending items right now — check back soon.',
    'home.this_week':         'This week',
    'home.this_week_desc':    'Emerging frameworks & articles — up-and-coming, not already famous',
    'home.view_digest':       'View full weekly digest',
    'section.top_picks':      'Top Picks',
    'section.top_picks_desc': 'Highest-signal tools and updates across all sources.',
    'section.ai_news':        'AI News & Research',
    'section.ai_news_desc':   'Model launches, research papers, and platform updates from blogs and HN.',
    'section.latest':         'Latest High-Signal Updates',
    'section.latest_desc':    'Recently published items with strong AI/engineering relevance.',
    'section.agent_tools':    'Agent & MCP Tools',
    'section.agent_tools_desc': 'Frameworks, tool-use libraries, and automation platforms for AI builders.',

    // ── ItemSection ────────────────────────────────────────────────────────
    'section.empty_default':  'No items available yet.',
    'section.empty_top_picks':'No top picks yet — run enrichment and ranking first.',
    'section.empty_news':     'No news or research items found.',
    'section.empty_latest':   'No recent items found.',
    'section.empty_agents':   'No agent or MCP tools found.',

    // ── ItemCard ───────────────────────────────────────────────────────────
    'card.no_summary':        'No summary available yet.',

    // ── Item detail page ───────────────────────────────────────────────────
    'item.ai_briefing':       'AI Briefing',
    'item.summary':           'Summary',
    'item.description':       'Description',
    'item.why_it_matters':    'Why it matters',
    'item.no_summary':        'No AI summary yet — this item may still be processing.',
    'item.classification':    'Classification',
    'item.tags':              'Tags',
    'item.audience':          'Audience',
    'item.ai_relevance':      'AI Relevance',
    'item.radar_score':       'Radar Score',
    'item.published':         'Published',
    'item.indexed':           'Indexed',
    'item.repository':        'Repository',
    'item.related_items':     'Related Items',

    // ── Digest page ────────────────────────────────────────────────────────
    'digest.week_of':         'Week of',
    'digest.title':           'This Week in AI Agents\n & Developer Tools',
    'digest.subtitle':        'A ranked briefing of emerging agent frameworks, model updates, research, MCP tools, and developer workflows.',
    'digest.items_curated':   'items curated',
    'digest.sections':        'sections',
    'digest.ranked_by':       'ranked by AI relevance & community signal',
    'digest.editors_note':    "Editor's note",
    'digest.editors_text':    'AgentRadar is tracking high-signal activity across AI agents, model APIs, MCP tooling, code agents, research, and developer infrastructure.',
    'digest.in_this_digest':  'In this digest',
    'digest.this_week_label': 'This week',
    'digest.top':             'top',
    'digest.item':            'item',
    'digest.items':           'items',

    // ── Search page ────────────────────────────────────────────────────────
    'search.title':           'Search',
    'search.subtitle':        'AI-enriched tools, repos, and articles indexed from GitHub, HN, and blogs.',
    'search.placeholder':     "Search AgentRadar… try 'claude', 'mcp', 'rag'",
    'search.button':          'Search',
    'search.results_for':     'results for',
    'search.high_signal':     'high-signal item',
    'search.high_signal_pl':  'high-signal items',
    'search.sorted_by':       'sorted by',
    'search.no_results':      'No results found',
    'search.no_results_q':    'Try a broader query or remove some filters.',
    'search.no_results_f':    'Try adjusting your filters.',
    'search.active':          'Active:',
    'search.clear_all':       'clear all',
    'search.source_all':      'all',
    'search.category_ph':     'Category',
    'search.sort_radar':      'Best match',
    'search.sort_relevance':  'Highest relevance',
    'search.sort_newest':     'Newest',
    'search.sort_stars':      'Most stars (GitHub)',
    'search.sort_discussed':  'Most discussed (HN)',
    'search.sort_label_radar':     'radar score',
    'search.sort_label_newest':    'publish date',
    'search.sort_label_relevance': 'AI relevance',
    'search.sort_label_stars':     'GitHub stars',
    'search.sort_label_discussed': 'HN discussion',

    // ── Footer ─────────────────────────────────────────────────────────────
    'footer.built_with':      'AgentRadar — built with Next.js, Supabase, and Claude',
    'footer.built_by':        'Built by',
  },

  zh: {
    // ── Nav ────────────────────────────────────────────────────────────────
    'nav.search':         '搜索',
    'nav.digest':         '周报',
    'nav.status':         '状态',
    'nav.home':           '首页',
    'nav.back_feed':      '← 返回',
    'nav.back_home':      '← 首页',

    // ── Common ─────────────────────────────────────────────────────────────
    'common.beta':        'beta',
    'common.today':       '今天',
    'common.see_all':     '查看全部',
    'common.view_source': '查看原文',
    'common.by':          '作者',
    'common.published':   '发布于',
    'common.stars':       'stars',
    'common.forks':       'forks',
    'common.points':      '点赞',
    'common.comments':    '评论',
    'common.trending':    '↑ 趋势上升',
    'common.updated_daily':   '每日更新',
    'common.last_updated':    '最后更新',

    // ── Homepage hero ──────────────────────────────────────────────────────
    'home.tagline':       '在一个精选信息流中追踪新兴 AI Agent、开发者工具、开源项目和模型更新。',
    'home.description':   '持续从 GitHub、Hacker News 和技术博客抓取内容，通过 AI 提取类别、成熟度和相关性，再按综合评分排名。',
    'home.enriched_items':   '条内容已收录',
    'home.github_repos':     'GitHub 项目',
    'home.rss_articles':     'RSS 文章',
    'home.hn_stories':       'HN 话题',
    'home.items_indexed':    '条内容已收录',
    'home.ai_enriched_ranked': 'AI 增强 & 智能排名',

    // ── Homepage sections ──────────────────────────────────────────────────
    'home.trending_now':      '热门趋势',
    'home.trending_desc':     '过去 48 小时内快速上升的热门内容。',
    'home.no_trending':       '暂无趋势内容，请稍后再来。',
    'home.this_week':         '本周精选',
    'home.this_week_desc':    '新兴框架与文章 — 发现潜力项目，而非已成名的热门内容',
    'home.view_digest':       '查看完整周报',
    'section.top_picks':      '精选推荐',
    'section.top_picks_desc': '来自所有来源的高价值工具与更新。',
    'section.ai_news':        'AI 新闻与研究',
    'section.ai_news_desc':   '来自博客和 HN 的模型发布、研究论文和平台更新。',
    'section.latest':         '最新高价值动态',
    'section.latest_desc':    '近期发布的具有强 AI / 工程相关性的内容。',
    'section.agent_tools':    'Agent 与 MCP 工具',
    'section.agent_tools_desc': '面向 AI 开发者的框架、工具调用库和自动化平台。',

    // ── ItemSection ────────────────────────────────────────────────────────
    'section.empty_default':   '暂无内容。',
    'section.empty_top_picks': '暂无精选推荐 — 请先运行增强和排名流程。',
    'section.empty_news':      '暂无新闻或研究内容。',
    'section.empty_latest':    '暂无最新内容。',
    'section.empty_agents':    '暂无 Agent 或 MCP 工具。',

    // ── ItemCard ───────────────────────────────────────────────────────────
    'card.no_summary':        '暂无摘要。',

    // ── Item detail page ───────────────────────────────────────────────────
    'item.ai_briefing':       'AI 简报',
    'item.summary':           '摘要',
    'item.description':       '描述',
    'item.why_it_matters':    '为何重要',
    'item.no_summary':        '暂无 AI 摘要 — 此条目可能仍在处理中。',
    'item.classification':    '分类信息',
    'item.tags':              '标签',
    'item.audience':          '目标受众',
    'item.ai_relevance':      'AI 相关度',
    'item.radar_score':       '雷达评分',
    'item.published':         '发布时间',
    'item.indexed':           '收录时间',
    'item.repository':        '代码仓库',
    'item.related_items':     '相关内容',

    // ── Digest page ────────────────────────────────────────────────────────
    'digest.week_of':         '本周',
    'digest.title':           '本周 AI Agent 与\n开发者工具动态',
    'digest.subtitle':        '精选新兴 Agent 框架、模型更新、研究进展、MCP 工具和开发者工作流排名简报。',
    'digest.items_curated':   '条精选内容',
    'digest.sections':        '个分类',
    'digest.ranked_by':       '按 AI 相关度和社区热度排名',
    'digest.editors_note':    '编辑说明',
    'digest.editors_text':    'AgentRadar 持续追踪 AI Agent、模型 API、MCP 工具、代码 Agent、研究进展和开发者基础设施领域的高价值动态。',
    'digest.in_this_digest':  '本期内容',
    'digest.this_week_label': '本周动态',
    'digest.top':             '前',
    'digest.item':            '条',
    'digest.items':           '条',

    // ── Search page ────────────────────────────────────────────────────────
    'search.title':           '搜索',
    'search.subtitle':        '来自 GitHub、HN 和博客的 AI 增强工具、项目和文章。',
    'search.placeholder':     '搜索 AgentRadar… 试试 "claude"、"mcp"、"rag"',
    'search.button':          '搜索',
    'search.results_for':     '条结果，关键词',
    'search.high_signal':     '条高价值内容',
    'search.high_signal_pl':  '条高价值内容',
    'search.sorted_by':       '排序方式',
    'search.no_results':      '未找到结果',
    'search.no_results_q':    '请尝试更宽泛的搜索词或移除部分筛选条件。',
    'search.no_results_f':    '请尝试调整筛选条件。',
    'search.active':          '已启用：',
    'search.clear_all':       '清除全部',
    'search.source_all':      '全部',
    'search.category_ph':     '分类',
    'search.sort_radar':      '综合匹配',
    'search.sort_relevance':  '最高相关度',
    'search.sort_newest':     '最新',
    'search.sort_stars':      'GitHub Stars 最多',
    'search.sort_discussed':  'HN 讨论最热',
    'search.sort_label_radar':     '雷达评分',
    'search.sort_label_newest':    '发布日期',
    'search.sort_label_relevance': 'AI 相关度',
    'search.sort_label_stars':     'GitHub Stars',
    'search.sort_label_discussed': 'HN 讨论热度',

    // ── Footer ─────────────────────────────────────────────────────────────
    'footer.built_with':      'AgentRadar — 基于 Next.js、Supabase 和 Claude 构建',
    'footer.built_by':        '作者',
  },
} as const

export type TranslationKey = keyof typeof translations.en
