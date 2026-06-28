import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { reportsApi } from '../api/reports'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'

type ReportTab = 'attendance' | 'revenue' | 'memberships' | 'retention'

export function ReportsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<ReportTab>('attendance')
  const now = new Date()
  const [startDate, setStartDate] = useState(format(startOfMonth(now), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(now), 'yyyy-MM-dd'))

  const { data: attendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ['reports', 'attendance', startDate, endDate],
    queryFn: () => reportsApi.attendance({ start_date: startDate, end_date: endDate }),
    enabled: activeTab === 'attendance',
  })

  const { data: revenue, isLoading: revenueLoading } = useQuery({
    queryKey: ['reports', 'revenue', startDate, endDate],
    queryFn: () => reportsApi.revenue({ start_date: startDate, end_date: endDate }),
    enabled: activeTab === 'revenue',
  })

  const { data: memberships, isLoading: membershipsLoading } = useQuery({
    queryKey: ['reports', 'memberships'],
    queryFn: () => reportsApi.membershipsReport(),
    enabled: activeTab === 'memberships',
  })

  const { data: retention, isLoading: retentionLoading } = useQuery({
    queryKey: ['reports', 'retention'],
    queryFn: () => reportsApi.retentionReport(),
    enabled: activeTab === 'retention',
  })

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'attendance', label: t('reports.attendance') },
    { id: 'revenue', label: t('reports.revenue') },
    { id: 'memberships', label: t('reports.memberships') },
    { id: 'retention', label: t('reports.retention') },
  ]

  return (
    <div>
      <PageHeader title={t('reports.title')} />

      {/* Date Range (for attendance + revenue) */}
      {(activeTab === 'attendance' || activeTab === 'revenue') && (
        <div className="flex items-center gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('reports.from')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('reports.to')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div>
          {attendanceLoading ? (
            <LoadingSpinner />
          ) : attendance ? (
            <div>
              <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-4">
                <StatCard title={t('reports.totalClasses')} value={attendance.total_classes} />
                <StatCard title={t('reports.totalBookings')} value={attendance.total_bookings} />
                <StatCard title={t('reports.totalCheckins')} value={attendance.total_checkins} />
                <StatCard title={t('reports.checkinRate')} value={`${(attendance.checkin_rate * 100).toFixed(1)}%`} />
                <StatCard title={t('reports.avgClassSize')} value={attendance.avg_class_size?.toFixed(1) ?? '—'} />
                <StatCard title={t('reports.classesCancelled')} value={attendance.classes_cancelled} />
                <StatCard title={t('reports.classesCompleted')} value={attendance.classes_completed} />
              </div>
              <button
                onClick={() => { window.location.href = reportsApi.exportAttendanceCsv() }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                {t('reports.exportCsv')}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === 'revenue' && (
        <div>
          {revenueLoading ? (
            <LoadingSpinner />
          ) : revenue ? (
            <div>
              <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-3">
                <StatCard title={t('reports.totalRevenue')} value={`${revenue.currency} ${revenue.total_revenue?.toFixed(2)}`} />
                <StatCard title={t('reports.paymentCount')} value={revenue.payment_count} />
                <StatCard title={t('reports.avgPayment')} value={`${revenue.currency} ${revenue.avg_payment?.toFixed(2)}`} />
              </div>
              <button
                onClick={() => { window.location.href = reportsApi.exportRevenueCsv() }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                {t('reports.exportCsv')}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Memberships Tab */}
      {activeTab === 'memberships' && (
        <div>
          {membershipsLoading ? (
            <LoadingSpinner />
          ) : memberships ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <StatCard title={t('reports.totalActive')} value={memberships.total_active ?? '—'} />
              <StatCard title={t('reports.totalExpired')} value={memberships.total_expired ?? '—'} />
              <StatCard title={t('reports.totalCancelled')} value={memberships.total_cancelled ?? '—'} />
            </div>
          ) : null}
        </div>
      )}

      {/* Retention Tab */}
      {activeTab === 'retention' && (
        <div>
          {retentionLoading ? (
            <LoadingSpinner />
          ) : retention ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard title={t('reports.totalClients')} value={retention.total_clients ?? '—'} />
              <StatCard title={t('reports.activeClients')} value={retention.active_clients ?? '—'} />
              <StatCard title={t('reports.newClients')} value={retention.new_clients ?? '—'} />
              <StatCard title={t('reports.churnedClients')} value={retention.churned_clients ?? '—'} />
              {retention.retention_rate !== undefined && (
                <StatCard title={t('reports.retentionRate')} value={`${(retention.retention_rate * 100).toFixed(1)}%`} />
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}
