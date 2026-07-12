import { z } from 'zod'

export const clientSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
})

export const instructorSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  bio: z.string().max(1000).optional(),
})

export const membershipTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.enum(['recurring', 'credit_pack']),
  price: z
    .string()
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, 'Price must be 0 or greater'),
  currency: z.string().min(1),
  credits_included: z
    .string()
    .optional()
    .refine(
      (v) => !v || (!isNaN(Number(v)) && Number(v) >= 1),
      'Credits must be at least 1'
    ),
  unlimited: z.boolean(),
  sellable_online: z.boolean(),
  is_intro_offer: z.boolean(),
  intro_price: z
    .string()
    .optional()
    .refine(
      (v) => !v || (!isNaN(Number(v)) && Number(v) >= 0),
      'Intro price must be 0 or greater'
    ),
  intro_validity_days: z
    .string()
    .optional()
    .refine(
      (v) => !v || (!isNaN(Number(v)) && Number(v) >= 1),
      'Intro validity must be at least 1 day'
    ),
})

export const classTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  duration_minutes: z
    .number({ invalid_type_error: 'Duration is required' })
    .int()
    .min(1, 'Duration must be at least 1 minute'),
  default_capacity: z
    .number({ invalid_type_error: 'Capacity is required' })
    .int()
    .min(1, 'Capacity must be at least 1'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color'),
  default_instructor_id: z.string().optional(),
})

export const promoCodeSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z
    .string()
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Discount value must be greater than 0'),
  max_uses: z
    .string()
    .optional()
    .refine(
      (v) => !v || (!isNaN(Number(v)) && Number(v) >= 1),
      'Max uses must be at least 1'
    ),
  one_per_client: z.boolean(),
  valid_from: z.string().min(1, 'Valid from date is required'),
  valid_until: z.string().optional(),
  is_active: z.boolean(),
})

export const establishmentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  address: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
})

export const tagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color'),
})

export const autoTagRuleSchema = z.object({
  tag_id: z.number().min(1, 'Tag is required'),
  trigger_event: z.enum([
    'booking_created',
    'booking_cancelled',
    'membership_purchased',
    'membership_expired',
    'no_show',
    'checkin',
  ]),
  is_active: z.boolean(),
})

export const giftCardSchema = z.object({
  initial_value: z
    .string()
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Initial value must be greater than 0'),
  recipient_name: z.string().max(100).optional(),
  recipient_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  message: z.string().max(500).optional(),
  expires_at: z.string().optional(),
})

export const waiverSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().min(1, 'Body is required'),
  requires_before_booking: z.boolean(),
})

export const appointmentServiceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  duration_minutes: z
    .number({ invalid_type_error: 'Duration is required' })
    .int()
    .min(1, 'Duration must be at least 1 minute'),
  buffer_minutes: z
    .number({ invalid_type_error: 'Buffer must be a number' })
    .int()
    .min(0, 'Buffer must be 0 or greater'),
})

export const instructorAvailabilitySchema = z
  .object({
    instructor_id: z.number().min(1, 'Instructor is required'),
    day_of_week: z.number().int().min(0).max(6),
    start_time: z.string().min(1, 'Start time is required'),
    end_time: z.string().min(1, 'End time is required'),
  })
  .refine((data) => data.end_time > data.start_time, {
    message: 'End time must be after start time',
    path: ['end_time'],
  })

export const bookAppointmentSchema = z.object({
  service_id: z.number().min(1, 'Service is required'),
  instructor_id: z.number().min(1, 'Instructor is required'),
  starts_at: z.string().min(1, 'A time slot is required'),
  client_id: z.number().min(1, 'Client is required'),
  notes: z.string().max(1000).optional(),
})

export type ClientFormData = z.infer<typeof clientSchema>
export type InstructorFormData = z.infer<typeof instructorSchema>
export type MembershipTypeFormData = z.infer<typeof membershipTypeSchema>
export type ClassTypeFormData = z.infer<typeof classTypeSchema>
export type PromoCodeFormData = z.infer<typeof promoCodeSchema>
export type EstablishmentFormData = z.infer<typeof establishmentSchema>
export type TagFormData = z.infer<typeof tagSchema>
export type AutoTagRuleFormData = z.infer<typeof autoTagRuleSchema>
export type GiftCardFormData = z.infer<typeof giftCardSchema>
export type WaiverFormData = z.infer<typeof waiverSchema>
export type AppointmentServiceFormData = z.infer<typeof appointmentServiceSchema>
export type InstructorAvailabilityFormData = z.infer<typeof instructorAvailabilitySchema>
export type BookAppointmentFormData = z.infer<typeof bookAppointmentSchema>
