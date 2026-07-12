import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/authStore'
import { PageHeader } from '../../components/PageHeader'
import { UpcomingTab } from './UpcomingTab'
import { ServicesTab } from './ServicesTab'
import { AvailabilityTab } from './AvailabilityTab'

type Tab = 'upcoming' | 'services' | 'availability'

export function AppointmentsPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState<Tab>('upcoming')

  const canManageServices = user?.role === 'manager'

  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-indigo-600 text-indigo-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`

  return (
    <div>
      <PageHeader title={t('appointments.title')} subtitle={t('appointments.subtitle')} />

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <button
            className={tabClass('upcoming')}
            onClick={() => setActiveTab('upcoming')}
            role="tab"
            aria-selected={activeTab === 'upcoming'}
          >
            {t('appointments.tabUpcoming')}
          </button>
          {canManageServices && (
            <button
              className={tabClass('services')}
              onClick={() => setActiveTab('services')}
              role="tab"
              aria-selected={activeTab === 'services'}
            >
              {t('appointments.tabServices')}
            </button>
          )}
          {(user?.role === 'manager' || user?.role === 'instructor') && (
            <button
              className={tabClass('availability')}
              onClick={() => setActiveTab('availability')}
              role="tab"
              aria-selected={activeTab === 'availability'}
            >
              {t('appointments.tabAvailability')}
            </button>
          )}
        </nav>
      </div>

      {activeTab === 'upcoming' && <UpcomingTab />}
      {activeTab === 'services' && canManageServices && <ServicesTab />}
      {activeTab === 'availability' && <AvailabilityTab />}
    </div>
  )
}
