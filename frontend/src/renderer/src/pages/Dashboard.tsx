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
  BadgeCheck,
  Banknote,
  TrendingUp,
  Activity,
  CalendarPlus,
  UserPlus,
  CreditCard,
  BarChart2,
  type LucideIcon,
} from 'lucide-react'
import { classesApi } from '../api/classes'
import { classTemplatesApi } from '../api/classTemplates'
import { instructorsApi } from '../api/instructors'
import { locationsApi } from '../api/locations'
import { reportsApi } from '../api/reports'
import { studioApi } from '../api/studio'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { ScheduledClass, ClassTemplate } from '../types'

// ─── helpers ─────────────────────────────────────────────────────────────────

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

// ─── sub-components ──────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  sub?: string
  accent: string
  loading?: boolean
}

function KpiCard({ icon: Icon, label, value, sub, accent, loading }: KpiCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <div className="h-0.5 w-full" style={{ background: accent }} />
      <div className="p-5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
          style={{ background: `${accent}20`, color: accent }}
        >
          <Icon size={16} strokeWidth={1.75} />
        </div>
        {loading ? (
          <div className="mt-1">
            <LoadingSpinner size="sm" />
          </div>
        ) : (
          <div className="text-2xl font-medium text-gray-900 leading-none">{value}</div>
        )}
        <div className="text-xs text-gray-500 mt-1">{label}</div>
        {sub && (
          <div className="text-[11px] text-gray-400 mt-2.5 pt-2.5 border-t border-gray-100">{sub}</div>
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
  accent: string
}

function ClassRow({ cls, template, instructorName, locationName, accent }: ClassRowProps) {
  const starts = new Date(cls.starts_at)
  const isPast = new Date(cls.ends_at) < new Date()

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: isPast ? '#d1d5db' : accent }}
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
          !isPast
            ? { background: `${accent}18`, color: accent }
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
  accent: string
  onClick: () => void
}

