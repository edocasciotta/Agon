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
}

export interface NotificationLog {
  id: number
  type: string
  title: string
  body: string
  status: string
  created_at: string
}
