import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => callback(event, session))
}

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password })
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

