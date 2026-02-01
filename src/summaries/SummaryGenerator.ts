import { fetchTodos, type Todo } from '@/api/todos'
import { fetchPomodoroSessions } from '@/api/pomodoro'
import { fetchProjects, fetchMilestones, fetchProjectTaskStats, type Project, type Milestone } from '@/api/projects'
import {
  createSummary,
  updateSummary,
  getSummaryByPeriod,
  generateSummaryWithLLM,
  fetchLastSummaryTime,
  updateLastSummaryTime,
  type SummaryData,
  type SummaryType,
  type CategorizedTodo,
  type MilestoneProgress,
  type QuadrantType,
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
 * 将 Todo 转换为 CategorizedTodo
 */
function toCategorizedTodo(
  todo: Todo,
  projectMap: Map<string, Project>,
  milestoneMap: Map<string, Milestone>
): CategorizedTodo {
  return {
    title: todo.title,
    quadrant: todo.quadrant as QuadrantType | null,
    dueDate: todo.due_date,
    projectName: todo.project_id ? projectMap.get(todo.project_id)?.name ?? null : null,
    milestoneName: todo.milestone_id ? milestoneMap.get(todo.milestone_id)?.name ?? null : null,
  }
}

/**
 * 判断日期是否在周期内（包含边界）
 */
function isDateInPeriod(dateStr: string | null, periodStart: Date, periodEnd: Date): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  return date >= periodStart && date <= periodEnd
}

/**
 * 判断任务是否超期
 */
function isOverdue(dueDate: string | null, referenceDate: Date = new Date()): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < referenceDate
}

/**
 * 判断任务是否即将到期（默认7天内）
 */
function isUpcomingDue(dueDate: string | null, days: number = 7, referenceDate: Date = new Date()): boolean {
  if (!dueDate) return false
  const due = new Date(dueDate)
  const futureDate = new Date(referenceDate)
  futureDate.setDate(futureDate.getDate() + days)
  return due > referenceDate && due <= futureDate
}

/**
 * 收集指定时间段的工作数据
 */
