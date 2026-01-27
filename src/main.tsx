import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyTheme } from '@/theme/themeStore'
import './index.css'
import App from './App.tsx'

// Apply saved theme before first paint to avoid flash
try {
  const raw = localStorage.getItem('flow-theme')
  const mode = raw ? (JSON.parse(raw) as { state?: { mode?: 'light' | 'dark' | 'system' } })?.state?.mode : undefined
  applyTheme(mode ?? 'system')
} catch {
  applyTheme('system')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
