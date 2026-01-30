import { create } from 'zustand'
import { getThemeSetting, setThemeSetting } from '@/db/localSettings'

export type ThemeMode = 'light' | 'dark' | 'system'

type ThemeState = {
  mode: ThemeMode
  isLoading: boolean
  setMode: (mode: ThemeMode) => void
  loadTheme: () => Promise<void>
}

function getEffectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return mode
}

export const useThemeStore = create<ThemeState>()((set) => ({
  mode: 'system',
  isLoading: true,
  setMode: async (mode) => {
    set({ mode })
    applyTheme(mode)
    // 保存到数据库
    await setThemeSetting(mode)
  },
  loadTheme: async () => {
    const mode = await getThemeSetting()
    set({ mode, isLoading: false })
    applyTheme(mode)
  },
}))

export function applyTheme(mode: ThemeMode) {
  const theme = getEffectiveTheme(mode)
  document.documentElement.setAttribute('data-theme', theme)
}

export function getEffectiveThemeMode(mode: ThemeMode): 'light' | 'dark' {
  return getEffectiveTheme(mode)
}
