import { useState, useEffect } from 'react'
import { getSession } from '@/api/auth'
import type { User } from '@supabase/supabase-js'

export function useUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSession().then((session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  return { user, loading }
}
