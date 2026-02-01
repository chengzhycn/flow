import { isTauriEnv } from '../db/local'
import {
  fetchLocalSummaries,
  createLocalSummary,
  updateLocalSummary,
  deleteLocalSummary,
  getLocalSummaryById,
  getLocalSummaryByPeriod,
  getLLMSettings,
  saveLLMSettings,
  getScheduleSettings,
  saveScheduleSettings,
  getLastSummaryTime,
  setLastSummaryTime,
  type LocalWorkSummary,
  type LLMSettings,
  type ScheduleSettings,
  type SummaryType,
  DEFAULT_LLM_SETTINGS,
  DEFAULT_SCHEDULE_SETTINGS,
} from '../db/localSummaries'
import { triggerSync } from '../sync/SyncEngine'
import { supabase } from './supabase'

// 重新导出类型
export type { LLMSettings, ScheduleSettings, SummaryType }
export { DEFAULT_LLM_SETTINGS, DEFAULT_SCHEDULE_SETTINGS }

export type WorkSummary = {
  id: string
  user_id: string
  type: SummaryType
  period_start: string
  period_end: string
  content: string
  created_at: string
}

// 当前用户 ID 缓存
let currentUserId: string | null = null

export function setCurrentUserId(userId: string): void {
  currentUserId = userId
}

// ==================== 工作总结 API ====================

/**
 * 获取工作总结列表
 */
