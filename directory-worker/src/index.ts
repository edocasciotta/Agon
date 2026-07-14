/**
 * Agon directory Worker.
 *
 * The one piece of centralized infrastructure in an otherwise local-first project: a
 * `studio_id -> current tunnel URL` phone book, nothing more. It never sees studio data
 * (bookings, clients, names) — see /directory-worker/CLAUDE.md for the full brief.
 *
 * Routes:
 *   POST /register           Authorization: Bearer {directory_secret}
 *                             body: { studio_id, tunnel_url }
 *   GET  /resolve/{studio_id} public, no auth
 *
 * Rate limiting is intentionally NOT hand-rolled here — it relies on Cloudflare's built-in
 * edge rate-limiting rules (free tier), per the brief.
 */

import { getEntry, putEntry, sha256Hex, timingSafeEqual, type DirectoryEntry } from "./kv";

export interface Env {
  DIRECTORY_KV: KVNamespace;
}

// Generous but bounded, to keep KV keys/values well away from any pathological input.
// This is basic request hygiene, not a feature — the brief's two-endpoint contract is
// unchanged by these limits.
const MAX_STUDIO_ID_LENGTH = 200;
const MAX_TUNNEL_URL_LENGTH = 2048;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function genericNotFound(): Response {
  // Deliberately identical for "malformed id" and "unknown id" — do not add any detail
  // that would let a caller distinguish the two (enumeration resistance).
  return jsonResponse({ error: "not_found" }, 404);
}

function isNonEmptyBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isWellFormedHttpsUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  // Strictly https, with a non-empty hostname. This is the guard against the tunnel_url
  // field becoming an open-redirect / SSRF-adjacent primitive (no javascript:, data:,
  // file:, bare strings, etc.)
  return parsed.protocol === "https:" && parsed.hostname.length > 0;
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/.exec(header);
  const captured = match?.[1];
  if (!captured) {
    return null;
  }
  const token = captured.trim();
  return token.length > 0 ? token : null;
}

async function handleRegister(request: Request, env: Env): Promise<Response> {
  const secret = extractBearerToken(request);
  if (!secret) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  if (typeof payload !== "object" || payload === null) {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  const { studio_id: studioId, tunnel_url: tunnelUrl } = payload as Record<string, unknown>;

  if (!isNonEmptyBoundedString(studioId, MAX_STUDIO_ID_LENGTH)) {
    return jsonResponse({ error: "invalid_studio_id" }, 400);
  }

  if (
    !isNonEmptyBoundedString(tunnelUrl, MAX_TUNNEL_URL_LENGTH) ||
    !isWellFormedHttpsUrl(tunnelUrl)
  ) {
    return jsonResponse({ error: "invalid_tunnel_url" }, 400);
  }

  const secretHash = await sha256Hex(secret);
  const existing = await getEntry(env.DIRECTORY_KV, studioId);

  if (existing && !timingSafeEqual(existing.secret_hash, secretHash)) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const entry: DirectoryEntry = {
    tunnel_url: tunnelUrl,
    updated_at: new Date().toISOString(),
    secret_hash: secretHash,
  };
  await putEntry(env.DIRECTORY_KV, studioId, entry);

  return jsonResponse({ ok: true }, 200);
}

async function handleResolve(studioId: string, env: Env): Promise<Response> {
  if (!isNonEmptyBoundedString(studioId, MAX_STUDIO_ID_LENGTH)) {
    // Malformed id — same generic 404 as "unknown id", never distinguished.
    return genericNotFound();
  }

  const entry = await getEntry(env.DIRECTORY_KV, studioId);
  if (!entry) {
    return genericNotFound();
  }

  return jsonResponse({ tunnel_url: entry.tunnel_url }, 200);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/register") {
      return handleRegister(request, env);
    }

    const resolveMatch = /^\/resolve\/([^/]*)$/.exec(url.pathname);
    const rawStudioId = resolveMatch?.[1];
    if (request.method === "GET" && rawStudioId !== undefined) {
      let studioId: string;
      try {
        studioId = decodeURIComponent(rawStudioId);
      } catch {
        // Malformed percent-encoding — same generic 404 as any other malformed id.
        return genericNotFound();
      }
      return handleResolve(studioId, env);
    }

    return genericNotFound();
  },
};
