export const errorMessages: Record<string, string> = {
  BOOKING_CLASS_FULL: 'This class is full. Join the waitlist?',
  BOOKING_DUPLICATE: 'You already have a booking for this class.',
  BOOKING_NO_MEMBERSHIP: 'You need an active membership to book.',
  BOOKING_CLASS_NOT_SCHEDULED: 'This class is no longer available.',
  BOOKING_CLASS_ALREADY_STARTED: 'This class has already started.',
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password.',
  AUTH_TOKEN_INVALID: 'Your session has expired. Please log in again.',
  AUTH_INSUFFICIENT_PERMISSIONS: "You don't have permission to do that.",
  PROMO_CODE_NOT_FOUND: 'This promo code does not exist.',
  PROMO_CODE_EXPIRED: 'This promo code has expired.',
  PROMO_CODE_INACTIVE: 'This promo code is no longer active.',
  PROMO_CODE_MAX_USES_REACHED: 'This promo code has reached its usage limit.',
  PROMO_CODE_ALREADY_USED: 'You have already used this promo code.',
  PROMO_CODE_NOT_APPLICABLE: 'This promo code cannot be applied to this membership.',
  GIFT_CARD_NOT_FOUND: 'This gift card code does not exist.',
  GIFT_CARD_INACTIVE: 'This gift card is no longer active.',
  GIFT_CARD_EXPIRED: 'This gift card has expired.',
  GIFT_CARD_ZERO_BALANCE: 'This gift card has no remaining balance.',
  NOT_FOUND: 'Not found.',
  SERVER_ERROR: 'Something went wrong. Please try again.',
}

export function getErrorMessage(code: string): string {
  return errorMessages[code] ?? `Error: ${code}`
}
