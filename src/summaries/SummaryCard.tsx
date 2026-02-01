import { useState } from 'react'
import type { WorkSummary } from '@/api/summaries'

type SummaryCardProps = {
  summary: WorkSummary
  onRefresh?: () => void
}

export function SummaryCard({ summary }: SummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
  }

  const typeLabel = summary.type === 'daily' ? '日总结' : '周总结'
  const typeColor = summary.type === 'daily' 
    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
    : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'

  return (
    <div className="bg-[var(--color-bg-elevated)] rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--color-bg)]/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColor}`}>
            {typeLabel}
          </span>
          <span className="text-sm text-[var(--color-text)]">
            {formatDate(summary.period_start)}
            {summary.type === 'weekly' && ` - ${formatDate(summary.period_end)}`}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--color-text)]">
            {/* 简单渲染 Markdown 内容 */}
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {summary.content.split('\n').map((line, index) => {
                // 处理标题
                if (line.startsWith('### ')) {
                  return (
                    <h4 key={index} className="text-base font-medium mt-4 mb-2 text-[var(--color-text)]">
                      {line.replace('### ', '')}
                    </h4>
                  )
                }
                if (line.startsWith('## ')) {
                  return (
                    <h3 key={index} className="text-lg font-medium mt-4 mb-2 text-[var(--color-text)]">
                      {line.replace('## ', '')}
                    </h3>
                  )
                }
                if (line.startsWith('# ')) {
                  return (
                    <h2 key={index} className="text-xl font-semibold mt-4 mb-2 text-[var(--color-text)]">
                      {line.replace('# ', '')}
                    </h2>
                  )
                }
                // 处理列表项
                if (line.startsWith('- ') || line.startsWith('* ')) {
                  return (
                    <div key={index} className="flex items-start gap-2 ml-2">
                      <span className="text-[var(--color-text-muted)]">•</span>
                      <span>{line.replace(/^[-*] /, '')}</span>
                    </div>
                  )
                }
                // 处理数字列表
                const numberedMatch = line.match(/^(\d+)\.\s+(.+)/)
                if (numberedMatch) {
                  return (
                    <div key={index} className="flex items-start gap-2 ml-2">
                      <span className="text-[var(--color-text-muted)] min-w-[1.5em]">{numberedMatch[1]}.</span>
                      <span>{numberedMatch[2]}</span>
                    </div>
                  )
                }
                // 空行
                if (!line.trim()) {
                  return <div key={index} className="h-2" />
                }
                // 普通文本
                return (
                  <p key={index} className="text-[var(--color-text)]">
                    {line}
                  </p>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 空状态卡片
export function EmptySummaryCard({ type }: { type: 'daily' | 'weekly' }) {
  const typeLabel = type === 'daily' ? '日总结' : '周总结'

  return (
    <div className="bg-[var(--color-bg-elevated)] rounded-lg p-6 text-center">
      <div className="text-[var(--color-text-muted)] mb-2">
        <svg className="w-12 h-12 mx-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">暂无{typeLabel}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">
        请在设置中配置 AI 总结并启用定时生成
      </p>
    </div>
  )
}
