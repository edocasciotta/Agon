import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

/**
 * Covers exactly the five cases from /directory-worker/CLAUDE.md's "Testing" quality gate:
 *   1. first-registration claim
 *   2. re-registration with correct secret (200)
 *   3. re-registration with wrong secret (403)
 *   4. resolve of a known id (200 + URL)
 *   5. resolve of an unknown id (404, generic)
 *
 * `@cloudflare/vitest-pool-workers` gives each test isolated KV storage by default, so tests
 * don't need to share or reset state between each other.
 */

function registerRequest(studioId: string, secret: string, tunnelUrl: string): Request {
  return new Request("https://directory.example.com/register", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ studio_id: studioId, tunnel_url: tunnelUrl }),
  });
}

describe("POST /register", () => {
  it("first call for a studio_id claims it and returns 200", async () => {
    const response = await SELF.fetch(
      registerRequest("studio-a", "secret-1", "https://a.trycloudflare.com")
    );
    expect(response.status).toBe(200);
  });

  it("re-registration with the same secret succeeds (200)", async () => {
    const first = await SELF.fetch(
      registerRequest("studio-b", "secret-2", "https://b.trycloudflare.com")
    );
    expect(first.status).toBe(200);

    const second = await SELF.fetch(
      registerRequest("studio-b", "secret-2", "https://b-restarted.trycloudflare.com")
    );
    expect(second.status).toBe(200);
  });

  it("re-registration with a different secret is rejected (403)", async () => {
    const first = await SELF.fetch(
      registerRequest("studio-c", "secret-owner", "https://c.trycloudflare.com")
    );
    expect(first.status).toBe(200);

    const second = await SELF.fetch(
      registerRequest("studio-c", "secret-attacker", "https://evil.trycloudflare.com")
    );
    expect(second.status).toBe(403);
  });
});

describe("GET /resolve/:studio_id", () => {
  it("resolves a known id to its current tunnel_url (200)", async () => {
    await SELF.fetch(
      registerRequest("studio-d", "secret-3", "https://d.trycloudflare.com")
    );

    const response = await SELF.fetch("https://directory.example.com/resolve/studio-d");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tunnel_url: "https://d.trycloudflare.com" });
  });

  it("returns a generic 404 for an unknown id", async () => {
    const response = await SELF.fetch(
      "https://directory.example.com/resolve/no-such-studio"
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    // Generic body — must not reveal anything that would let a caller distinguish
    // "malformed" from "well-formed but unknown".
    expect(body).toEqual({ error: "not_found" });
  });
});
