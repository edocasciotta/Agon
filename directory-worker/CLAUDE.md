# Agon — Directory Worker (one-off, no persistent sub-agent)

This is a small, low-growth Cloudflare Worker: a directory mapping `studio_id → current tunnel URL`
so a studio's public widget/calendar links keep working even though the studio's own tunnel URL
(Cloudflare Quick Tunnel) changes on every restart. The orchestrator delegates work here directly
against this brief rather than maintaining a persistent sub-agent for it.

**Read `docs/agon_project_bible.md`'s "Local-First" and "Zero Cost by Default" principles before
touching this.** This directory is the **one** piece of centralized infrastructure in the whole
project — it must stay minimal and must never store studio data (bookings, clients, names). It only
ever stores `studio_id → url`, nothing else — literally "a phone book entry," per the project bible.
If a task here would add anything beyond that, stop and flag it to the orchestrator instead of
building it.

---

## Quality Gates — Non-Negotiable Standards

### Data minimalism (the whole point of this component)
- KV value for a given `studio:{public_studio_id}` key is exactly
  `{ tunnel_url, updated_at, secret_hash }`. Never add a field beyond what's needed to resolve and
  authorize a URL update.
- Never log or store the raw `directory_secret` — only its hash (`sha256`).

### Authorization — trust-on-first-use
- `POST /register` claims a `public_studio_id` the first time it's seen (stores `sha256(secret)`);
  every subsequent call for that id must present the same secret (compare hashes) or get `403`.
  This is the same "compare the credential against the resource" IDOR pattern used throughout the
  backend (`docs/SECURITY_GUIDELINES.md` §2), applied to infrastructure instead of app data.

### Public resolve endpoint
- `GET /resolve/{public_studio_id}` is public, no auth. Unknown/malformed ids get a **generic 404**
  — do not distinguish "malformed id" from "unknown id" in the response (mirrors
  `backend/app/routers/calendar_sync.py`'s enumeration-resistant 404 for its token-in-path pattern).
- Rely on Cloudflare's built-in edge rate-limiting rules (free tier) for this endpoint — don't hand-roll
  request counting in the Worker.

### Testing
- Cover: first-registration claim, re-registration with correct secret (200), re-registration with
  wrong secret (403), resolve of a known id (200 + URL), resolve of an unknown id (404).

---

## Tech Stack

Cloudflare Workers + KV, TypeScript, deployed via `wrangler deploy`.

## Environment

```
/directory-worker/
├── src/
│   ├── index.ts       # routes: POST /register, GET /resolve/:id
│   └── kv.ts           # KV read/write helpers
├── wrangler.toml
└── package.json
```

## API Contract

```
POST /register
  Headers: Authorization: Bearer {directory_secret}
  Body: { "studio_id": "<uuid>", "tunnel_url": "https://....trycloudflare.com" }
  → 200 on success (first claim or matching secret)
  → 403 if studio_id already claimed by a different secret

GET /resolve/{studio_id}
  → 200 { "tunnel_url": "..." } if known
  → 404 (generic) otherwise
```

## When You Finish a Task

1. Confirm all four test cases above pass
2. Report the deployed Worker URL and confirm `wrangler.toml` doesn't leak any account-specific
   secret into the repo (use `wrangler secret put` for anything sensitive, never plaintext in
   `wrangler.toml`)
3. Flag to orchestrator: any deviation from the two-endpoint contract above
