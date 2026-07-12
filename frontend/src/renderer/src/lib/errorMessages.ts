import type { ApiError } from '../api/client'

export const errorMessages: Record<string, string> = {
  // Bookings
  BOOKING_CLASS_FULL: 'This class is full. You can join the waitlist.',
  BOOKING_DUPLICATE: 'You already have a booking for this class.',
  BOOKING_NO_MEMBERSHIP: 'You need an active membership to book this class.',
  BOOKING_CLASS_NOT_SCHEDULED: 'This class is not available for booking.',
  BOOKING_CLASS_ALREADY_STARTED: 'This class has already started.',
  BOOKING_ALREADY_CANCELLED: 'This booking has already been cancelled.',
  BOOKING_WAITLIST_DUPLICATE: 'This client is already on the waitlist.',
  WAIVER_SIGNATURE_REQUIRED: 'This client must sign a required waiver before this booking can be made.',
  // Waitlist
  WAITLIST_OFFER_EXPIRED: 'The waitlist offer has expired.',
  WAITLIST_OFFER_NOT_ACTIVE: 'The waitlist offer is no longer active.',
  // Auth
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password.',
  AUTH_TOKEN_INVALID: 'Your session has expired. Please log in again.',
  AUTH_INSUFFICIENT_PERMISSIONS: 'You do not have permission to do this.',
  // Classes
  CLASS_HAS_BOOKINGS: 'This class cannot be removed because it has existing bookings.',
  // Memberships / billing
  MEMBERSHIP_TYPE_NOT_FOUND: 'This membership type is no longer available.',
  MEMBERSHIP_TYPE_NOT_ONLINE: 'This membership type is not available for online purchase.',
  MEMBERSHIP_TYPE_HAS_MEMBERS: 'This plan has existing members and cannot be deleted. Deactivate it instead.',
  CLIENT_NOT_FOUND: 'Client not found.',
  STRIPE_API_ERROR: 'A payment error occurred. Please try again.',
  STRIPE_NOT_CONFIGURED: 'Online payments are not set up for this studio yet.',
  STUDIO_NOT_FOUND: 'Studio configuration not found.',
  // Tags
  TAG_DUPLICATE: 'A tag with this name already exists.',
  // Appointments
  APPOINTMENT_ALREADY_CANCELLED: 'This appointment is not confirmed and cannot be cancelled again.',
  APPOINTMENT_IN_PAST: 'The requested start time is in the past.',
  APPOINTMENT_NOT_CONFIRMED: 'This appointment is not confirmed.',
  APPOINTMENT_SERVICE_INACTIVE: 'This service is not currently offered.',
  APPOINTMENT_INSTRUCTOR_INACTIVE: 'This instructor is not currently active.',
  APPOINTMENT_OUTSIDE_AVAILABILITY: "Requested time is outside the instructor's availability.",
  APPOINTMENT_SLOT_CONFLICT: 'This time slot conflicts with another appointment.',
  // Generic
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Some fields are invalid. Please check and try again.',
  SERVER_ERROR: 'Something went wrong. Please try again.',
}

export function getErrorMessage(code: string): string {
  return errorMessages[code] ?? `An error occurred (${code})`
}

/**
 * Extracts a user-friendly message from any thrown value.
 * Priority: mapped code message → API message → fallback.
 */
export function resolveApiError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const apiErr = err as ApiError
    return errorMessages[apiErr.code] ?? apiErr.message ?? fallback
  }
  if (err instanceof Error) return err.message
  return fallback
}
