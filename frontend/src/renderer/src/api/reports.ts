import { apiClient } from './client'
import type { AttendanceReport, RevenueReport, RetentionReport } from '../types'

export const reportsApi = {
  attendance: async (params?: { start_date?: string; end_date?: string }): Promise<AttendanceReport> => {
    const res = await apiClient.get('/api/v1/reports/attendance', { params })
    return res.data
  },
  revenue: async (params?: { start_date?: string; end_date?: string }): Promise<RevenueReport> => {
    const res = await apiClient.get('/api/v1/reports/revenue', { params })
    return res.data
  },
  membershipsReport: async () => {
    const res = await apiClient.get('/api/v1/reports/memberships')
    return res.data
  },
  retentionReport: async (): Promise<RetentionReport> => {
    const res = await apiClient.get('/api/v1/reports/retention')
    return res.data
  },
  exportAttendanceCsv: () => `http://localhost:8000/api/v1/reports/attendance/export`,
  exportRevenueCsv: () => `http://localhost:8000/api/v1/reports/revenue/export`,
}
