import { getDatabase, generateId, nowISO } from './local'

// 工作总结类型
export type SummaryType = 'daily' | 'weekly'

// 本地 WorkSummary 类型，包含同步字段
export type LocalWorkSummary = {
  id: string
  user_id: string
  type: SummaryType
  period_start: string
  period_end: string
  content: string
  created_at: string
  sync_status: 'synced' | 'pending' | 'conflict'
  local_updated_at: string
  remote_updated_at: string | null
}

// LLM 设置类型
export type LLMSettings = {
  baseUrl: string
  apiKey: string
  model: string
  dailyPromptTemplate: string
  weeklyPromptTemplate: string
}

// 调度设置类型
export type ScheduleSettings = {
  dailySummaryTime: string // HH:mm 格式
  dailySummaryEnabled: boolean
  weeklySummaryDay: number // 0-6，0=周日
  weeklySummaryTime: string // HH:mm 格式
  weeklySummaryEnabled: boolean
}

// 默认 LLM 设置
export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  dailyPromptTemplate: `你是一个工作总结助手。请根据以下工作数据生成简洁的每日工作总结。

## 时间范围
{period_start} 至 {period_end}

## 任务数据
- 新建任务: {new_todos}
- 完成任务: {completed_todos}
- 进行中任务: {in_progress_todos}

## 工作时长
- 番茄钟完成: {pomodoro_count} 个
- 总工作时长: {total_minutes} 分钟

## 项目进度
{project_stats}

请生成包含以下内容的总结:
1. 今日工作内容概述
2. 完成进度
3. 明日重点关注`,
  weeklyPromptTemplate: `你是一个工作总结助手。请根据以下工作数据生成简洁的每周工作总结。

## 时间范围
{period_start} 至 {period_end}

## 任务数据
- 新建任务: {new_todos}
- 完成任务: {completed_todos}
- 进行中任务: {in_progress_todos}

## 工作时长
- 番茄钟完成: {pomodoro_count} 个
- 总工作时长: {total_minutes} 分钟

## 项目进度
{project_stats}

请生成包含以下内容的总结:
1. 本周工作内容概述
2. 整体完成进度与目标达成情况
3. 下周重点关注与计划`,
}

// 默认调度设置
export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  dailySummaryTime: '21:00',
  dailySummaryEnabled: false,
  weeklySummaryDay: 0, // 周日
  weeklySummaryTime: '20:00',
  weeklySummaryEnabled: false,
}

// ==================== 工作总结 CRUD ====================

/**
 * 获取工作总结列表
 */
export async function fetchLocalSummaries(
  userId: string,
  type?: SummaryType,
  limit?: number
): Promise<LocalWorkSummary[]> {
  const db = await getDatabase()

  let sql = `SELECT * FROM work_summaries WHERE user_id = $1`
  const params: unknown[] = [userId]

  if (type) {
    sql += ` AND type = $2`
    params.push(type)
  }

  sql += ` ORDER BY period_start DESC`

  if (limit) {
    sql += ` LIMIT ${limit}`
  }

  return await db.select<LocalWorkSummary[]>(sql, params)
}

/**
 * 根据 ID 获取单个工作总结
 */
export async function getLocalSummaryById(id: string): Promise<LocalWorkSummary | null> {
  const db = await getDatabase()
  const result = await db.select<LocalWorkSummary[]>(
    `SELECT * FROM work_summaries WHERE id = $1`,
    [id]
  )
  return result.length > 0 ? result[0] : null
}

/**
 * 根据时间段获取工作总结
 */
export async function getLocalSummaryByPeriod(
  userId: string,
  type: SummaryType,
  periodStart: string
): Promise<LocalWorkSummary | null> {
  const db = await getDatabase()
  const result = await db.select<LocalWorkSummary[]>(
    `SELECT * FROM work_summaries WHERE user_id = $1 AND type = $2 AND period_start = $3`,
    [userId, type, periodStart]
  )
  return result.length > 0 ? result[0] : null
}

/**
 * 创建工作总结
 */
