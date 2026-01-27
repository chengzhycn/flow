import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

type ThemeState = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

function getEffectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return mode
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'flow-theme' }
  )
)

export function applyTheme(mode: ThemeMode) {
  const theme = getEffectiveTheme(mode)
  document.documentElement.setAttribute('data-theme', theme)
}

export function getEffectiveThemeMode(mode: ThemeMode): 'light' | 'dark' {
  return getEffectiveTheme(mode)
}
