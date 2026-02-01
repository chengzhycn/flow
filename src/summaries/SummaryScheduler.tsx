import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUser } from '@/auth/useUser'
import { fetchScheduleSettings, fetchLLMSettings } from '@/api/summaries'
import {
  shouldGenerateDailySummary,
  shouldGenerateWeeklySummary,
  generateSummary,
  getDailyPeriod,
  getWeeklyPeriod,
} from './SummaryGenerator'

// 检查间隔（毫秒）- 每分钟检查一次
const CHECK_INTERVAL = 60 * 1000

export function SummaryScheduler() {
  const { user } = useUser()
  const userId = user?.id
  const isGeneratingRef = useRef(false)

  // 获取调度设置
  const { data: scheduleSettings } = useQuery({
    queryKey: ['schedule-settings'],
    queryFn: fetchScheduleSettings,
    staleTime: CHECK_INTERVAL,
  })

  // 获取 LLM 设置（用于检查是否配置了 API Key）
  const { data: llmSettings } = useQuery({
    queryKey: ['llm-settings'],
    queryFn: fetchLLMSettings,
    staleTime: CHECK_INTERVAL,
  })

  useEffect(() => {
    if (!userId || !scheduleSettings || !llmSettings?.apiKey) {
      return
    }

    const checkAndGenerate = async () => {
      // 防止并发生成
      if (isGeneratingRef.current) {
        return
      }

      try {
        isGeneratingRef.current = true

        // 检查日总结
        const shouldDaily = await shouldGenerateDailySummary(
          scheduleSettings.dailySummaryTime,
          scheduleSettings.dailySummaryEnabled
        )

        if (shouldDaily) {
          console.log('[SummaryScheduler] Generating daily summary...')
          const { start, end } = getDailyPeriod()
          await generateSummary(userId, 'daily', start, end)
          console.log('[SummaryScheduler] Daily summary generated')
        }

        // 检查周总结
        const shouldWeekly = await shouldGenerateWeeklySummary(
          scheduleSettings.weeklySummaryDay,
          scheduleSettings.weeklySummaryTime,
          scheduleSettings.weeklySummaryEnabled
        )

        if (shouldWeekly) {
          console.log('[SummaryScheduler] Generating weekly summary...')
          const { start, end } = getWeeklyPeriod()
          await generateSummary(userId, 'weekly', start, end)
          console.log('[SummaryScheduler] Weekly summary generated')
        }
      } catch (error) {
        console.error('[SummaryScheduler] Failed to generate summary:', error)
      } finally {
        isGeneratingRef.current = false
      }
    }

    // 立即检查一次
    checkAndGenerate()

    // 定时检查
    const intervalId = setInterval(checkAndGenerate, CHECK_INTERVAL)

    return () => {
      clearInterval(intervalId)
    }
  }, [userId, scheduleSettings, llmSettings?.apiKey])

  // 这个组件不渲染任何内容
  return null
}
