import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
} from 'date-fns'
import {
  Users,
  CalendarDays,
  BadgeCheck,
  Banknote,
  CalendarPlus,
  UserPlus,
  CreditCard,
  BarChart2,
  type LucideIcon,
} from 'lucide-react'
import { classesApi } from '../api/classes'
import { classTemplatesApi } from '../api/classTemplates'
import { instructorsApi } from '../api/instructors'
import { clientsApi } from '../api/clients'
import { reportsApi } from '../api/reports'
import { locationsApi } from '../api/locations'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { ScheduledClass, ClassTemplate } from '../types'

// ─── helpers ────────────────────────────────────────────────────────────────

function greeting(t: (k: string) => string): string {
  const h = new Date().getHours()
  if (h < 12) return t('dashboard.greetingMorning')
  if (h < 18) return t('dashboard.greetingAfternoon')
  return t('dashboard.greetingEvening')
}

function fmtMoney(value: number, currency?: string): string {
  const sym = currency === 'EUR' ? '€' : (currency ?? '€')
  return `${sym}${value.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ─── sub-components ─────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  sub?: string
  accentClass: string
  iconBg: string
  iconColor: string
  loading?: boolean
}

function KpiCard({ icon: Icon, label, value, sub, accentClass, iconBg, iconColor, loading }: KpiCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden relative">
      <div className={`h-0.5 w-full ${accentClass}`} />
      <div className="p-5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
          style={{ background: iconBg, color: iconColor }}
        >
          <Icon size={16} strokeWidth={1.75} />
        </div>
        {loading ? (
          <div className="mt-1"><LoadingSpinner size="sm" /></div>
        ) : (
          <div className="text-2xl font-medium text-gray-900 leading-none">{value}</div>
        )}
        <div className="text-xs text-gray-500 mt-1">{label}</div>
        {sub && (
          <div className="text-[11px] text-gray-400 mt-2.5 pt-2.5 border-t border-gray-100">
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}

interface ClassRowProps {
  cls: ScheduledClass
  template?: ClassTemplate
  instructorName?: string
  locationName?: string
}

function ClassRow({ cls, template, instructorName, locationName }: ClassRowProps) {
  const color = template?.color ?? '#4F46E5'
  const starts = new Date(cls.starts_at)
  const isFuture = starts > new Date()
  const isPast = new Date(cls.ends_at) < new Date()

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: isPast ? '#d1d5db' : color }}
      />
      <span className="text-[11px] font-medium text-gray-400 w-10 flex-shrink-0">
        {format(starts, 'HH:mm')}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {template?.name ?? `#${cls.id}`}
        </div>
        <div className="text-[11px] text-gray-400 truncate">
          {[instructorName, locationName].filter(Boolean).join(' · ')}
        </div>
      </div>
      <span
        className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full"
        style={
          isFuture
            ? { background: `${color}18`, color }
            : { background: '#f3f4f6', color: '#9ca3af' }
        }
      >
        {cls.capacity}
      </span>
    </div>
  )
}

interface QuickActionProps {
  icon: LucideIcon
  label: string
  iconBg: string
  iconColor: string
  onClick: () => void
}

