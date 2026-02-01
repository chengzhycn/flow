import { fetchTodos } from '@/api/todos'
import { fetchPomodoroSessions } from '@/api/pomodoro'
import { fetchProjects, fetchProjectTaskStats } from '@/api/projects'
import {
  createSummary,
  updateSummary,
  getSummaryByPeriod,
  generateSummaryWithLLM,
  fetchLastSummaryTime,
  updateLastSummaryTime,
  type SummaryData,
  type SummaryType,
} from '@/api/summaries'

/**
 * 获取日期范围的开始和结束时间
 */
export function getDailyPeriod(date: Date = new Date()): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

/**
 * 获取一周的时间范围（周一到周日）
 */
export function getWeeklyPeriod(date: Date = new Date()): { start: string; end: string } {
  const currentDay = date.getDay()
  // 计算本周一的日期（周日为0，需要特殊处理）
  const daysToMonday = currentDay === 0 ? 6 : currentDay - 1
  const monday = new Date(date)
  monday.setDate(date.getDate() - daysToMonday)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  return {
    start: monday.toISOString(),
    end: sunday.toISOString(),
  }
}

/**
 * 格式化日期为可读格式
 */
export function formatDateRange(start: string, end: string): { startStr: string; endStr: string } {
  const startDate = new Date(start)
  const endDate = new Date(end)

  const formatDate = (d: Date) => {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  }

  return {
    startStr: formatDate(startDate),
    endStr: formatDate(endDate),
  }
}

/**
 * 收集指定时间段的工作数据
 */
export async function collectSummaryData(
  userId: string,
  periodStart: string,
  periodEnd: string
): Promise<SummaryData> {
  // 获取所有任务
  const todos = await fetchTodos(userId)

  // 筛选时间段内的任务
  const periodStartDate = new Date(periodStart)
  const periodEndDate = new Date(periodEnd)

  const newTodos: string[] = []
  const completedTodos: string[] = []
  const inProgressTodos: string[] = []

  for (const todo of todos) {
    const createdAt = new Date(todo.created_at)
    const updatedAt = new Date(todo.updated_at)

    // 在时间段内创建的任务
    if (createdAt >= periodStartDate && createdAt <= periodEndDate) {
      newTodos.push(`- ${todo.title}`)
    }

    // 在时间段内完成的任务
    if (todo.completed && updatedAt >= periodStartDate && updatedAt <= periodEndDate) {
      completedTodos.push(`- ${todo.title}`)
    }

    // 进行中的任务（未完成且未删除）
    if (!todo.completed && !todo.deleted_at) {
      inProgressTodos.push(`- ${todo.title}`)
    }
  }

  // 获取番茄钟数据
  const pomodoroSessions = await fetchPomodoroSessions(userId, periodStart, periodEnd)
  const completedWorkSessions = pomodoroSessions.filter((s) => s.completed && s.type === 'work')
  const pomodoroCount = completedWorkSessions.length
  const totalMinutes = completedWorkSessions.reduce((sum, s) => sum + s.duration_minutes, 0)

  // 获取项目统计
  const projects = await fetchProjects(userId)
  const projectStatsLines: string[] = []

  for (const project of projects) {
    const stats = await fetchProjectTaskStats(project.id)
    if (stats.total > 0) {
      const percentage = Math.round((stats.completed / stats.total) * 100)
      projectStatsLines.push(`- ${project.name}: ${stats.completed}/${stats.total} (${percentage}%)`)
    }
  }

  const { startStr, endStr } = formatDateRange(periodStart, periodEnd)

  return {
    periodStart: startStr,
    periodEnd: endStr,
    newTodos,
    completedTodos,
    inProgressTodos,
    pomodoroCount,
    totalMinutes,
    projectStats: projectStatsLines.join('\n'),
  }
}

export type GenerateSummaryResult = {
  content: string
  isNew: boolean
  message: string
}

/**
 * 生成工作总结
 */
export async function generateSummary(
  userId: string,
  type: SummaryType,
  periodStart: string,
  periodEnd: string,
  forceRegenerate: boolean = false
): Promise<GenerateSummaryResult> {
  // 检查是否已存在该时段的总结
  const existing = await getSummaryByPeriod(userId, type, periodStart)
  if (existing && !forceRegenerate) {
    console.log(`[SummaryGenerator] Summary already exists for ${type} period ${periodStart}`)
    return {
      content: existing.content,
      isNew: false,
      message: '该时段的总结已存在',
    }
  }

  // 收集数据
  const data = await collectSummaryData(userId, periodStart, periodEnd)

  // 调用 LLM 生成总结
  const content = await generateSummaryWithLLM(type, data)

  // 保存或更新总结
  if (existing) {
    await updateSummary(existing.id, content)
  } else {
    await createSummary(userId, type, periodStart, periodEnd, content)
  }

  // 更新最后生成时间
  await updateLastSummaryTime(type, new Date().toISOString())

  return {
    content,
    isNew: true,
    message: existing ? '总结已重新生成' : '总结生成成功',
  }
}

/**
 * 检查是否应该生成日总结
 */
export async function shouldGenerateDailySummary(
  scheduleTime: string,
  enabled: boolean
): Promise<boolean> {
  if (!enabled) return false

  const now = new Date()
  const [hours, minutes] = scheduleTime.split(':').map(Number)

  // 检查当前时间是否在调度时间之后
  const scheduleDate = new Date(now)
  scheduleDate.setHours(hours, minutes, 0, 0)

  if (now < scheduleDate) {
    return false
  }

  // 检查今天是否已经生成过
  const lastTime = await fetchLastSummaryTime('daily')
  if (lastTime) {
    const lastDate = new Date(lastTime)
    const isSameDay =
      lastDate.getFullYear() === now.getFullYear() &&
      lastDate.getMonth() === now.getMonth() &&
      lastDate.getDate() === now.getDate()

    if (isSameDay) {
      return false
    }
  }

  return true
}

/**
 * 检查是否应该生成周总结
 */
export async function shouldGenerateWeeklySummary(
  scheduleDay: number,
  scheduleTime: string,
  enabled: boolean
): Promise<boolean> {
  if (!enabled) return false

  const now = new Date()
  const currentDay = now.getDay()

  // 检查是否是调度日
  if (currentDay !== scheduleDay) {
    return false
  }

  const [hours, minutes] = scheduleTime.split(':').map(Number)

  // 检查当前时间是否在调度时间之后
  const scheduleDate = new Date(now)
  scheduleDate.setHours(hours, minutes, 0, 0)

  if (now < scheduleDate) {
    return false
  }

  // 检查本周是否已经生成过
  const lastTime = await fetchLastSummaryTime('weekly')
  if (lastTime) {
    const lastDate = new Date(lastTime)
    const { start } = getWeeklyPeriod(now)
    const weekStart = new Date(start)

    // 如果上次生成时间在本周开始之后，说明已经生成过
    if (lastDate >= weekStart) {
      return false
    }
  }

  return true
}
