import { isTauriEnv } from '../db/local'
import {
  fetchLocalTodos,
  createLocalTodo,
  updateLocalTodo,
  deleteLocalTodo,
  restoreLocalTodo,
  permanentlyDeleteLocalTodo,
  type LocalTodo,
} from '../db/localTodos'
import { triggerSync } from '../sync/SyncEngine'
import { supabase } from './supabase'

export type Quadrant = 'important_urgent' | 'important_not_urgent' | 'not_important_urgent' | 'not_important_not_urgent' | null

export type Todo = {
  id: string
  user_id: string
  title: string
  description: string | null
  completed: boolean
  due_date: string | null
  start_date: string | null
  quadrant: Quadrant
  inbox: boolean
  sort_order: number
  parent_id: string | null
  project_id: string | null
  milestone_id: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type TodoInsert = Pick<Todo, 'title'> & Partial<Pick<Todo, 'description' | 'completed' | 'due_date' | 'start_date' | 'quadrant' | 'inbox' | 'sort_order' | 'parent_id' | 'project_id' | 'milestone_id'>>
export type TodoUpdate = Partial<Pick<Todo, 'title' | 'description' | 'completed' | 'due_date' | 'start_date' | 'quadrant' | 'inbox' | 'sort_order' | 'parent_id' | 'project_id' | 'milestone_id'>>

// 当前用户 ID 缓存（用于触发同步）
let currentUserId: string | null = null

export function setCurrentUserId(userId: string): void {
  currentUserId = userId
}

/**
 * 获取 Todos - 本地优先
 */
export async function fetchTodos(userId: string, includeDeleted: boolean = false): Promise<Todo[]> {
  currentUserId = userId

  if (isTauriEnv()) {
    try {
      const localTodos = await fetchLocalTodos(userId, includeDeleted)
      return localTodos.map(localToTodo)
    } catch (error) {
      console.error('[todos] Failed to fetch local todos:', error)
      return []
    }
  }

  // 回退到 Supabase（Web 版本）
  try {
    let query = supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)

    if (!includeDeleted) {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  } catch (error) {
    console.error('[todos] Supabase fetch failed:', error)
    return []
  }
}

/**
 * 创建 Todo - 本地优先
 */
export async function createTodo(userId: string, todo: TodoInsert): Promise<Todo> {
  currentUserId = userId

  if (isTauriEnv()) {
    const localTodo = await createLocalTodo(userId, todo)
    triggerSyncIfPossible()
    return localToTodo(localTodo)
  }

  // 回退到 Supabase
  const { data, error } = await supabase
    .from('todos')
    .insert({
      user_id: userId,
      title: todo.title,
      description: todo.description ?? null,
      completed: todo.completed ?? false,
      due_date: todo.due_date ?? null,
      start_date: todo.start_date ?? null,
      quadrant: todo.quadrant ?? null,
      inbox: todo.inbox ?? true,
      sort_order: todo.sort_order ?? 0,
      parent_id: todo.parent_id ?? null,
      project_id: todo.project_id ?? null,
      milestone_id: todo.milestone_id ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * 更新 Todo - 本地优先
 */
export async function updateTodo(id: string, patch: TodoUpdate): Promise<Todo> {
  if (isTauriEnv()) {
    const localTodo = await updateLocalTodo(id, patch)
    if (!localTodo) throw new Error(`Todo ${id} not found`)
    triggerSyncIfPossible()
    return localToTodo(localTodo)
  }

  // 回退到 Supabase
  const { data, error } = await supabase
    .from('todos')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * 删除 Todo（软删除）- 本地优先
 */
export async function deleteTodo(id: string): Promise<void> {
  if (isTauriEnv()) {
    await deleteLocalTodo(id)
    triggerSyncIfPossible()
    return
  }

  // 回退到 Supabase
  const { error } = await supabase
    .from('todos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/**
 * 恢复已删除的 Todo - 本地优先
 */
export async function restoreTodo(id: string): Promise<Todo> {
  if (isTauriEnv()) {
    const localTodo = await restoreLocalTodo(id)
    if (!localTodo) throw new Error(`Todo ${id} not found`)
    triggerSyncIfPossible()
    return localToTodo(localTodo)
  }

  // 回退到 Supabase
  const { data, error } = await supabase
    .from('todos')
    .update({ deleted_at: null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * 永久删除 Todo - 本地优先
 */
export async function permanentlyDeleteTodo(id: string): Promise<void> {
  if (isTauriEnv()) {
    await permanentlyDeleteLocalTodo(id)
    triggerSyncIfPossible()
    return
  }

  // 回退到 Supabase
  const { error } = await supabase.from('todos').delete().eq('id', id)
  if (error) throw error
}

// 辅助函数：将 LocalTodo 转换为 Todo
function localToTodo(local: LocalTodo): Todo {
  return {
    id: local.id,
    user_id: local.user_id,
    title: local.title,
    description: local.description,
    completed: local.completed,
    due_date: local.due_date,
    start_date: local.start_date,
    quadrant: local.quadrant,
    inbox: local.inbox,
    sort_order: local.sort_order,
    parent_id: local.parent_id,
    project_id: local.project_id,
    milestone_id: local.milestone_id,
    deleted_at: local.deleted_at,
    created_at: local.created_at,
    updated_at: local.updated_at,
  }
}

// 辅助函数：安全触发同步
function triggerSyncIfPossible(): void {
  if (currentUserId) {
    triggerSync(currentUserId).catch(err => {
      console.error('[todos] Failed to trigger sync:', err)
    })
  }
}
