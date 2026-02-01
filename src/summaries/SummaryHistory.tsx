import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUser } from '@/auth/useUser'
import { fetchSummaries, type SummaryType } from '@/api/summaries'
import { SummaryCard, EmptySummaryCard } from './SummaryCard'

type SummaryHistoryProps = {
  type: SummaryType
}

export function SummaryHistory({ type }: SummaryHistoryProps) {
  const { user } = useUser()
  const userId = user?.id ?? ''
  const [showAll, setShowAll] = useState(false)

  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ['summaries', userId, type],
    queryFn: () => fetchSummaries(userId, type),
    enabled: !!userId,
  })

  const typeLabel = type === 'daily' ? '日总结' : '周总结'
  const displaySummaries = showAll ? summaries : summaries.slice(0, 5)

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-[var(--color-text)]">{typeLabel}历史</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[var(--color-bg-elevated)] rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-[var(--color-text)]">{typeLabel}历史</h3>
        {summaries.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            {showAll ? '收起' : `查看全部 (${summaries.length})`}
          </button>
        )}
      </div>

      {summaries.length === 0 ? (
        <EmptySummaryCard type={type} />
      ) : (
        <div className="space-y-3">
          {displaySummaries.map((summary) => (
            <SummaryCard key={summary.id} summary={summary} />
          ))}
        </div>
      )}
    </div>
  )
}

// 组合日总结和周总结历史的选项卡组件
export function SummaryHistoryTabs() {
  const [activeTab, setActiveTab] = useState<SummaryType>('daily')

  return (
    <div className="space-y-4">
      {/* 选项卡 */}
      <div className="flex gap-2 border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'daily'
              ? 'text-[var(--color-accent)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          日总结
          {activeTab === 'daily' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('weekly')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'weekly'
              ? 'text-[var(--color-accent)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          周总结
          {activeTab === 'weekly' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)]" />
          )}
        </button>
      </div>

      {/* 内容 */}
      <SummaryHistory type={activeTab} />
    </div>
  )
}
