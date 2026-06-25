import { useQuery } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { clientsApi } from '../api/clients'
import { classesApi } from '../api/classes'
import { reportsApi } from '../api/reports'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'

function StatCard({ title, value, subtitle, loading }: { title: string; value: string | number; subtitle?: string; loading?: boolean }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {loading ? (
        <div className="mt-2"><LoadingSpinner size="sm" /></div>
      ) : (
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      )}
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}

export function Dashboard() {
  const now = new Date()
  const weekStart = format(startOfWeek(now), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(now), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
  })

  const { data: weekClasses, isLoading: classesLoading } = useQuery({
    queryKey: ['classes', 'week', weekStart, weekEnd],
    queryFn: () => classesApi.list({ start_date: weekStart, end_date: weekEnd }),
  })

  const { data: membershipsReport, isLoading: membershipsLoading } = useQuery({
    queryKey: ['reports', 'memberships'],
    queryFn: () => reportsApi.membershipsReport(),
  })

  const { data: revenueReport, isLoading: revenueLoading } = useQuery({
    queryKey: ['reports', 'revenue', monthStart, monthEnd],
    queryFn: () => reportsApi.revenue({ start_date: monthStart, end_date: monthEnd }),
  })

  const totalRevenue = revenueReport
    ? `${revenueReport.currency ?? '$'}${(revenueReport.total_revenue ?? 0).toFixed(2)}`
    : '—'

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your studio" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Clients"
          value={clients?.length ?? '—'}
          subtitle="registered clients"
          loading={clientsLoading}
        />
        <StatCard
          title="Classes This Week"
          value={weekClasses?.length ?? '—'}
          subtitle={`${weekStart} – ${weekEnd}`}
          loading={classesLoading}
        />
        <StatCard
          title="Active Memberships"
          value={membershipsReport?.total_active ?? '—'}
          subtitle="currently active"
          loading={membershipsLoading}
        />
        <StatCard
          title="Revenue This Month"
          value={totalRevenue}
          subtitle={`${monthStart} – ${monthEnd}`}
          loading={revenueLoading}
        />
      </div>
    </div>
  )
}
