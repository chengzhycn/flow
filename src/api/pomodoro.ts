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

export async function createPomodoroSession(
  insert: PomodoroSessionInsert
): Promise<PomodoroSession> {
  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .insert(insert)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePomodoroSessionCompleted(
  id: string,
  completed: boolean
): Promise<void> {
  const { error } = await supabase
    .from('pomodoro_sessions')
    .update({ completed })
    .eq('id', id)
  if (error) throw error
}

export async function fetchPomodoroSessions(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<PomodoroSession[]> {
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
