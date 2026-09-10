import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-zinc-600">404</p>
      <h1 className="mb-3 font-mono text-2xl font-bold text-zinc-100">Page not found</h1>
      <p className="mb-6 text-sm text-zinc-400">The page may have moved or never existed.</p>
      <Link href="/" className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 font-mono text-xs text-zinc-200 hover:border-zinc-500">
        Back to AgentRadar
      </Link>
    </main>
  )
}