export async function fetchSummaries(
  userId: string,
  type?: SummaryType,
  limit?: number
): Promise<WorkSummary[]> {
  currentUserId = userId

  if (isTauriEnv()) {
    try {
      const localSummaries = await fetchLocalSummaries(userId, type, limit)
      return localSummaries.map(localToSummary)
    } catch (error) {
      console.error('[summaries] Failed to fetch local summaries:', error)
      return []
    }
  }

  // 回退到 Supabase
  try {
    let query = supabase
      .from('work_summaries')
      .select('*')
      .eq('user_id', userId)

    if (type) {
      query = query.eq('type', type)
    }

    query = query.order('period_start', { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query
    if (error) throw error
    return data ?? []
  } catch (error) {
    console.error('[summaries] Supabase fetch failed:', error)
    return []
  }
}

/**
 * 获取单个工作总结
 */
export async function getSummaryById(id: string): Promise<WorkSummary | null> {
  if (isTauriEnv()) {
    const local = await getLocalSummaryById(id)
    return local ? localToSummary(local) : null
  }

  const { data, error } = await supabase
    .from('work_summaries')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

/**
 * 根据时间段获取工作总结
 */
export async function getSummaryByPeriod(
  userId: string,
  type: SummaryType,
  periodStart: string
): Promise<WorkSummary | null> {
  if (isTauriEnv()) {
    const local = await getLocalSummaryByPeriod(userId, type, periodStart)
    return local ? localToSummary(local) : null
  }

  const { data, error } = await supabase
    .from('work_summaries')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('period_start', periodStart)
    .single()

  if (error) return null
  return data
}

/**
 * 创建工作总结
 */
export async function createSummary(
  userId: string,
  type: SummaryType,
  periodStart: string,
  periodEnd: string,
  content: string
): Promise<WorkSummary> {
  currentUserId = userId

  if (isTauriEnv()) {
    const localSummary = await createLocalSummary(userId, type, periodStart, periodEnd, content)
    triggerSyncIfPossible()
    return localToSummary(localSummary)
  }

  const { data, error } = await supabase
    .from('work_summaries')
    .insert({
      user_id: userId,
      type,
      period_start: periodStart,
      period_end: periodEnd,
      content,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 更新工作总结
 */
export async function updateSummary(id: string, content: string): Promise<WorkSummary> {
  if (isTauriEnv()) {
    const localSummary = await updateLocalSummary(id, content)
    if (!localSummary) throw new Error(`Summary ${id} not found`)
    triggerSyncIfPossible()
    return localToSummary(localSummary)
  }

  const { data, error } = await supabase
    .from('work_summaries')
    .update({ content })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 删除工作总结
 */
export async function deleteSummary(id: string): Promise<void> {
  if (isTauriEnv()) {
    await deleteLocalSummary(id)
    triggerSyncIfPossible()
    return
  }

  const { error } = await supabase.from('work_summaries').delete().eq('id', id)
  if (error) throw error
}

// ==================== 设置 API ====================

/**
 * 获取 LLM 设置
 */
export async function fetchLLMSettings(): Promise<LLMSettings> {
  if (isTauriEnv()) {
    return await getLLMSettings()
  }
  // Web 版本使用 localStorage
  const stored = localStorage.getItem('llm_settings')
  if (stored) {
    try {
      return { ...DEFAULT_LLM_SETTINGS, ...JSON.parse(stored) }
    } catch {
      return DEFAULT_LLM_SETTINGS
    }
  }
  return DEFAULT_LLM_SETTINGS
}

/**
 * 保存 LLM 设置
 */
export async function updateLLMSettings(settings: Partial<LLMSettings>): Promise<void> {
  if (isTauriEnv()) {
    await saveLLMSettings(settings)
    return
  }
  // Web 版本使用 localStorage
  const current = await fetchLLMSettings()
  localStorage.setItem('llm_settings', JSON.stringify({ ...current, ...settings }))
}

/**
 * 获取调度设置
 */
export async function fetchScheduleSettings(): Promise<ScheduleSettings> {
  if (isTauriEnv()) {
    return await getScheduleSettings()
  }
  // Web 版本使用 localStorage
  const stored = localStorage.getItem('schedule_settings')
  if (stored) {
    try {
      return { ...DEFAULT_SCHEDULE_SETTINGS, ...JSON.parse(stored) }
    } catch {
      return DEFAULT_SCHEDULE_SETTINGS
    }
  }
  return DEFAULT_SCHEDULE_SETTINGS
}

/**
 * 保存调度设置
 */
export async function updateScheduleSettings(settings: Partial<ScheduleSettings>): Promise<void> {
  if (isTauriEnv()) {
    await saveScheduleSettings(settings)
    return
  }
  // Web 版本使用 localStorage
  const current = await fetchScheduleSettings()
  localStorage.setItem('schedule_settings', JSON.stringify({ ...current, ...settings }))
}

/**
 * 获取上次总结生成时间
 */
export async function fetchLastSummaryTime(type: SummaryType): Promise<string | null> {
  if (isTauriEnv()) {
    return await getLastSummaryTime(type)
  }
  return localStorage.getItem(`last_summary_${type}`)
}

/**
 * 保存上次总结生成时间
 */
export async function updateLastSummaryTime(type: SummaryType, time: string): Promise<void> {
  if (isTauriEnv()) {
    await setLastSummaryTime(type, time)
    return
  }
  localStorage.setItem(`last_summary_${type}`, time)
}

// ==================== LLM API 调用 ====================

export type SummaryData = {
  periodStart: string
  periodEnd: string
  newTodos: string[]
  completedTodos: string[]
  inProgressTodos: string[]
  pomodoroCount: number
  totalMinutes: number
  projectStats: string
}

/**
 * 调用 LLM 生成总结
 */
export async function generateSummaryWithLLM(
  type: SummaryType,
  data: SummaryData
): Promise<string> {
  const settings = await fetchLLMSettings()

  if (!settings.apiKey) {
    throw new Error('请先在设置中配置 API Key')
  }

  const template = type === 'daily' ? settings.dailyPromptTemplate : settings.weeklyPromptTemplate
  const prompt = template
    .replace('{period_start}', data.periodStart)
    .replace('{period_end}', data.periodEnd)
    .replace('{new_todos}', data.newTodos.join('\n') || '无')
    .replace('{completed_todos}', data.completedTodos.join('\n') || '无')
    .replace('{in_progress_todos}', data.inProgressTodos.join('\n') || '无')
    .replace('{pomodoro_count}', String(data.pomodoroCount))
    .replace('{total_minutes}', String(data.totalMinutes))
    .replace('{project_stats}', data.projectStats || '无项目数据')

  const response = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LLM API 请求失败: ${response.status} - ${errorText}`)
  }

  const result = await response.json()
  return result.choices?.[0]?.message?.content || '生成失败'
}

/**
 * 测试 LLM 连接
 */
export async function testLLMConnection(): Promise<{ success: boolean; message: string }> {
  const settings = await fetchLLMSettings()

  if (!settings.apiKey) {
    return { success: false, message: '请先配置 API Key' }
  }

  try {
    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    })

    if (response.ok) {
      return { success: true, message: '连接成功' }
    } else {
      const errorText = await response.text()
      return { success: false, message: `连接失败: ${response.status} - ${errorText}` }
    }
  } catch (error) {
    return { success: false, message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
}

// 辅助函数
function localToSummary(local: LocalWorkSummary): WorkSummary {
  return {
    id: local.id,
    user_id: local.user_id,
    type: local.type,
    period_start: local.period_start,
    period_end: local.period_end,
    content: local.content,
    created_at: local.created_at,
  }
}

function triggerSyncIfPossible(): void {
  if (currentUserId) {
    triggerSync(currentUserId).catch((err) => {
      console.error('[summaries] Failed to trigger sync:', err)
    })
  }
}
