import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'
import { isTauriEnv } from '../db/local'

// 缓存的用户 ID 键名
const CACHED_USER_KEY = 'flow_cached_user'

type CachedUser = {
  id: string
  email: string | undefined
}

/**
 * 缓存用户信息到 localStorage
 */
function cacheUser(user: CachedUser): void {
  try {
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user))
  } catch (e) {
    console.warn('[Auth] Failed to cache user:', e)
  }
}

/**
 * 从 localStorage 获取缓存的用户信息
 */
function getCachedUser(): CachedUser | null {
  try {
    const cached = localStorage.getItem(CACHED_USER_KEY)
    if (cached) {
      return JSON.parse(cached) as CachedUser
    }
  } catch (e) {
    console.warn('[Auth] Failed to get cached user:', e)
  }
  return null
}

/**
 * 清除缓存的用户信息
 */
function clearCachedUser(): void {
  try {
    localStorage.removeItem(CACHED_USER_KEY)
  } catch (e) {
    console.warn('[Auth] Failed to clear cached user:', e)
  }
}

/**
 * 创建一个模拟的离线会话
 */
function createOfflineSession(user: CachedUser): Session {
  return {
    access_token: '',
    refresh_token: '',
    expires_at: 0,
    expires_in: 0,
    token_type: 'bearer',
    user: {
      id: user.id,
      email: user.email,
      aud: 'authenticated',
      role: '',
      created_at: '',
      app_metadata: {},
      user_metadata: {},
    },
  } as Session
}

/**
 * 检查是否离线
 */
function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}

/**
 * 获取当前会话
 * 支持离线模式：网络失败时返回缓存的会话
 */
export async function getSession(): Promise<Session | null> {
  // 如果明确离线，直接使用缓存
  if (isOffline() && isTauriEnv()) {
    const cached = getCachedUser()
    if (cached) {
      return createOfflineSession(cached)
    }
    return null
  }

  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      // 网络错误时尝试使用缓存
      if (isTauriEnv()) {
        const cached = getCachedUser()
        if (cached) {
          return createOfflineSession(cached)
        }
      }
      return null
    }

    // 成功获取会话时缓存用户信息
    if (data.session?.user) {
      cacheUser({
        id: data.session.user.id,
        email: data.session.user.email,
      })
    }

    return data.session
  } catch (error) {
    // 网络超时等异常时尝试使用缓存
    if (isTauriEnv()) {
      const cached = getCachedUser()
      if (cached) {
        return createOfflineSession(cached)
      }
    }
    return null
  }
}

export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    // 登录成功时缓存用户
    if (session?.user) {
      cacheUser({
        id: session.user.id,
        email: session.user.email,
      })
    }
    callback(event, session)
  })
}

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password })
}

export async function signIn(email: string, password: string) {
  const result = await supabase.auth.signInWithPassword({ email, password })
  // 登录成功时缓存用户
  if (result.data.user) {
    cacheUser({
      id: result.data.user.id,
      email: result.data.user.email,
    })
  }
  return result
}

export async function signOut() {
  clearCachedUser()
  return supabase.auth.signOut()
}
