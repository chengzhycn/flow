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

// 任务四象限类型
export type QuadrantType = 'important_urgent' | 'important_not_urgent' | 'not_important_urgent' | 'not_important_not_urgent'

// 里程碑进度数据
export type MilestoneProgress = {
  projectName: string
  milestoneName: string
  dueDate: string | null
  completed: boolean
  totalTasks: number
  completedTasks: number
  isOverdue: boolean
}

// 分类任务数据
export type CategorizedTodo = {
  title: string
  quadrant: QuadrantType | null
  dueDate: string | null
  projectName: string | null
  milestoneName: string | null
}

export type SummaryData = {
  periodStart: string
  periodEnd: string
  // 任务统计
  newTodos: string[]
  completedTodos: CategorizedTodo[]
  inProgressTodos: CategorizedTodo[]
  overdueTodos: CategorizedTodo[]        // 超期未完成任务
  upcomingDueTodos: CategorizedTodo[]    // 即将到期任务（下一阶段重点）
  // 番茄钟数据
  pomodoroCount: number
  totalMinutes: number
  // 项目和里程碑
  projectStats: string
  milestoneProgress: MilestoneProgress[] // 里程碑进度
  overdueMilestones: MilestoneProgress[] // 超期未完成里程碑
  // 四象限分析
  quadrantSummary: {
    important_urgent: CategorizedTodo[]
    important_not_urgent: CategorizedTodo[]
    not_important_urgent: CategorizedTodo[]
    not_important_not_urgent: CategorizedTodo[]
    unclassified: CategorizedTodo[]
  }
}

/**
 * 格式化任务为字符串
 */
function formatTodo(todo: CategorizedTodo): string {
  const parts = [`- ${todo.title}`]
  if (todo.projectName) {
    parts.push(`[项目: ${todo.projectName}]`)
  }
  if (todo.milestoneName) {
    parts.push(`[里程碑: ${todo.milestoneName}]`)
  }
  if (todo.dueDate) {
    parts.push(`[截止: ${new Date(todo.dueDate).toLocaleDateString('zh-CN')}]`)
  }
  if (todo.quadrant) {
    const quadrantNames: Record<QuadrantType, string> = {
      important_urgent: '重要且紧急',
      important_not_urgent: '重要不紧急',
      not_important_urgent: '不重要但紧急',
      not_important_not_urgent: '不重要不紧急',
    }
    parts.push(`[${quadrantNames[todo.quadrant]}]`)
  }
  return parts.join(' ')
}

/**
 * 格式化里程碑进度为字符串
 */
function formatMilestone(m: MilestoneProgress): string {
  const percentage = m.totalTasks > 0 ? Math.round((m.completedTasks / m.totalTasks) * 100) : 0
  const status = m.completed ? '✓ 已完成' : m.isOverdue ? '⚠ 超期' : '进行中'
  const dueStr = m.dueDate ? `截止: ${new Date(m.dueDate).toLocaleDateString('zh-CN')}` : '无截止日期'
  return `- ${m.projectName} / ${m.milestoneName}: ${m.completedTasks}/${m.totalTasks} (${percentage}%) [${status}] [${dueStr}]`
}

/**
 * 格式化四象限数据为字符串
 */
function formatQuadrantSummary(data: SummaryData): string {
  const sections: string[] = []
  
  const { quadrantSummary } = data
  
  if (quadrantSummary.important_urgent.length > 0) {
    sections.push(`### 重要且紧急（立即处理）\n${quadrantSummary.important_urgent.map(formatTodo).join('\n')}`)
  }
  
  if (quadrantSummary.important_not_urgent.length > 0) {
    sections.push(`### 重要不紧急（计划执行）\n${quadrantSummary.important_not_urgent.map(formatTodo).join('\n')}`)
  }
  
  if (quadrantSummary.not_important_urgent.length > 0) {
    sections.push(`### 不重要但紧急（考虑委派）\n${quadrantSummary.not_important_urgent.map(formatTodo).join('\n')}`)
  }
  
  if (quadrantSummary.not_important_not_urgent.length > 0) {
    sections.push(`### 不重要不紧急（适时处理）\n${quadrantSummary.not_important_not_urgent.map(formatTodo).join('\n')}`)
  }
  
  if (quadrantSummary.unclassified.length > 0) {
    sections.push(`### 未分类\n${quadrantSummary.unclassified.map(formatTodo).join('\n')}`)
  }
  
  return sections.join('\n\n') || '无待处理任务'
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
  
  // 格式化任务列表
  const completedTodosStr = data.completedTodos.length > 0 
    ? data.completedTodos.map(formatTodo).join('\n') 
    : '无'
  const inProgressTodosStr = data.inProgressTodos.length > 0 
    ? data.inProgressTodos.map(formatTodo).join('\n') 
    : '无'
  const overdueTodosStr = data.overdueTodos.length > 0 
    ? data.overdueTodos.map(formatTodo).join('\n') 
    : '无'
  const upcomingDueTodosStr = data.upcomingDueTodos.length > 0 
    ? data.upcomingDueTodos.map(formatTodo).join('\n') 
    : '无'
  
  // 格式化里程碑数据
  const milestoneProgressStr = data.milestoneProgress.length > 0 
    ? data.milestoneProgress.map(formatMilestone).join('\n') 
    : '无'
  const overdueMilestonesStr = data.overdueMilestones.length > 0 
    ? data.overdueMilestones.map(formatMilestone).join('\n') 
    : '无'
  
  // 格式化四象限数据
  const quadrantSummaryStr = formatQuadrantSummary(data)
  
  const prompt = template
    .replace('{period_start}', data.periodStart)
    .replace('{period_end}', data.periodEnd)
    .replace('{new_todos}', data.newTodos.join('\n') || '无')
    .replace('{completed_todos}', completedTodosStr)
    .replace('{in_progress_todos}', inProgressTodosStr)
    .replace('{overdue_todos}', overdueTodosStr)
    .replace('{upcoming_due_todos}', upcomingDueTodosStr)
    .replace('{pomodoro_count}', String(data.pomodoroCount))
    .replace('{total_minutes}', String(data.totalMinutes))
    .replace('{project_stats}', data.projectStats || '无项目数据')
    .replace('{milestone_progress}', milestoneProgressStr)
    .replace('{overdue_milestones}', overdueMilestonesStr)
    .replace('{quadrant_summary}', quadrantSummaryStr)

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
