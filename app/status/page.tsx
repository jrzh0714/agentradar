export const dynamic = 'force-dynamic'

import Link from 'next/link'
import type { Metadata } from 'next'
import { ThemeToggle } from '@/components/ThemeToggle'
import { getRecentPipelineRuns } from '@/lib/db/pipeline-runs'
import { formatRelativeDate } from '@/lib/utils'
import type { PipelineRun } from '@/lib/db/pipeline-runs'

export const metadata: Metadata = {
  title: 'Pipeline Status — AgentRadar',
  description: 'Daily pipeline health and run history for AgentRadar.',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

function StatusDot({ success }: { success: boolean }) {
  return (
    <span
      className={[
        'inline-block h-2 w-2 rounded-full',
        success
          ? 'bg-emerald-500 shadow-[0_0_6px_1px_rgba(52,211,153,0.5)]'
          : 'bg-red-500 shadow-[0_0_6px_1px_rgba(239,68,68,0.5)]',
      ].join(' ')}
    />
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StatusPage() {
  const runs = await getRecentPipelineRuns(14)

  const lastRun = runs[0] ?? null
  const last7 = runs.slice(0, 7)
  const successRate = last7.length
    ? Math.round((last7.filter((r) => r.success).length / last7.length) * 100)
    : null

  const overallHealthy =
    lastRun?.success !== false && (successRate === null || successRate >= 70)

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-mono text-sm font-bold tracking-tight text-zinc-100 transition-colors hover:text-zinc-200 dark:hover:text-white">
              AgentRadar
            </Link>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-500">
              beta
            </span>
          </div>
          <nav className="flex items-center gap-6 font-mono text-xs text-zinc-500">
            <Link href="/" className="transition-colors hover:text-zinc-200">home</Link>
            <Link href="/search" className="transition-colors hover:text-zinc-200">search</Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">

        {/* ── Page title ──────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <StatusDot success={overallHealthy} />
            <h1 className="font-mono text-xl font-semibold text-zinc-100">
              Pipeline Status
            </h1>
          </div>
          <p className="font-mono text-xs text-zinc-500">
            Daily pipeline runs — ingestion → enrichment → ranking → translation
          </p>
        </div>

        {/* ── Summary cards ───────────────────────────────────────────────── */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Last run"
            value={lastRun ? formatRelativeDate(lastRun.ran_at) ?? '—' : 'Never'}
            ok={lastRun?.success ?? null}
          />
          <StatCard
            label="7-day success"
            value={successRate !== null ? `${successRate}%` : '—'}
            ok={successRate !== null ? successRate >= 80 : null}
          />
          <StatCard
            label="Last ingest"
            value={
              lastRun
                ? `+${lastRun.ingested_github + lastRun.ingested_hn + lastRun.ingested_rss}`
                : '—'
            }
            ok={null}
          />
          <StatCard
            label="Last enriched"
            value={lastRun ? String(lastRun.enriched_count) : '—'}
            ok={null}
          />
        </div>

        {/* ── Run history table ────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-zinc-600">
            Last 14 Runs
          </h2>

          {runs.length === 0 ? (
            <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-zinc-800">
              <p className="font-mono text-xs text-zinc-600">
                No runs logged yet — the first cron run will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-zinc-600">
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">New items</th>
                    <th className="px-4 py-3 font-medium">Enriched</th>
                    <th className="px-4 py-3 font-medium">Ranked</th>
                    <th className="px-4 py-3 font-medium">Translated</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="px-4 py-3 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {runs.map((run) => (
                    <RunRow key={run.id} run={run} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Cron schedule ────────────────────────────────────────────────── */}
        <section className="mt-10">
          <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-zinc-600">
            Cron Schedule
          </h2>
          <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <CronRow name="Daily refresh" schedule="Every day at 08:00 UTC" endpoint="/api/refresh/daily" />
            <CronRow name="GitHub star refresh" schedule="Every Sunday at 06:00 UTC" endpoint="/api/refresh/stars" />
          </div>
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="mx-auto max-w-4xl px-6">
          <span className="font-mono text-xs text-zinc-600">
            AgentRadar — built with Next.js, Supabase, and Claude
          </span>
        </div>
      </footer>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  ok,
}: {
  label: string
  value: string
  ok: boolean | null
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">{label}</p>
      <p
        className={[
          'font-mono text-lg font-semibold tabular-nums',
          ok === true ? 'text-emerald-400' : ok === false ? 'text-red-400' : 'text-zinc-100',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  )
}

function RunRow({ run }: { run: PipelineRun }) {
  const total = run.ingested_github + run.ingested_hn + run.ingested_rss
  const dateLabel = formatRelativeDate(run.ran_at)

  return (
    <tr className={['transition-colors', !run.success && 'bg-red-950/20'].join(' ')}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusDot success={run.success} />
          <span className={run.success ? 'text-emerald-400' : 'text-red-400'}>
            {run.success ? 'ok' : 'fail'}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-zinc-400">{dateLabel ?? run.ran_at.slice(0, 16).replace('T', ' ')}</td>
      <td className="px-4 py-3 tabular-nums text-zinc-300">
        {total > 0 ? `+${total}` : '—'}
        {total > 0 && (
          <span className="ml-1 text-zinc-600">
            ({run.ingested_github}gh · {run.ingested_hn}hn · {run.ingested_rss}rss)
          </span>
        )}
      </td>
      <td className="px-4 py-3 tabular-nums text-zinc-300">{run.enriched_count}</td>
      <td className="px-4 py-3 tabular-nums text-zinc-300">{run.ranked_count}</td>
      <td className="px-4 py-3 tabular-nums text-zinc-300">{run.translated_count}</td>
      <td className="px-4 py-3 tabular-nums text-zinc-400">{formatDuration(run.duration_ms)}</td>
      <td className="max-w-[200px] px-4 py-3">
        {run.error ? (
          <span className="truncate text-red-400" title={run.error}>
            {run.error.slice(0, 40)}{run.error.length > 40 ? '…' : ''}
          </span>
        ) : (
          <span className="text-zinc-700">—</span>
        )}
      </td>
    </tr>
  )
}

function CronRow({
  name,
  schedule,
  endpoint,
}: {
  name: string
  schedule: string
  endpoint: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="w-40 shrink-0 font-mono text-xs text-zinc-300">{name}</span>
      <span className="font-mono text-xs text-zinc-500">{schedule}</span>
      <code className="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
        {endpoint}
      </code>
    </div>
  )
}
