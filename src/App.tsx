import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { AuthGuard } from '@/auth/AuthGuard'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/auth/LoginPage'
import { TodosPage } from '@/todos/TodosPage'
import { QuadrantsPage } from '@/todos/QuadrantsPage'
import { PomodoroPage } from '@/pomodoro/PomodoroPage'
import { CalendarPage } from '@/calendar/CalendarPage'
import { SettingsPage } from '@/settings/SettingsPage'
import { QuickAddPage } from '@/quick-add/QuickAddPage'

const queryClient = new QueryClient()

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <AuthGuard>
            <Layout>
              <TodosPage />
            </Layout>
          </AuthGuard>
        }
      />
      <Route
        path="/quadrants"
        element={
          <AuthGuard>
            <Layout>
              <QuadrantsPage />
            </Layout>
          </AuthGuard>
        }
      />
      <Route
        path="/calendar"
        element={
          <AuthGuard>
            <Layout>
              <CalendarPage />
            </Layout>
          </AuthGuard>
        }
      />
      <Route
        path="/pomodoro"
        element={
          <AuthGuard>
            <Layout>
              <PomodoroPage />
            </Layout>
          </AuthGuard>
        }
      />
      <Route
        path="/settings"
        element={
          <AuthGuard>
            <Layout>
              <SettingsPage />
            </Layout>
          </AuthGuard>
        }
      />
      <Route
        path="/quick-add"
        element={
          <AuthGuard>
            <QuickAddPage />
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
