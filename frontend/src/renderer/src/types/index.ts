export interface StudioSettings {
  id: number
  studio_name: string
  address?: string
  timezone: string
  cancellation_hours: number
  cancellation_deducts_credit: boolean
  checkin_open_minutes_before: number
  checkin_close_minutes_after: number
  waitlist_confirm_minutes: number
  guest_bookings_enabled: boolean
  self_service_purchases_enabled: boolean
  reminder_hours_before: number
  stripe_connected: boolean
  tunnel_url?: string
  last_backup_at?: string
}

export interface Client {
  id: number
  email: string
  full_name: string
  phone?: string
  is_active: boolean
  created_at: string
}

export interface ScheduledClass {
  id: number
  template_id: number
  instructor_id?: number
  starts_at: string
  ends_at: string
  capacity: number
  status: 'scheduled' | 'cancelled' | 'completed'
  notes?: string
}

export interface ClassTemplate {
  id: number
  name: string
  description?: string
  duration_minutes: number
  default_capacity: number
  default_instructor_id?: number
  color: string
  is_active: boolean
}

export interface MembershipType {
  id: number
  name: string
  type: 'recurring' | 'credit_pack'
  price: number
  currency: string
  credits_included?: number
  unlimited: boolean
  is_active: boolean
}

export interface Membership {
  id: number
  client_id: number
  membership_type_id: number
  status: string
  starts_at: string
  expires_at?: string
  credits_remaining?: number
  credits_used: number
}

export interface Booking {
  id: number
  client_id: number
  scheduled_class_id: number
  status: string
  credit_deducted: boolean
}

export interface AttendanceReport {
  period: { start: string; end: string }
  total_classes: number
  total_bookings: number
  total_checkins: number
  checkin_rate: number
  avg_class_size: number
  classes_cancelled: number
  classes_completed: number
}

export interface RevenueReport {
  period: { start: string; end: string }
  total_revenue: number
  currency: string
  payment_count: number
  avg_payment: number
}
