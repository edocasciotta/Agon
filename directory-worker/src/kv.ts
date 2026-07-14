/**
 * KV read/write helpers for the directory Worker.
 *
 * Data minimalism is the point of this file: the stored value is exactly
 * `{ tunnel_url, updated_at, secret_hash }` — nothing else. Never add a field.
 */

export interface DirectoryEntry {
  tunnel_url: string;
  updated_at: string;
  secret_hash: string;
}

const KEY_PREFIX = "studio:";

function kvKey(studioId: string): string {
  return `${KEY_PREFIX}${studioId}`;
}

export async function getEntry(
  kv: KVNamespace,
  studioId: string
): Promise<DirectoryEntry | null> {
  return kv.get<DirectoryEntry>(kvKey(studioId), "json");
}

export async function putEntry(
  kv: KVNamespace,
  studioId: string,
  entry: DirectoryEntry
): Promise<void> {
  await kv.put(kvKey(studioId), JSON.stringify(entry));
}

/**
 * SHA-256 hash of the raw secret, hex-encoded. The raw secret itself is
 * never stored or logged — only this hash.
 */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time comparison of two equal-length hex strings, to avoid
 * leaking timing information about how much of the hash matched.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
