import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Layout } from '../../../src/renderer/src/components/Layout'

vi.mock('../../../src/renderer/src/i18n', () => ({
  default: {
    language: 'en',
    changeLanguage: vi.fn(),
  },
}))

const NAV_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  calendar: 'Calendar',
  classTypes: 'Class Types',
  clients: 'Clients',
  memberships: 'Memberships',
  reports: 'Reports',
  settings: 'Settings',
  logout: 'Logout',
  establishments: 'Establishments',
  instructors: 'Instructors',
  promoCodes: 'Promo Codes',
  tags: 'Tags',
  giftCards: 'Gift Cards',
  waivers: 'Waivers',
  smsTemplates: 'SMS Templates',
  smsEvents: 'SMS Events',
  appointments: 'Appointments',
}

const NAV_SECTION_LABELS: Record<string, string> = {
  overview: 'Overview',
  scheduling: 'Scheduling',
  people: 'People',
  sales: 'Sales',
  admin: 'Admin',
}

const MARKETING_LABELS: Record<string, string> = {
  sectionTitle: 'Marketing',
  templates: 'Email Templates',
  events: 'Event Assignments',
  smartLists: 'Smart Lists',
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key.startsWith('nav.sections.')) {
        return NAV_SECTION_LABELS[key.replace('nav.sections.', '')] ?? key
      }
      if (key.startsWith('nav.')) {
        return NAV_LABELS[key.replace('nav.', '')] ?? key
      }
      if (key.startsWith('marketing.')) {
        return MARKETING_LABELS[key.replace('marketing.', '')] ?? key
      }
      return key
    },
  }),
}))

vi.mock('../../../src/renderer/src/components/SupportChat', () => ({
  SupportChat: () => null,
}))

vi.mock('../../../src/renderer/src/store/authStore', () => ({
  useAuthStore: (selector: (s: { logout: () => void }) => unknown) =>
    selector({ logout: vi.fn() }),
}))

function renderLayout() {
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="dashboard" element={<div>Dashboard Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('Layout sidebar navigation', () => {
  const expectedLinks: Array<[string, string]> = [
    ['Dashboard', '/dashboard'],
    ['Calendar', '/calendar'],
    ['Appointments', '/appointments'],
    ['Class Types', '/class-types'],
    ['Establishments', '/establishments'],
    ['Clients', '/clients'],
    ['Instructors', '/instructors'],
    ['Memberships', '/memberships'],
    ['Promo Codes', '/promo-codes'],
    ['Gift Cards', '/gift-cards'],
    ['Email Templates', '/marketing/templates'],
    ['Event Assignments', '/marketing/events'],
    ['SMS Templates', '/marketing/sms-templates'],
    ['SMS Events', '/marketing/sms-events'],
    ['Smart Lists', '/marketing/smartlists'],
    ['Tags', '/tags'],
    ['Waivers', '/waivers'],
    ['Reports', '/reports'],
    ['Settings', '/settings'],
  ]

  it('renders all 19 nav links with correct hrefs', () => {
    renderLayout()

    expect(expectedLinks).toHaveLength(19)
    for (const [label, href] of expectedLinks) {
      const link = screen.getByRole('link', { name: label })
      expect(link.getAttribute('href')).toBe(href)
    }
  })

  it('renders the category section headers', () => {
    renderLayout()

    expect(screen.getByText('Scheduling')).toBeTruthy()
    expect(screen.getByText('People')).toBeTruthy()
    expect(screen.getByText('Sales')).toBeTruthy()
    expect(screen.getByText('Marketing')).toBeTruthy()
    expect(screen.getByText('Admin')).toBeTruthy()
  })

  it('does not render a visible header above the lone Overview item', () => {
    renderLayout()

    expect(screen.queryByText('Overview')).toBeNull()
  })
})
