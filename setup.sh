#!/usr/bin/env bash
# Agon — automated dev environment setup (macOS / Linux)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Agon setup starting..."

# ── Backend ──────────────────────────────────────────────────────────────────
echo ""
echo "── Backend ──"
cd "$ROOT/backend"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  echo "    Created Python virtual environment."
fi

# shellcheck disable=SC1091
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo "    Python dependencies installed."

alembic upgrade head
echo "    Database migrated to head."

deactivate
cd "$ROOT"

# ── Frontend (desktop) ───────────────────────────────────────────────────────
echo ""
echo "── Frontend ──"
cd "$ROOT/frontend"
npm ci --silent
echo "    Node dependencies installed."
cd "$ROOT"

# ── Mobile ───────────────────────────────────────────────────────────────────
echo ""
echo "── Mobile ──"
cd "$ROOT/mobile"
npm ci --silent
echo "    Node dependencies installed."
cd "$ROOT"

# ── Docs site ────────────────────────────────────────────────────────────────
echo ""
echo "── Docs site ──"
cd "$ROOT/docs-site"
npm ci --silent
echo "    Node dependencies installed."
cd "$ROOT"

# ── .env ─────────────────────────────────────────────────────────────────────
if [ ! -f "$ROOT/backend/.env" ]; then
  echo ""
  echo "── Creating backend/.env ──"
  cat > "$ROOT/backend/.env" <<'ENV'
DATABASE_URL=sqlite:///./agon.db
AGON_JWT_SECRET=
AGON_SECRET_KEY=
LLM_PROVIDER=groq
LLM_MODEL=groq/llama-3.3-70b-versatile
LLM_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
ENV
  echo "    Created backend/.env — fill in optional keys as needed."
fi

echo ""
echo "✓ Setup complete!"
echo ""
echo "  Start the backend:  cd backend && source .venv/bin/activate && uvicorn main:app --reload"
echo "  Start the desktop:  cd frontend && npm run dev"
echo "  Start mobile:       cd mobile && npx expo start"
echo "  Docs site:          cd docs-site && npm run start"
echo ""
echo "  Or run everything with: make dev"
