import type { Metadata } from 'next'
import Link from 'next/link'
import { isWaitlistEnabled } from '@/lib/waitlist'

export const metadata: Metadata = {
  title: 'Privacy | AgentRadar',
  robots: { index: false, follow: false },
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  const waitlistEnabled = isWaitlistEnabled()

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16 text-zinc-300">
      <Link href="/digest" className="font-mono text-xs text-zinc-500 hover:text-zinc-200">
        ← Back to digest
      </Link>
      <h1 className="mt-8 text-3xl font-semibold text-zinc-100">Privacy notice</h1>
      <div className="mt-8 space-y-5 text-sm leading-7 text-zinc-400">
        {waitlistEnabled ? (
          <p>
            Digest waitlist collection is currently enabled. If you submit the form,
            AgentRadar stores your email address in Supabase only to measure interest.
            Email delivery is not active today.
          </p>
        ) : (
          <p>
            Digest waitlist collection is currently disabled. The signup API rejects
            requests, and AgentRadar does not accept new waitlist addresses.
          </p>
        )}
        <p>
          Waitlist collection is opt-in through the server-only <code>WAITLIST_ENABLED</code>{' '}
          setting and defaults to off. Existing waitlist addresses, if any, remain private
          in Supabase and are not sold. Vercel provides hosting and aggregate web analytics.
        </p>
        <p>
          Before any email is sent, AgentRadar will add double opt-in, unsubscribe handling,
          a retention policy, and a private contact method. This notice will be updated first,
          and the waitlist should remain disabled until that review is complete.
        </p>
      </div>
    </main>
  )
}