export async function createLocalSummary(
  userId: string,
  type: SummaryType,
  periodStart: string,
  periodEnd: string,
  content: string
): Promise<LocalWorkSummary> {
  const db = await getDatabase()
  const now = nowISO()
  const id = generateId()

  const newSummary: LocalWorkSummary = {
    id,
    user_id: userId,
    type,
    period_start: periodStart,
    period_end: periodEnd,
    content,
    created_at: now,
    sync_status: 'pending',
    local_updated_at: now,
    remote_updated_at: null,
  }

  await db.execute(
    `INSERT INTO work_summaries (
      id, user_id, type, period_start, period_end, content, created_at,
      sync_status, local_updated_at, remote_updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      newSummary.id,
      newSummary.user_id,
      newSummary.type,
      newSummary.period_start,
      newSummary.period_end,
      newSummary.content,
      newSummary.created_at,
      newSummary.sync_status,
      newSummary.local_updated_at,
      newSummary.remote_updated_at,
    ]
  )

  return newSummary
}

/**
 * 更新工作总结内容
 */
export async function updateLocalSummary(
  id: string,
  content: string
): Promise<LocalWorkSummary | null> {
  const db = await getDatabase()
  const now = nowISO()

  await db.execute(
    `UPDATE work_summaries SET content = $1, local_updated_at = $2, sync_status = 'pending' WHERE id = $3`,
    [content, now, id]
  )

  return await getLocalSummaryById(id)
}

/**
 * 删除工作总结
 */
export async function deleteLocalSummary(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute(`DELETE FROM work_summaries WHERE id = $1`, [id])
}

/**
 * 获取待同步的工作总结
 */
export async function getPendingSummaries(): Promise<LocalWorkSummary[]> {
  const db = await getDatabase()
  return await db.select<LocalWorkSummary[]>(
    `SELECT * FROM work_summaries WHERE sync_status = 'pending'`
  )
}

/**
 * 标记工作总结为已同步
 */
export async function markSummarySynced(
  id: string,
  remoteUpdatedAt: string
): Promise<void> {
  const db = await getDatabase()
  await db.execute(
    `UPDATE work_summaries SET sync_status = 'synced', remote_updated_at = $1 WHERE id = $2`,
    [remoteUpdatedAt, id]
  )
}

/**
 * 批量插入/更新工作总结（用于从远端同步）
 */
export async function upsertLocalSummaries(summaries: LocalWorkSummary[]): Promise<void> {
  const db = await getDatabase()

  for (const summary of summaries) {
    await db.execute(
      `INSERT OR REPLACE INTO work_summaries (
        id, user_id, type, period_start, period_end, content, created_at,
        sync_status, local_updated_at, remote_updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        summary.id,
        summary.user_id,
        summary.type,
        summary.period_start,
        summary.period_end,
        summary.content,
        summary.created_at,
        summary.sync_status,
        summary.local_updated_at,
        summary.remote_updated_at,
      ]
    )
  }
}

// ==================== 设置存储 ====================

const LLM_SETTINGS_PREFIX = 'llm_'
const SCHEDULE_SETTINGS_PREFIX = 'schedule_'
const LAST_SUMMARY_PREFIX = 'last_summary_'

/**
 * 获取 LLM 设置
 */
export async function getLLMSettings(): Promise<LLMSettings> {
  const db = await getDatabase()
  const result = await db.select<{ key: string; value: string }[]>(
    `SELECT key, value FROM sync_meta WHERE key LIKE $1`,
    [`${LLM_SETTINGS_PREFIX}%`]
  )

  const settings = { ...DEFAULT_LLM_SETTINGS }

  for (const row of result) {
    const key = row.key.replace(LLM_SETTINGS_PREFIX, '') as keyof LLMSettings
    if (key in settings) {
      settings[key] = row.value
    }
  }

  return settings
}

/**
 * 保存 LLM 设置
 */
export async function saveLLMSettings(settings: Partial<LLMSettings>): Promise<void> {
  const db = await getDatabase()

  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined) {
      await db.execute(
        `INSERT OR REPLACE INTO sync_meta (key, value) VALUES ($1, $2)`,
        [`${LLM_SETTINGS_PREFIX}${key}`, value]
      )
    }
  }
}

/**
 * 获取调度设置
 */
export async function getScheduleSettings(): Promise<ScheduleSettings> {
  const db = await getDatabase()
  const result = await db.select<{ key: string; value: string }[]>(
    `SELECT key, value FROM sync_meta WHERE key LIKE $1`,
    [`${SCHEDULE_SETTINGS_PREFIX}%`]
  )

  const settings = { ...DEFAULT_SCHEDULE_SETTINGS }

  for (const row of result) {
    const key = row.key.replace(SCHEDULE_SETTINGS_PREFIX, '') as keyof ScheduleSettings
    if (key in settings) {
      if (key === 'dailySummaryEnabled' || key === 'weeklySummaryEnabled') {
        settings[key] = row.value === 'true'
      } else if (key === 'weeklySummaryDay') {
        settings[key] = parseInt(row.value, 10)
      } else {
        settings[key] = row.value
      }
    }
  }

  return settings
}

/**
 * 保存调度设置
 */
export async function saveScheduleSettings(settings: Partial<ScheduleSettings>): Promise<void> {
  const db = await getDatabase()

  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined) {
      await db.execute(
        `INSERT OR REPLACE INTO sync_meta (key, value) VALUES ($1, $2)`,
        [`${SCHEDULE_SETTINGS_PREFIX}${key}`, String(value)]
      )
    }
  }
}

/**
 * 获取上次总结生成时间
 */
export async function getLastSummaryTime(type: SummaryType): Promise<string | null> {
  const db = await getDatabase()
  const result = await db.select<{ value: string }[]>(
    `SELECT value FROM sync_meta WHERE key = $1`,
    [`${LAST_SUMMARY_PREFIX}${type}`]
  )
  return result.length > 0 ? result[0].value : null
}

/**
 * 保存上次总结生成时间
 */
export async function setLastSummaryTime(type: SummaryType, time: string): Promise<void> {
  const db = await getDatabase()
  await db.execute(
    `INSERT OR REPLACE INTO sync_meta (key, value) VALUES ($1, $2)`,
    [`${LAST_SUMMARY_PREFIX}${type}`, time]
  )
}
