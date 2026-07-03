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
  calendar_start_hour: number
  calendar_end_hour: number
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
  location_id: number
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

export interface EmailSettings {
  email_from_name: string | null
  email_from_address: string | null
  email_smtp_host: string | null
  email_smtp_port: number
  email_smtp_user: string | null
  email_smtp_password: string
  email_smtp_tls: boolean
}

// Email Templates
export interface EmailTemplateListItem {
  id: number
  name: string
  subject: string
  created_at: string
}
export interface EmailTemplateResponse extends EmailTemplateListItem {
  html_body: string
}
export interface EmailTemplateCreate {
  name: string
  subject: string
  html_body: string
}

// Email Events
export interface EmailEventAssignment {
  event_type: string
  label: string
  template: { id: number; name: string } | null
}

// Smart Lists
export interface SmartListFilters {
  membership_status?: 'active' | 'expired' | 'none'
  last_booked_within_days?: number
  not_booked_within_days?: number
  joined_before?: string
  joined_after?: string
  membership_type_id?: number
}
export interface SmartListCreate {
  name: string
  description?: string
  filters: SmartListFilters
}
export interface SmartListItem {
  id: number
  name: string
  description: string | null
  created_at: string
}
export interface SmartListResponse extends SmartListItem {
  filters: SmartListFilters
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
