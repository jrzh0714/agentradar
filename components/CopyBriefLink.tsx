'use client'

import { useState } from 'react'
import { useLanguage } from '@/components/LanguageProvider'

/** Copy the canonical item permalink, with a selectable fallback if clipboard access fails. */
export function CopyBriefLink({ url }: { url: string }) {
  const { lang } = useLanguage()
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'manual'>('idle')
  const zh = lang === 'zh'

  async function copyLink() {
    setStatus('copying')
    try {
      await navigator.clipboard.writeText(url)
      setStatus('copied')
    } catch {
      setStatus('manual')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={copyLink}
        disabled={status === 'copying'}
        className="inline-flex min-h-10 items-center rounded-lg border border-zinc-700 px-4 py-2 font-mono text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        {zh ? '复制简报链接' : 'Copy brief link'}
      </button>
      <span role="status" aria-live="polite" className="text-xs text-zinc-500">
        {status === 'copied' && (zh ? '链接已复制。' : 'Link copied.')}
        {status === 'manual' && (zh ? '无法自动复制，请选中下方链接复制。' : 'Copy unavailable. Select the link below to copy it.')}
      </span>
      {status === 'manual' && (
        <input
          readOnly
          value={url}
          aria-label={zh ? '简报链接' : 'Brief permalink'}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
        />
      )}
    </div>
  )
}
