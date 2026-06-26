export const errorMessages: Record<string, string> = {
  BOOKING_CLASS_FULL: 'This class is full. Join the waitlist?',
  BOOKING_DUPLICATE: 'You already have a booking for this class.',
  BOOKING_NO_MEMBERSHIP: 'You need an active membership to book.',
  BOOKING_CLASS_NOT_SCHEDULED: 'This class is no longer available.',
  BOOKING_CLASS_ALREADY_STARTED: 'This class has already started.',
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password.',
  AUTH_TOKEN_INVALID: 'Your session has expired. Please log in again.',
  NOT_FOUND: 'Not found.',
  SERVER_ERROR: 'Something went wrong. Please try again.',
}

export function getErrorMessage(code: string): string {
  return errorMessages[code] ?? `Error: ${code}`
}