function QuickAction({ icon: Icon, label, iconBg, iconColor, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors w-full text-left"
    >
      <span
        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        <Icon size={15} strokeWidth={1.75} />
      </span>
      <span className="text-sm font-medium text-gray-800">{label}</span>
      <span className="ml-auto text-gray-300 text-base">›</span>
    </button>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const now = new Date()

  const today = format(now, 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  const { data: allClasses, isLoading: classesLoading } = useQuery({
    queryKey: ['classes', weekStart, weekEnd],
    queryFn: () => classesApi.list({ start_date: weekStart, end_date: weekEnd }),
  })

  const { data: templates } = useQuery({
    queryKey: ['class-templates'],
    queryFn: classTemplatesApi.list,
  })

  const { data: instructors } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => instructorsApi.list(),
  })

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list(false),
  })

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients', 'dashboard'],
    queryFn: () => clientsApi.list(undefined, 1, 100),
  })

  const { data: membershipsReport, isLoading: membershipsLoading } = useQuery({
    queryKey: ['reports', 'memberships'],
    queryFn: () => reportsApi.membershipsReport(),
  })

  const { data: revenueReport, isLoading: revenueLoading } = useQuery({
    queryKey: ['reports', 'revenue', monthStart, monthEnd],
    queryFn: () => reportsApi.revenue({ start_date: monthStart, end_date: monthEnd }),
  })

  // Derived values
  const templateMap: Record<number, ClassTemplate> = {}
  if (templates) for (const tpl of templates) templateMap[tpl.id] = tpl

  const instructorMap: Record<number, string> = {}
  if (instructors) for (const ins of instructors) instructorMap[ins.id] = ins.full_name

  const locationMap: Record<number, string> = {}
  if (locations) for (const loc of locations) locationMap[loc.id] = loc.name
  const multipleLocations = (locations?.length ?? 0) > 1

  const todayClasses = (allClasses ?? [])
    .filter((c) => isSameDay(new Date(c.starts_at), now) && c.status !== 'cancelled')
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())

  const weekScheduled = (allClasses ?? []).filter((c) => c.status === 'scheduled').length
  const weekCancelled = (allClasses ?? []).filter((c) => c.status === 'cancelled').length

  // New clients this month (based on the most recent 100 clients)
  const newClientsThisMonth = (clients?.items ?? []).filter((c: any) => {
    if (!c.created_at) return false
    const d = new Date(c.created_at)
    return d >= startOfMonth(now) && d <= endOfMonth(now)
  }).length

  const revenue = revenueReport?.total_revenue ?? 0
  const currency = revenueReport?.currency
  const paymentCount = revenueReport?.payment_count ?? 0

  const studioName = 'Agon Studio'

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-medium text-gray-900">
          {greeting(t)}, {studioName}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {format(now, 'EEEE d MMMM yyyy')} · {t('dashboard.todaySummary')}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Users}
          label={t('dashboard.totalClients')}
          value={clients?.total ?? '—'}
          sub={newClientsThisMonth > 0 ? t('dashboard.newThisMonth').replace('{{n}}', String(newClientsThisMonth)) : undefined}
          accentClass="bg-blue-400"
          iconBg="#E6F1FB"
          iconColor="#185FA5"
          loading={clientsLoading}
        />
        <KpiCard
          icon={CalendarDays}
          label={t('dashboard.classesThisWeek')}
          value={classesLoading ? '—' : weekScheduled}
          sub={weekCancelled > 0 ? t('dashboard.cancelledCount').replace('{{n}}', String(weekCancelled)) : undefined}
          accentClass="bg-green-500"
          iconBg="#EAF3DE"
          iconColor="#3B6D11"
          loading={classesLoading}
        />
        <KpiCard
          icon={BadgeCheck}
          label={t('dashboard.activeMemberships')}
          value={membershipsReport?.total_active ?? '—'}
          sub={
            (membershipsReport?.expiring_soon ?? 0) > 0
              ? t('dashboard.expiringSoon').replace('{{n}}', String(membershipsReport?.expiring_soon))
              : undefined
          }
          accentClass="bg-amber-400"
          iconBg="#FAEEDA"
          iconColor="#854F0B"
          loading={membershipsLoading}
        />
        <KpiCard
          icon={Banknote}
          label={t('dashboard.revenueThisMonth')}
          value={revenueLoading ? '—' : fmtMoney(revenue, currency)}
          sub={paymentCount > 0 ? t('dashboard.paymentsCount').replace('{{n}}', String(paymentCount)) : undefined}
          accentClass="bg-indigo-400"
          iconBg="#EEEDFE"
          iconColor="#534AB7"
          loading={revenueLoading}
        />
      </div>

      {/* Today + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Today's classes */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-900">{t('dashboard.todayClasses')}</span>
            <span className="text-xs text-gray-400">{format(now, 'd MMM')}</span>
          </div>
          {classesLoading ? (
            <div className="flex items-center justify-center h-32">
              <LoadingSpinner size="sm" />
            </div>
          ) : todayClasses.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">
              {t('dashboard.noClassesToday')}
            </div>
          ) : (
            <div>
              {todayClasses.map((cls) => (
                <ClassRow
                  key={cls.id}
                  cls={cls}
                  template={templateMap[cls.template_id]}
                  instructorName={cls.instructor_id ? instructorMap[cls.instructor_id] : undefined}
                  locationName={multipleLocations && cls.location_id ? locationMap[cls.location_id] : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-900">{t('dashboard.quickActions')}</span>
          </div>
          <QuickAction
            icon={CalendarPlus}
            label={t('dashboard.scheduleClass')}
            iconBg="#E6F1FB"
            iconColor="#185FA5"
            onClick={() => navigate('/calendar')}
          />
          <QuickAction
            icon={UserPlus}
            label={t('dashboard.addClient')}
            iconBg="#EAF3DE"
            iconColor="#3B6D11"
            onClick={() => navigate('/clients')}
          />
          <QuickAction
            icon={CreditCard}
            label={t('dashboard.assignMembership')}
            iconBg="#FAEEDA"
            iconColor="#854F0B"
            onClick={() => navigate('/memberships')}
          />
          <QuickAction
            icon={BarChart2}
            label={t('dashboard.viewReports')}
            iconBg="#EEEDFE"
            iconColor="#534AB7"
            onClick={() => navigate('/reports')}
          />
        </div>
      </div>
    </div>
  )
}