function QuickAction({ icon: Icon, label, accent, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors w-full text-left"
    >
      <span
        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}18`, color: accent }}
      >
        <Icon size={15} strokeWidth={1.75} />
      </span>
      <span className="text-sm font-medium text-gray-800">{label}</span>
      <span className="ml-auto text-gray-300 text-base">›</span>
    </button>
  )
}

function BarRow({
  label,
  value,
  max,
  accent,
  sub,
}: {
  label: string
  value: number
  max: number
  accent: string
  sub?: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm text-gray-700 truncate max-w-[70%]">{label}</span>
        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{sub ?? value}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1">
        <div
          className="h-1 rounded-full transition-all"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="text-base font-semibold text-gray-900">{value}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const now = new Date()

  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  const { data: studioSettings } = useQuery({
    queryKey: ['studio'],
    queryFn: () => studioApi.get(),
  })

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

  const { data: membershipsReport, isLoading: membershipsLoading } = useQuery({
    queryKey: ['reports', 'memberships'],
    queryFn: () => reportsApi.membershipsReport(),
  })

  const { data: revenueReport, isLoading: revenueLoading } = useQuery({
    queryKey: ['reports', 'revenue', monthStart, monthEnd],
    queryFn: () => reportsApi.revenue({ start_date: monthStart, end_date: monthEnd }),
  })

  const { data: retentionReport, isLoading: retentionLoading } = useQuery({
    queryKey: ['reports', 'retention'],
    queryFn: () => reportsApi.retentionReport(),
  })

  const { data: attendanceReport, isLoading: attendanceLoading } = useQuery({
    queryKey: ['reports', 'attendance', monthStart, monthEnd],
    queryFn: () => reportsApi.attendance({ start_date: monthStart, end_date: monthEnd }),
  })

  // Studio brand colors — only these two are used everywhere
  const primary = studioSettings?.primary_color ?? '#4f46e5'
  const secondary = studioSettings?.secondary_color ?? '#10b981'

  // Derived maps
  const templateMap: Record<number, ClassTemplate> = {}
  if (templates) for (const tpl of templates) templateMap[tpl.id] = tpl

  const instructorMap: Record<number, string> = {}
  if (instructors) for (const ins of instructors) instructorMap[ins.id] = ins.full_name

  const locationMap: Record<number, string> = {}
  if (locations) for (const loc of locations) locationMap[loc.id] = loc.name
  const multipleLocations = (locations?.length ?? 0) > 1

  // Today's classes
  const todayClasses = (allClasses ?? [])
    .filter((c) => isSameDay(new Date(c.starts_at), now) && c.status !== 'cancelled')
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())

  // KPI values
  const activeMembers = membershipsReport?.total_active ?? 0
  const expiringSoon = membershipsReport?.expiring_soon ?? 0
  const revenue = revenueReport?.total_revenue ?? 0
  const currency = revenueReport?.currency
  const paymentCount = revenueReport?.payment_count ?? 0
  const avgPayment = revenueReport?.avg_payment ?? 0
  const retentionRate = retentionReport?.retention_rate ?? null
  const churned = retentionReport?.churned_clients ?? 0
  const checkinRate = attendanceReport?.checkin_rate ?? null
  const avgClassSize = attendanceReport?.avg_class_size ?? 0

  // Insights
  const topClasses = [...(attendanceReport?.by_class_template ?? [])]
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 4)
  const maxClassBookings = Math.max(...topClasses.map((c) => c.bookings), 1)

  const byType = membershipsReport?.by_type ?? []
  const maxTypeActive = Math.max(...byType.map((t) => t.active), 1)

  const studioName = studioSettings?.studio_name ?? 'Studio'

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
          icon={BadgeCheck}
          accent={primary}
          label={t('dashboard.activeMemberships')}
          value={membershipsLoading ? '—' : activeMembers}
          sub={
            expiringSoon > 0
              ? t('dashboard.expiringSoon').replace('{{n}}', String(expiringSoon))
              : undefined
          }
          loading={membershipsLoading}
        />
        <KpiCard
          icon={Banknote}
          accent={primary}
          label={t('dashboard.revenueThisMonth')}
          value={revenueLoading ? '—' : fmtMoney(revenue, currency)}
          sub={
            paymentCount > 0
              ? `${paymentCount} · ${t('dashboard.avgPaymentSub').replace('{{amount}}', fmtMoney(avgPayment, currency))}`
              : undefined
          }
          loading={revenueLoading}
        />
        <KpiCard
          icon={TrendingUp}
          accent={secondary}
          label={t('dashboard.retentionRate')}
          value={retentionRate !== null ? `${retentionRate}%` : '—'}
          sub={
            churned > 0
              ? t('dashboard.churned').replace('{{n}}', String(churned))
              : undefined
          }
          loading={retentionLoading}
        />
        <KpiCard
          icon={Activity}
          accent={secondary}
          label={t('dashboard.checkinRate')}
          value={checkinRate !== null ? `${checkinRate}%` : '—'}
          sub={
            avgClassSize > 0
              ? t('dashboard.avgPerClass').replace('{{n}}', String(avgClassSize))
              : undefined
          }
          loading={attendanceLoading}
        />
      </div>

      {/* Today's classes + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
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
                  locationName={
                    multipleLocations && cls.location_id ? locationMap[cls.location_id] : undefined
                  }
                  accent={primary}
                />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-900">{t('dashboard.quickActions')}</span>
          </div>
          <QuickAction
            icon={CalendarPlus}
            label={t('dashboard.scheduleClass')}
            accent={primary}
            onClick={() => navigate('/calendar')}
          />
          <QuickAction
            icon={UserPlus}
            label={t('dashboard.addClient')}
            accent={primary}
            onClick={() => navigate('/clients')}
          />
          <QuickAction
            icon={CreditCard}
            label={t('dashboard.assignMembership')}
            accent={primary}
            onClick={() => navigate('/memberships')}
          />
          <QuickAction
            icon={BarChart2}
            label={t('dashboard.viewReports')}
            accent={primary}
            onClick={() => navigate('/reports')}
          />
        </div>
      </div>

      {/* Insights row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Attendance highlights */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-900">
              {t('dashboard.attendanceHighlights')}
            </span>
          </div>
          {attendanceLoading ? (
            <div className="flex items-center justify-center h-28">
              <LoadingSpinner size="sm" />
            </div>
          ) : (
            <div className="p-4 grid grid-cols-2 gap-2">
              <StatCell
                label={t('dashboard.classesThisWeek')}
                value={
                  (allClasses ?? []).filter((c) => c.status === 'scheduled').length
                }
              />
              <StatCell
                label={t('dashboard.avgClassSize')}
                value={avgClassSize > 0 ? avgClassSize : '—'}
              />
              <StatCell
                label={t('dashboard.totalBookings')}
                value={attendanceReport?.total_bookings ?? '—'}
              />
              <StatCell
                label={t('dashboard.busiestDay')}
                value={attendanceReport?.busiest_day ?? '—'}
              />
            </div>
          )}
        </div>

        {/* Top class types */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-900">{t('dashboard.topClasses')}</span>
          </div>
          {attendanceLoading ? (
            <div className="flex items-center justify-center h-28">
              <LoadingSpinner size="sm" />
            </div>
          ) : topClasses.length === 0 ? (
            <div className="flex items-center justify-center h-28 text-sm text-gray-400">
              {t('dashboard.noData')}
            </div>
          ) : (
            <div className="p-4">
              {topClasses.map((c) => (
                <BarRow
                  key={c.template_name}
                  label={c.template_name}
                  value={c.bookings}
                  max={maxClassBookings}
                  accent={primary}
                  sub={String(c.bookings)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Members by plan */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-900">{t('dashboard.membersByType')}</span>
          </div>
          {membershipsLoading ? (
            <div className="flex items-center justify-center h-28">
              <LoadingSpinner size="sm" />
            </div>
          ) : byType.length === 0 ? (
            <div className="flex items-center justify-center h-28 text-sm text-gray-400">
              {t('dashboard.noData')}
            </div>
          ) : (
            <div className="p-4">
              {byType.map((item) => (
                <BarRow
                  key={item.name}
                  label={item.name}
                  value={item.active}
                  max={maxTypeActive}
                  accent={secondary}
                  sub={String(item.active)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
