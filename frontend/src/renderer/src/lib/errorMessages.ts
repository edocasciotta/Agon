export const errorMessages: Record<string, string> = {
  BOOKING_CLASS_FULL: 'This class is full. You can join the waitlist.',
  BOOKING_DUPLICATE: 'You already have a booking for this class.',
  BOOKING_NO_MEMBERSHIP: 'You need an active membership to book this class.',
  BOOKING_CLASS_NOT_SCHEDULED: 'This class is not available for booking.',
  BOOKING_CLASS_ALREADY_STARTED: 'This class has already started.',
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password.',
  AUTH_TOKEN_INVALID: 'Your session has expired. Please log in again.',
  AUTH_INSUFFICIENT_PERMISSIONS: 'You do not have permission to do this.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Something went wrong. Please try again.',
}

export function getErrorMessage(code: string): string {
  return errorMessages[code] ?? `An error occurred (${code})`
}
