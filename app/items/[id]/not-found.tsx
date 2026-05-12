import Link from 'next/link'

export default function ItemNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6">
      <div className="text-center">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-zinc-600">404</p>
        <h1 className="mb-4 font-mono text-2xl font-bold text-zinc-100">Item not found</h1>
        <p className="mb-8 text-sm text-zinc-500">
          This item may have been removed or the link is incorrect.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 font-mono text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            ← back to feed
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-4 py-2 font-mono text-xs text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
          >
            search items
          </Link>
        </div>
      </div>
    </div>
  )
}
