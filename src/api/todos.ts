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
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type TodoInsert = Pick<Todo, 'title'> & Partial<Pick<Todo, 'description' | 'completed' | 'due_date' | 'start_date' | 'quadrant' | 'inbox' | 'sort_order' | 'parent_id'>>
export type TodoUpdate = Partial<Pick<Todo, 'title' | 'description' | 'completed' | 'due_date' | 'start_date' | 'quadrant' | 'inbox' | 'sort_order' | 'parent_id'>>

export async function fetchTodos(userId: string, includeDeleted: boolean = false): Promise<Todo[]> {
  let query = supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
  
  // 默认不包含已删除的任务
  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }
  
  const { data, error } = await query
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createTodo(userId: string, todo: TodoInsert): Promise<Todo> {
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
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTodo(id: string, patch: TodoUpdate): Promise<Todo> {
  const { data, error } = await supabase
    .from('todos')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTodo(id: string): Promise<void> {
  // 软删除：设置 deleted_at 时间戳
  const { error } = await supabase
    .from('todos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function restoreTodo(id: string): Promise<Todo> {
  // 恢复已删除的任务
  const { data, error } = await supabase
    .from('todos')
    .update({ deleted_at: null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function permanentlyDeleteTodo(id: string): Promise<void> {
  // 永久删除任务
  const { error } = await supabase.from('todos').delete().eq('id', id)
  if (error) throw error
}