export async function collectSummaryData(
  userId: string,
  periodStart: string,
  periodEnd: string
): Promise<SummaryData> {
  const periodStartDate = new Date(periodStart)
  const periodEndDate = new Date(periodEnd)
  const now = new Date()

  // 获取所有任务
  const todos = await fetchTodos(userId)
  
  // 获取所有项目和里程碑
  const projects = await fetchProjects(userId)
  const projectMap = new Map<string, Project>(projects.map(p => [p.id, p]))
  
  // 收集所有里程碑
  const milestoneMap = new Map<string, Milestone>()
  const allMilestones: Array<Milestone & { project: Project }> = []
  
  for (const project of projects) {
    const milestones = await fetchMilestones(project.id)
    for (const m of milestones) {
      milestoneMap.set(m.id, m)
      allMilestones.push({ ...m, project })
    }
  }

  // 分类任务
  const newTodos: string[] = []
  const completedTodos: CategorizedTodo[] = []
  const inProgressTodos: CategorizedTodo[] = []
  const overdueTodos: CategorizedTodo[] = []
  const upcomingDueTodos: CategorizedTodo[] = []

  // 四象限统计（未完成任务）
  const quadrantSummary = {
    important_urgent: [] as CategorizedTodo[],
    important_not_urgent: [] as CategorizedTodo[],
    not_important_urgent: [] as CategorizedTodo[],
    not_important_not_urgent: [] as CategorizedTodo[],
    unclassified: [] as CategorizedTodo[],
  }

  for (const todo of todos) {
    const createdAt = new Date(todo.created_at)
    const categorizedTodo = toCategorizedTodo(todo, projectMap, milestoneMap)

    // 在时间段内创建的任务
    if (createdAt >= periodStartDate && createdAt <= periodEndDate) {
      newTodos.push(`- ${todo.title}`)
    }

    // 已完成任务：completed_at 在总结周期内
    if (todo.completed && todo.completed_at) {
      const completedAt = new Date(todo.completed_at)
      if (completedAt >= periodStartDate && completedAt <= periodEndDate) {
        completedTodos.push(categorizedTodo)
      }
    }

    // 未完成任务处理
    if (!todo.completed && !todo.deleted_at) {
      // 判断任务是否与总结周期相关（开始时间或截止时间在周期内）
      const startInPeriod = isDateInPeriod(todo.start_date, periodStartDate, periodEndDate)
      const dueInPeriod = isDateInPeriod(todo.due_date, periodStartDate, periodEndDate)
      
      // 超期未完成任务
      if (isOverdue(todo.due_date, periodEndDate)) {
        overdueTodos.push(categorizedTodo)
      }
      // 即将到期任务（未来7天内到期）
      else if (isUpcomingDue(todo.due_date, 7, now)) {
        upcomingDueTodos.push(categorizedTodo)
      }
      
      // 进行中任务：总结周期在任务的开始时间和截止时间内，或任务在周期内活跃
      if (startInPeriod || dueInPeriod || !todo.due_date) {
        inProgressTodos.push(categorizedTodo)
      }
      
      // 四象限分类（所有未完成任务）
      if (todo.quadrant) {
        quadrantSummary[todo.quadrant as QuadrantType].push(categorizedTodo)
      } else {
        quadrantSummary.unclassified.push(categorizedTodo)
      }
    }
  }

  // 获取番茄钟数据
  const pomodoroSessions = await fetchPomodoroSessions(userId, periodStart, periodEnd)
  const completedWorkSessions = pomodoroSessions.filter((s) => s.completed && s.type === 'work')
  const pomodoroCount = completedWorkSessions.length
  const totalMinutes = completedWorkSessions.reduce((sum, s) => sum + s.duration_minutes, 0)

  // 获取项目统计
  const projectStatsLines: string[] = []
  for (const project of projects) {
    const stats = await fetchProjectTaskStats(project.id)
    if (stats.total > 0) {
      const percentage = Math.round((stats.completed / stats.total) * 100)
      projectStatsLines.push(`- ${project.name}: ${stats.completed}/${stats.total} (${percentage}%)`)
    }
  }

  // 获取里程碑进度
  const milestoneProgress: MilestoneProgress[] = []
  const overdueMilestones: MilestoneProgress[] = []

  for (const milestone of allMilestones) {
    // 只关注当前周期内有截止日期的里程碑，或者超期的里程碑
    const dueInPeriod = isDateInPeriod(milestone.due_date, periodStartDate, periodEndDate)
    const milestoneOverdue = !milestone.completed && isOverdue(milestone.due_date, periodEndDate)

    if (dueInPeriod || milestoneOverdue) {
      // 获取该里程碑下的任务统计
      const milestoneTodos = todos.filter(t => t.milestone_id === milestone.id && !t.deleted_at)
      const totalTasks = milestoneTodos.length
      const completedTasks = milestoneTodos.filter(t => t.completed).length

      const progressData: MilestoneProgress = {
        projectName: milestone.project.name,
        milestoneName: milestone.name,
        dueDate: milestone.due_date,
        completed: milestone.completed,
        totalTasks,
        completedTasks,
        isOverdue: milestoneOverdue,
      }

      if (dueInPeriod) {
        milestoneProgress.push(progressData)
      }
      
      if (milestoneOverdue) {
        overdueMilestones.push(progressData)
      }
    }
  }

  const { startStr, endStr } = formatDateRange(periodStart, periodEnd)

  return {
    periodStart: startStr,
    periodEnd: endStr,
    newTodos,
    completedTodos,
    inProgressTodos,
    overdueTodos,
    upcomingDueTodos,
    pomodoroCount,
    totalMinutes,
    projectStats: projectStatsLines.join('\n'),
    milestoneProgress,
    overdueMilestones,
    quadrantSummary,
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
