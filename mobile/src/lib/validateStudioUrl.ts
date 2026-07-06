/**
 * Validate a studio base URL before it is persisted and used as the API base.
 *
 * The studio URL is where the app sends the member's credentials and JWT, so an
 * unvalidated value from a QR code or manual entry is a credential-phishing
 * vector. We therefore:
 *   - reject anything that is not a parseable http(s) URL (blocks javascript:,
 *     file:, data:, etc.);
 *   - require https for public hosts, while still allowing plain http for
 *     localhost and private LAN ranges (the intended studio deployment).
 */

const PRIVATE_HOST_RE =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[?::1\]?)$/i

export function isPrivateHost(hostname: string): boolean {
  return PRIVATE_HOST_RE.test(hostname)
}

export function validateStudioUrl(raw: string): { ok: true; url: string } | { ok: false } {
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    return { ok: false }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false }
  }

  // Plain http is only acceptable on the local machine or a private LAN. A
  // public http URL would send credentials in cleartext.
  if (parsed.protocol === 'http:' && !isPrivateHost(parsed.hostname)) {
    return { ok: false }
  }

  // Normalise: drop any trailing slash so the base URL is consistent.
  return { ok: true, url: parsed.origin }
}
