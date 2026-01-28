import { isTauriEnv } from '../db/local'
import {
  fetchLocalPomodoroSessions,
  createLocalPomodoroSession,
  updateLocalPomodoroSessionCompleted,
  type LocalPomodoroSession,
} from '../db/localPomodoro'
import { triggerSync } from '../sync/SyncEngine'
import { supabase } from './supabase'

export type PomodoroSessionType = 'work' | 'short_break' | 'long_break'

export type PomodoroSession = {
  id: string
  user_id: string
  started_at: string
  duration_minutes: number
  type: PomodoroSessionType
  completed: boolean
  todo_id: string | null
  created_at?: string
}

export type PomodoroSessionInsert = {
  user_id: string
  started_at: string
  duration_minutes: number
  type: PomodoroSessionType
  completed: boolean
  todo_id?: string | null
}

// 当前用户 ID 缓存
let currentUserId: string | null = null

/**
 * 创建 Pomodoro Session - 本地优先
 */
export async function createPomodoroSession(
  insert: PomodoroSessionInsert
): Promise<PomodoroSession> {
  currentUserId = insert.user_id

  if (isTauriEnv()) {
    const localSession = await createLocalPomodoroSession(insert)

    // 触发后台同步
    triggerSyncIfPossible()

    return localToSession(localSession)
  }

  // 回退到 Supabase
  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .insert(insert)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * 更新 Pomodoro Session 完成状态 - 本地优先
 */
export async function updatePomodoroSessionCompleted(
  id: string,
  completed: boolean
): Promise<void> {
  if (isTauriEnv()) {
    await updateLocalPomodoroSessionCompleted(id, completed)

    // 触发后台同步
    triggerSyncIfPossible()

    return
  }

  // 回退到 Supabase
  const { error } = await supabase
    .from('pomodoro_sessions')
    .update({ completed })
    .eq('id', id)
  if (error) throw error
}

/**
 * 获取 Pomodoro Sessions - 本地优先
 */
export async function fetchPomodoroSessions(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<PomodoroSession[]> {
  currentUserId = userId

  if (isTauriEnv()) {
    const localSessions = await fetchLocalPomodoroSessions(userId, fromDate, toDate)
    return localSessions.map(localToSession)
  }

  // 回退到 Supabase
  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('started_at', fromDate)
    .lte('started_at', toDate)
    .order('started_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// 辅助函数：将 LocalPomodoroSession 转换为 PomodoroSession
function localToSession(local: LocalPomodoroSession): PomodoroSession {
  return {
    id: local.id,
    user_id: local.user_id,
    started_at: local.started_at,
    duration_minutes: local.duration_minutes,
    type: local.type,
    completed: local.completed,
    todo_id: local.todo_id,
    created_at: local.created_at,
  }
}

// 辅助函数：安全触发同步
function triggerSyncIfPossible(): void {
  if (currentUserId) {
    triggerSync(currentUserId).catch(err => {
      console.error('[pomodoro] Failed to trigger sync:', err)
    })
  }
}
