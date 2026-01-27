import { useEffect } from 'react'
import { useThemeStore, applyTheme } from './themeStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore((s) => s.mode)

  useEffect(() => {
    applyTheme(mode)
  }, [mode])

  useEffect(() => {
    if (mode !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [mode])

  return <>{children}</>
}
