'use client'

import { useEffect, useState } from 'react'

export function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-8 right-8 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/90 font-mono text-sm text-zinc-400 backdrop-blur-sm transition-all hover:border-zinc-500 hover:text-zinc-200"
      aria-label="Back to top"
    >
      ↑
    </button>
  )
}
