import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useAuthStore } from './store/authStore'
import { studioApi } from './api/studio'
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
import { EmailTemplatesPage } from './pages/EmailTemplates/index'
import { EmailEventsPage } from './pages/EmailEvents/index'
import { SmartListsPage } from './pages/SmartLists/index'
import { EstablishmentsPage } from './pages/Establishments'
import { InstructorsPage } from './pages/Instructors'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function darken(hex: string, amount = 0.12): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * (1 - amount))}, ${Math.round(g * (1 - amount))}, ${Math.round(b * (1 - amount))})`
}

function ThemeInjector() {
  const token = useAuthStore((s) => s.accessToken)
  const { data: settings } = useQuery({
    queryKey: ['studio'],
    queryFn: () => studioApi.get(),
    enabled: !!token,
  })

  const primary = settings?.primary_color
  const secondary = settings?.secondary_color

  if (primary) {
    const dark = darken(primary)
    const darkest = darken(primary, 0.22)
    const light50 = `${primary}20`
    const light100 = `${primary}33`
    const ring = `${primary}80`
    let css = `
      .bg-indigo-600 { background-color: ${primary} !important; }
      .hover\\:bg-indigo-700:hover { background-color: ${dark} !important; }
      .hover\\:bg-indigo-800:hover { background-color: ${darkest} !important; }
      .text-indigo-600 { color: ${primary} !important; }
      .hover\\:text-indigo-800:hover { color: ${darkest} !important; }
      .border-indigo-600 { border-color: ${primary} !important; }
      .border-b-2.border-indigo-600 { border-bottom-color: ${primary} !important; }
      .bg-indigo-50 { background-color: ${light50} !important; }
      .bg-indigo-100 { background-color: ${light100} !important; }
      .hover\\:bg-indigo-100:hover { background-color: ${light100} !important; }
      .text-indigo-800 { color: ${darkest} !important; }
      .focus\\:ring-indigo-500:focus { --tw-ring-color: ${ring} !important; }
      .focus\\:ring-indigo-400:focus { --tw-ring-color: ${ring} !important; }
    `
    if (secondary) {
      css += `
        .bg-emerald-600 { background-color: ${secondary} !important; }
        .text-emerald-600 { color: ${secondary} !important; }
        .bg-emerald-50 { background-color: ${secondary}20 !important; }
        .text-emerald-700 { color: ${darken(secondary, 0.08)} !important; }
      `
    }
    let el = document.getElementById('agon-theme')
    if (!el) {
      el = document.createElement('style')
      el.id = 'agon-theme'
      document.head.appendChild(el)
    }
    el.textContent = css
  } else {
    const el = document.getElementById('agon-theme')
    if (el) el.textContent = ''
  }

  return null
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInjector />
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
            <Route path="marketing/templates" element={<EmailTemplatesPage />} />
            <Route path="marketing/events" element={<EmailEventsPage />} />
            <Route path="marketing/smartlists" element={<SmartListsPage />} />
            <Route path="establishments" element={<EstablishmentsPage />} />
            <Route path="instructors" element={<InstructorsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
