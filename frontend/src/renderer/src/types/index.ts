export interface StudioSettings {
  id: number
  studio_name: string
  address?: string
  timezone: string
  cancellation_hours: number
  cancellation_deducts_credit: boolean
  late_cancel_fee: number
  no_show_fee: number
  checkin_open_minutes_before: number
  checkin_close_minutes_after: number
  waitlist_confirm_minutes: number
  guest_bookings_enabled: boolean
  self_service_purchases_enabled: boolean
  reminder_hours_before: number
  calendar_start_hour: number
  calendar_end_hour: number
  primary_color?: string
  secondary_color?: string
  stripe_connected: boolean
  tunnel_url?: string
  lan_url?: string
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
  booking_count: number
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
  cancellation_window_hours?: number | null
  booking_open_hours_before?: number | null
  booking_close_hours_before?: number | null
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
  sellable_online: boolean
  late_cancel_fee_override?: number | null
  no_show_fee_override?: number | null
  rollover_enabled: boolean
  max_rollover_credits?: number | null
  is_intro_offer: boolean
  intro_price?: number | null
  intro_validity_days?: number | null
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
  rollover_credits: number
  client_name?: string | null
  membership_type_name?: string | null
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

// SMS Settings
export interface SmsSettings {
  sms_provider_account_sid: string | null
  sms_provider_auth_token: string
  sms_from_number: string | null
  sms_enabled: boolean
}

// SMS Templates
export interface SmsTemplateListItem {
  id: number
  name: string
  body: string
  created_at: string
  updated_at: string
}
export type SmsTemplateResponse = SmsTemplateListItem
export interface SmsTemplateCreate {
  name: string
  body: string
}

// SMS Events
export interface SmsEventAssignment {
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
  busiest_day?: string
  by_class_template: { template_name: string; classes: number; bookings: number; checkins: number }[]
}

export interface RevenueReport {
  period: { start: string; end: string }
  total_revenue: number
  currency: string
  payment_count: number
  avg_payment: number
  by_membership_type: { name: string; revenue: number; count: number }[]
}

export interface PromoCode {
  id: number
  location_id: number
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  applicable_membership_type_ids?: number[] | null
  max_uses?: number | null
  current_uses: number
  one_per_client: boolean
  valid_from: string
  valid_until?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PromoCodeCreate {
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  applicable_membership_type_ids?: number[] | null
  max_uses?: number | null
  one_per_client: boolean
  valid_from: string
  valid_until?: string | null
  is_active: boolean
}

export interface PromoCodeValidateResponse {
  valid: boolean
  discount_type: string
  discount_value: number
  discount_amount: number
  original_price: number
  final_price: number
}

export interface RetentionReport {
  period: { start: string; end: string }
  total_clients: number
  active_clients: number
  new_clients: number
  churned_clients: number
  retention_rate: number
}

// Tags
export interface Tag {
  id: number
  name: string
  color: string
  created_at: string
  updated_at: string
}

export interface TagCreate {
  name: string
  color?: string
}

export interface ClientTag {
  id: number
  client_id: number
  tag_id: number
  tag_name: string
  tag_color: string
  assigned_at: string
  assigned_by: string
}

// Auto-Tag Rules
export type AutoTagTriggerEvent =
  | 'booking_created'
  | 'booking_cancelled'
  | 'membership_purchased'
  | 'membership_expired'
  | 'no_show'
  | 'checkin'

export interface AutoTagRule {
  id: number
  tag_id: number
  trigger_event: AutoTagTriggerEvent
  condition_json: Record<string, unknown> | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AutoTagRuleCreate {
  tag_id: number
  trigger_event: AutoTagTriggerEvent
  condition_json?: Record<string, unknown> | null
  is_active?: boolean
}

// Gift Cards
export interface GiftCard {
  id: number
  location_id: number
  code: string
  initial_value: number
  remaining_balance: number
  currency: string
  purchaser_client_id: number | null
  recipient_name: string | null
  recipient_email: string | null
  message: string | null
  is_active: boolean
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface GiftCardIssue {
  initial_value: number
  recipient_name?: string | null
  recipient_email?: string | null
  message?: string | null
  expires_at?: string | null
}

export interface GiftCardValidateResponse {
  valid: boolean
  remaining_balance: number
  currency: string
}

// Calendar Sync (iCal)
export interface CalendarSyncResponse {
  feed_url: string
}

// Waivers
export interface WaiverResponse {
  id: number
  location_id: number
  title: string
  body: string
  version: number
  requires_before_booking: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WaiverCreate {
  title: string
  body: string
  requires_before_booking: boolean
}

export interface WaiverUpdate {
  title?: string
  body?: string
  requires_before_booking?: boolean
}

export interface WaiverWithStatus extends WaiverResponse {
  is_signed: boolean
  signed_at: string | null
}
