import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { CalendarPage } from './pages/Calendar'
import { ClientsPage } from './pages/Clients/index'
import { ClientDetail } from './pages/Clients/ClientDetail'
import { ClassTypesPage } from './pages/ClassTypes'
import { MembershipsPage } from './pages/Memberships'
import { ReportsPage } from './pages/Reports'
import { SettingsPage } from './pages/Settings'
import { OnboardingPage } from './pages/Onboarding/index'
import { OllamaSetup } from './components/OllamaSetup'

const isElectron = typeof window !== 'undefined' && 'ollamaApi' in window

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App(): JSX.Element {
  const [ollamaReady, setOllamaReady] = useState(!isElectron)

  if (!ollamaReady) {
    return <OllamaSetup onReady={() => setOllamaReady(true)} />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="class-types" element={<ClassTypesPage />} />
            <Route path="memberships" element={<MembershipsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
