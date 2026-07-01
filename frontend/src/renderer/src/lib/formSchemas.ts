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

export const establishmentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  address: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
})

export type ClientFormData = z.infer<typeof clientSchema>
export type InstructorFormData = z.infer<typeof instructorSchema>
export type MembershipTypeFormData = z.infer<typeof membershipTypeSchema>
export type ClassTypeFormData = z.infer<typeof classTypeSchema>
export type EstablishmentFormData = z.infer<typeof establishmentSchema>
