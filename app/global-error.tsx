'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
          <h1 className="mb-3 font-mono text-2xl font-bold">AgentRadar is temporarily unavailable</h1>
          <p className="mb-6 text-sm text-zinc-400">Please retry in a moment.</p>
          <button type="button" onClick={reset} className="rounded-lg border border-zinc-700 px-4 py-2 font-mono text-xs">
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
