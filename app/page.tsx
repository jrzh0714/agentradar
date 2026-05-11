export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold tracking-tight text-zinc-100">
              AgentRadar
            </span>
            <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400">
              beta
            </span>
          </div>
          <nav className="flex items-center gap-6 font-mono text-sm text-zinc-400">
            <a href="/search" className="transition-colors hover:text-zinc-100">
              search
            </a>
            <a href="/digest" className="transition-colors hover:text-zinc-100">
              digest
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <div className="mb-16">
          <h1 className="mb-4 font-mono text-3xl font-semibold tracking-tight text-zinc-100">
            AI tool discovery,
            <br />
            ranked for developers.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-zinc-400">
            AgentRadar tracks GitHub repos, Hacker News discussions, and technical blogs for
            emerging GenAI tools, agent frameworks, and developer workflows — then summarizes what
            matters and why.
          </p>
        </div>

        <div className="mb-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: 'GitHub',
              description: 'Repos matching agent, LLM, RAG, and MCP queries',
              indicator: 'bg-emerald-500',
            },
            {
              label: 'Hacker News',
              description: 'Stories and discussions from the AI engineering community',
              indicator: 'bg-orange-500',
            },
            {
              label: 'RSS',
              description: 'OpenAI, Anthropic, LangChain, Vercel, Simon Willison, and more',
              indicator: 'bg-sky-500',
            },
          ].map((source) => (
            <div
              key={source.label}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${source.indicator}`} />
                <span className="font-mono text-sm font-medium text-zinc-100">{source.label}</span>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400">{source.description}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-8 text-center">
          <p className="mb-1 font-mono text-sm text-zinc-400">Ingestion pipeline coming in Phase 2.</p>
          <p className="font-mono text-xs text-zinc-600">
            Feed will appear here once items are ingested and ranked.
          </p>
        </div>
      </main>

      <footer className="border-t border-zinc-800 px-6 py-6">
        <div className="mx-auto max-w-5xl font-mono text-xs text-zinc-600">
          AgentRadar — built with Next.js, Supabase, and Claude
        </div>
      </footer>
    </div>
  )
}
