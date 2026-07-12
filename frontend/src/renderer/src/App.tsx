import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useAuthStore } from './store/authStore'
import { studioApi, type StudioBranding } from './api/studio'
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
import { SetPassword } from './pages/SetPassword'
import { EmailTemplatesPage } from './pages/EmailTemplates/index'
import { EmailEventsPage } from './pages/EmailEvents/index'
import { SmsTemplatesPage } from './pages/SmsTemplates/index'
import { SmsEventsPage } from './pages/SmsEvents/index'
import { SmartListsPage } from './pages/SmartLists/index'
import { EstablishmentsPage } from './pages/Establishments'
import { InstructorsPage } from './pages/Instructors'
import { PromoCodesPage } from './pages/PromoCodes'
import { TagsPage } from './pages/Tags'
import { GiftCardsPage } from './pages/GiftCards'
import { WaiversPage } from './pages/Waivers/index'
import { AppointmentsPage } from './pages/Appointments/index'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function darken(hex: string, amount = 0.12): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * (1 - amount))}, ${Math.round(g * (1 - amount))}, ${Math.round(b * (1 - amount))})`
}

function lighten(hex: string, amount = 0.35): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r + (255 - r) * amount)}, ${Math.round(g + (255 - g) * amount)}, ${Math.round(b + (255 - b) * amount)})`
}

function ThemeInjector() {
  const token = useAuthStore((s) => s.accessToken)

  // When authenticated, fetch full settings; otherwise fetch public branding.
  // Different queryKeys so React Query doesn't mix the two responses.
  const { data: fullSettings } = useQuery({
    queryKey: ['studio'],
    queryFn: studioApi.get,
    enabled: !!token,
  })
  const { data: branding } = useQuery<StudioBranding>({
    queryKey: ['studio-branding'],
    queryFn: studioApi.getBranding,
    enabled: !token,
    staleTime: 5 * 60 * 1000,
  })

  const settings = token ? fullSettings : branding
  const primary = settings?.primary_color
  const secondary = settings?.secondary_color

  if (primary) {
    const dark = darken(primary)
    const darkest = darken(primary, 0.22)
    const light400 = lighten(primary, 0.35)
    const light50 = `${primary}20`
    const light100 = `${primary}33`
    const light200 = `${primary}40`
    const light300 = `${primary}60`
    const ring = `${primary}80`
    // sidebar active nav text — secondary if set, else computed slightly darker primary
    const accent700 = secondary ?? darken(primary, 0.18)

    let css = `
      /* — Buttons & backgrounds — */
      .bg-indigo-600 { background-color: ${primary} !important; }
      .bg-indigo-400 { background-color: ${light400} !important; }
      .bg-indigo-100 { background-color: ${light100} !important; }
      .bg-indigo-50  { background-color: ${light50}  !important; }
      .hover\\:bg-indigo-800:hover { background-color: ${darkest} !important; }
      .hover\\:bg-indigo-700:hover { background-color: ${dark}    !important; }
      .hover\\:bg-indigo-100:hover { background-color: ${light100} !important; }
      .hover\\:bg-indigo-50:hover  { background-color: ${light50}  !important; }

      /* — Text — */
      .text-indigo-800 { color: ${darkest}  !important; }
      .text-indigo-700 { color: ${accent700} !important; }
      .text-indigo-600 { color: ${primary}  !important; }
      .text-indigo-400 { color: ${light400} !important; }
      .hover\\:text-indigo-800:hover { color: ${darkest}  !important; }
      .hover\\:text-indigo-700:hover { color: ${accent700} !important; }

      /* — Borders — */
      .border-indigo-600 { border-color: ${primary} !important; }
      .border-b-2.border-indigo-600 { border-bottom-color: ${primary} !important; }
      .border-t-indigo-600 { border-top-color: ${primary} !important; }
      .border-l-indigo-400 { border-left-color: ${primary} !important; }
      .border-indigo-500 { border-color: ${ring}    !important; }
      .border-indigo-300 { border-color: ${light300} !important; }
      .border-indigo-200 { border-color: ${light200} !important; }

      /* — Table dividers — */
      .divide-indigo-100 > * + * { border-color: ${light50} !important; }

      /* — Focus rings & borders — */
      .focus\\:ring-indigo-500:focus { --tw-ring-color: ${ring} !important; }
      .focus\\:ring-indigo-400:focus { --tw-ring-color: ${ring} !important; }
      .focus\\:border-indigo-400:focus { border-color: ${ring} !important; }
      .focus-within\\:ring-indigo-500:focus-within { --tw-ring-color: ${ring} !important; }
      .focus-within\\:border-indigo-500:focus-within { border-color: ${ring} !important; }

      /* — Calendar (always apply when primary is set) — */
      .rbc-today { background-color: ${light50} !important; }
      .rbc-current-time-indicator { background-color: ${primary}99 !important; }
    `

    if (secondary) {
      css += `
        /* — Secondary color overrides — */
        .bg-emerald-600 { background-color: ${secondary} !important; }
        .text-emerald-600 { color: ${secondary} !important; }
        .bg-emerald-50 { background-color: ${secondary}20 !important; }
        .text-emerald-700 { color: ${darken(secondary, 0.08)} !important; }
        /* Override calendar with secondary tint when set */
        .rbc-today { background-color: ${secondary}12 !important; }
        .rbc-current-time-indicator { background-color: ${secondary}99 !important; }
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
          <Route path="/set-password" element={<SetPassword />} />
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
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="class-types" element={<ClassTypesPage />} />
            <Route path="memberships" element={<MembershipsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="marketing/templates" element={<EmailTemplatesPage />} />
            <Route path="marketing/events" element={<EmailEventsPage />} />
            <Route path="marketing/sms-templates" element={<SmsTemplatesPage />} />
            <Route path="marketing/sms-events" element={<SmsEventsPage />} />
            <Route path="marketing/smartlists" element={<SmartListsPage />} />
            <Route path="establishments" element={<EstablishmentsPage />} />
            <Route path="instructors" element={<InstructorsPage />} />
            <Route path="promo-codes" element={<PromoCodesPage />} />
            <Route path="tags" element={<TagsPage />} />
            <Route path="gift-cards" element={<GiftCardsPage />} />
            <Route path="waivers" element={<WaiversPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
