import { useEffect } from 'react'
import { useThemeStore, applyTheme } from './themeStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore((s) => s.mode)
  const loadTheme = useThemeStore((s) => s.loadTheme)

  // 初始化时从数据库加载主题
  useEffect(() => {
    loadTheme()
  }, [loadTheme])

  // 监听系统主题变化
  useEffect(() => {
    if (mode !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [mode])

  return <>{children}</>
}
