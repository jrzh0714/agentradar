'use client'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-rose-500">Temporary error</p>
      <h1 className="mb-3 font-mono text-2xl font-bold text-zinc-100">AgentRadar could not load this page</h1>
      <p className="mb-6 text-sm text-zinc-400">The issue has been contained. You can retry without losing your place.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 font-mono text-xs text-zinc-200 hover:border-zinc-500"
      >
        Try again
      </button>
    </main>
  )
}
