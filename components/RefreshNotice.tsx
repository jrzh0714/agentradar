import Link from 'next/link'
import { getPublicRefreshStatus } from '@/lib/db/pipeline-runs'
import { TranslatedText } from '@/components/TranslatedText'

export async function RefreshNotice() {
  const status = await getPublicRefreshStatus()
  return (
    <details className="refresh-notice text-sm text-zinc-400">
      <summary className="flex min-h-10 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={`h-1.5 w-1.5 rounded-full ${status.state === 'current' ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-amber-600 dark:bg-amber-400'}`} aria-hidden="true" />
        <TranslatedText en={status.state === 'current' ? 'AI processing complete' : status.state === 'delayed' ? 'Updates delayed' : 'Freshness unconfirmed'} zh={status.state === 'current' ? 'AI 处理已完成' : status.state === 'delayed' ? '更新延迟' : '时效未确认'} />
        {status.lastCompletedAt && <time dateTime={status.lastCompletedAt} className="text-zinc-500">{new Date(status.lastCompletedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC</time>}
        <span className="ml-auto text-zinc-500"><TranslatedText en="Coverage details +" zh="覆盖详情 +" /></span>
      </summary>
      <div className="border-t border-zinc-800 pb-3 pt-3">
      <TranslatedText as="p"
        en={status.state === 'current' ? 'AI processing completed. Individual source coverage may be partial; selections are algorithmic, not independently tested.' : status.state === 'delayed' ? 'Updates are delayed. Browse the existing collection; it may not reflect the latest releases.' : 'Freshness is unconfirmed. Browse the existing collection and check the original sources.'}
        zh={status.state === 'current' ? 'AI 处理已完成，但各来源覆盖可能不完整。内容由算法筛选，未经独立实测。' : status.state === 'delayed' ? '内容更新延迟。您仍可浏览已有内容，但其中可能不包含最新发布。' : '暂时无法确认内容时效。请浏览已有内容并核对原始来源。'} />
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {status.lastCompletedAt && <span><TranslatedText en="Last completed AI run (UTC):" zh="上次完成 AI 处理（UTC）：" /> <time dateTime={status.lastCompletedAt}>{new Date(status.lastCompletedAt).toISOString().replace('T', ' ').slice(0, 16)}</time></span>}
        <Link href="/status" className="underline underline-offset-2"><TranslatedText en="Data status" zh="数据状态" /></Link>
      </div>
      </div>
    </details>
  )
}
