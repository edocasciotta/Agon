export interface ScheduledClass {
  id: number
  template_id: number
  template_name?: string
  starts_at: string
  ends_at: string
  capacity: number
  status: 'scheduled' | 'cancelled' | 'completed'
  notes?: string
}

export interface Booking {
  id: number
  client_id: number
  scheduled_class_id: number
  status: 'confirmed' | 'cancelled' | 'no_show'
  credit_deducted: boolean
  created_at: string
  // Enriched fields resolved server-side from the linked scheduled class. All
  // optional/nullable — a cancelled or orphaned class may not resolve.
  class_type_name?: string | null
  location_name?: string | null
  instructor_name?: string | null
  class_starts_at?: string | null
  class_ends_at?: string | null
}

export interface Instructor {
  id: number
  user_id: number
  full_name: string
  email: string
  bio?: string
  is_active: boolean
}

export interface AppointmentService {
  id: number
  location_id: number
  name: string
  description?: string
  duration_minutes: number
  buffer_minutes: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show'

export interface Appointment {
  id: number
  location_id: number
  service_id: number
  instructor_id: number
  client_id: number
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  cancelled_at?: string | null
  cancellation_reason?: string | null
  credit_deducted: boolean
  notes?: string | null
  created_at: string
  updated_at: string
  // Enriched fields resolved server-side. All optional/nullable.
  service_name?: string | null
  instructor_name?: string | null
  location_name?: string | null
}

export interface AppointmentCreate {
  service_id: number
  instructor_id: number
  starts_at: string
  notes?: string
}

export interface AvailableSlot {
  starts_at: string
  ends_at: string
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
}

export interface MembershipType {
  id: number
  name: string
  type: string
  price: number
  currency: string
  credits_included?: number
  unlimited: boolean
  sellable_online: boolean
  is_active?: boolean
  is_intro_offer: boolean
  intro_price?: number | null
  intro_validity_days?: number | null
}

export interface PromoCodeValidateResponse {
  valid: boolean
  discount_type: string
  discount_value: number
  discount_amount: number
  original_price: number
  final_price: number
}

export interface GiftCardValidateResponse {
  valid: boolean
  remaining_balance: number
  currency: string
}

export interface GiftCardPurchaseRequest {
  amount: number
  recipient_name?: string
  recipient_email?: string
  message?: string
  success_url: string
  cancel_url: string
}

export interface ClientTag {
  id: number
  client_id: number
  tag_id: number
  tag_name: string
  tag_color: string
  assigned_at: string
  assigned_by: number | null
}

export interface NotificationLog {
  id: number
  type: string
  title: string
  body: string
  status: string
  created_at: string
}

export interface CalendarSyncResponse {
  feed_url: string
}

export interface StudioBranding {
  studio_name: string
  primary_color: string | null
  secondary_color: string | null
}

export interface ClientUser {
  id: number
  email: string
  full_name: string
  role: string
  photo_url: string | null
}
