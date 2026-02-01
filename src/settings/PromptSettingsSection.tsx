import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchLLMSettings,
  updateLLMSettings,
  DEFAULT_LLM_SETTINGS,
  type LLMSettings,
} from '@/api/summaries'

export function PromptSettingsSection() {
  const queryClient = useQueryClient()
  const [expandedPrompt, setExpandedPrompt] = useState<'daily' | 'weekly' | null>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['llm-settings'],
    queryFn: fetchLLMSettings,
  })

  const mutation = useMutation({
    mutationFn: (newSettings: Partial<LLMSettings>) => updateLLMSettings(newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-settings'] })
    },
  })

  const handleChange = (key: 'dailyPromptTemplate' | 'weeklyPromptTemplate', value: string) => {
    mutation.mutate({ [key]: value })
  }

  const handleResetToDefault = (key: 'dailyPromptTemplate' | 'weeklyPromptTemplate') => {
    mutation.mutate({ [key]: DEFAULT_LLM_SETTINGS[key] })
  }

  if (isLoading || !settings) {
    return (
      <section>
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">Prompt 模板</h2>
        <p className="text-sm text-[var(--color-text-muted)]">加载中...</p>
      </section>
    )
  }

  const variables = [
    { name: '{period_start}', desc: '时间段开始日期' },
    { name: '{period_end}', desc: '时间段结束日期' },
    { name: '{new_todos}', desc: '新建任务列表' },
    { name: '{completed_todos}', desc: '已完成任务列表' },
    { name: '{in_progress_todos}', desc: '进行中任务列表' },
    { name: '{pomodoro_count}', desc: '番茄钟完成数量' },
    { name: '{total_minutes}', desc: '总工作时长(分钟)' },
    { name: '{project_stats}', desc: '项目进度统计' },
  ]

  return (
    <section>
      <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">Prompt 模板</h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        自定义 AI 生成总结时使用的提示词模板。
      </p>

      <div className="bg-[var(--color-bg-elevated)] rounded-lg p-4 space-y-4">
        {/* 可用变量说明 */}
        <div>
          <p className="text-sm font-medium text-[var(--color-text)] mb-2">可用变量</p>
          <div className="flex flex-wrap gap-2">
            {variables.map((v) => (
              <span
                key={v.name}
                title={v.desc}
                className="px-2 py-1 rounded bg-[var(--color-bg)] text-xs text-[var(--color-text-muted)] font-mono cursor-help"
              >
                {v.name}
              </span>
            ))}
          </div>
        </div>

        {/* 日总结模板 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[var(--color-text)]">日总结模板</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExpandedPrompt(expandedPrompt === 'daily' ? null : 'daily')}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                {expandedPrompt === 'daily' ? '收起' : '展开编辑'}
              </button>
              <button
                type="button"
                onClick={() => handleResetToDefault('dailyPromptTemplate')}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                恢复默认
              </button>
            </div>
          </div>
          {expandedPrompt === 'daily' ? (
            <textarea
              value={settings.dailyPromptTemplate}
              onChange={(e) => handleChange('dailyPromptTemplate', e.target.value)}
              rows={12}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent resize-y"
            />
          ) : (
            <div className="px-3 py-2 rounded-lg bg-[var(--color-bg)] text-sm text-[var(--color-text-muted)] line-clamp-2 font-mono">
              {settings.dailyPromptTemplate.slice(0, 100)}...
            </div>
          )}
        </div>

        {/* 周总结模板 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[var(--color-text)]">周总结模板</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExpandedPrompt(expandedPrompt === 'weekly' ? null : 'weekly')}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                {expandedPrompt === 'weekly' ? '收起' : '展开编辑'}
              </button>
              <button
                type="button"
                onClick={() => handleResetToDefault('weeklyPromptTemplate')}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                恢复默认
              </button>
            </div>
          </div>
          {expandedPrompt === 'weekly' ? (
            <textarea
              value={settings.weeklyPromptTemplate}
              onChange={(e) => handleChange('weeklyPromptTemplate', e.target.value)}
              rows={12}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent resize-y"
            />
          ) : (
            <div className="px-3 py-2 rounded-lg bg-[var(--color-bg)] text-sm text-[var(--color-text-muted)] line-clamp-2 font-mono">
              {settings.weeklyPromptTemplate.slice(0, 100)}...
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
