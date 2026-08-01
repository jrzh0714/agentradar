'use client'

import { useState } from 'react'
import { T, useT } from '@/components/T'

type Status = 'idle' | 'loading' | 'success' | 'error'

export function SubscribeForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const t = useT()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'loading') return
    setStatus('loading')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'digest' }),
      })
      setStatus(res.ok ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
        <T k="digest.subscribe_success" />
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('digest.subscribe_placeholder')}
        className="w-64 max-w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="rounded-lg border border-indigo-700 bg-indigo-950/40 px-4 py-2 font-mono text-xs text-indigo-600 transition-colors hover:border-indigo-500 disabled:opacity-50 dark:text-indigo-300"
      >
        {status === 'loading' ? '…' : <T k="digest.subscribe_button" />}
      </button>
      {status === 'error' && (
        <span className="font-mono text-xs text-rose-600 dark:text-rose-400">
          <T k="digest.subscribe_error" />
        </span>
      )}
    </form>
  )
}
