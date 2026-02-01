import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/useUser'
import { fetchSummaries, fetchLLMSettings, type WorkSummary } from '@/api/summaries'
import { generateSummary, getDailyPeriod, getWeeklyPeriod } from './SummaryGenerator'
import { SummaryCard, EmptySummaryCard } from './SummaryCard'
import { SummaryHistoryTabs } from './SummaryHistory'

export function OverviewPage() {
  const { user } = useUser()
  const userId = user?.id ?? ''
  const queryClient = useQueryClient()
  const [generating, setGenerating] = useState<'daily' | 'weekly' | null>(null)

  // 获取最近的周总结
  const { data: weeklySummaries = [] } = useQuery({
    queryKey: ['summaries', userId, 'weekly', 1],
    queryFn: () => fetchSummaries(userId, 'weekly', 1),
    enabled: !!userId,
  })

  // 获取最近的日总结
  const { data: dailySummaries = [] } = useQuery({
    queryKey: ['summaries', userId, 'daily', 3],
    queryFn: () => fetchSummaries(userId, 'daily', 3),
    enabled: !!userId,
  })

  // 获取 LLM 设置
  const { data: llmSettings } = useQuery({
    queryKey: ['llm-settings'],
    queryFn: fetchLLMSettings,
  })

  const latestWeekly = weeklySummaries[0] as WorkSummary | undefined
  const latestDaily = dailySummaries[0] as WorkSummary | undefined
  const hasApiKey = !!llmSettings?.apiKey

  // 手动生成总结
  const handleGenerateSummary = async (type: 'daily' | 'weekly', forceRegenerate: boolean = false) => {
    if (!hasApiKey) {
      alert('请先在设置中配置 API Key')
      return
    }

    setGenerating(type)
    try {
      const { start, end } = type === 'daily' ? getDailyPeriod() : getWeeklyPeriod()
      const result = await generateSummary(userId, type, start, end, forceRegenerate)
      
      // 如果已存在且不是强制重新生成，询问用户是否要重新生成
      if (!result.isNew && !forceRegenerate) {
        const confirmRegenerate = window.confirm(`${result.message}，是否重新生成？`)
        if (confirmRegenerate) {
          setGenerating(type)
          await generateSummary(userId, type, start, end, true)
        }
      }
      
      // 刷新数据
      queryClient.invalidateQueries({ queryKey: ['summaries'] })
    } catch (error) {
      console.error('Failed to generate summary:', error)
      alert(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">工作概览</h1>
        {!hasApiKey && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-warning)]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>请先在设置中配置 API Key</span>
          </div>
        )}
      </div>

      {/* 最近总结快速视图 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 最近周总结 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium text-[var(--color-text)]">最近周总结</h2>
            <button
              type="button"
              onClick={() => handleGenerateSummary('weekly')}
              disabled={generating !== null || !hasApiKey}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-sm font-medium hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating === 'weekly' ? '生成中...' : '生成本周'}
            </button>
          </div>
          {latestWeekly ? (
            <SummaryCard summary={latestWeekly} />
          ) : (
            <EmptySummaryCard type="weekly" />
          )}
        </section>

        {/* 最近日总结 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium text-[var(--color-text)]">最近日总结</h2>
            <button
              type="button"
              onClick={() => handleGenerateSummary('daily')}
              disabled={generating !== null || !hasApiKey}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-sm font-medium hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating === 'daily' ? '生成中...' : '生成今日'}
            </button>
          </div>
          {latestDaily ? (
            <SummaryCard summary={latestDaily} />
          ) : (
            <EmptySummaryCard type="daily" />
          )}
        </section>
      </div>

      {/* 历史记录 */}
      <section>
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-4">历史记录</h2>
        <SummaryHistoryTabs />
      </section>
    </div>
  )
}
