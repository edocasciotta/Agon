# Agon — automated dev environment setup (Windows / PowerShell)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==> Agon setup starting..."

# ── Backend ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── Backend ──"
Set-Location "$Root\backend"

if (-not (Test-Path ".venv")) {
    python -m venv .venv
    Write-Host "    Created Python virtual environment."
}

& ".venv\Scripts\Activate.ps1"
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
Write-Host "    Python dependencies installed."

alembic upgrade head
Write-Host "    Database migrated to head."

deactivate
Set-Location $Root

# ── Frontend (desktop) ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "── Frontend ──"
Set-Location "$Root\frontend"
npm ci --silent
Write-Host "    Node dependencies installed."
Set-Location $Root

# ── Mobile ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── Mobile ──"
Set-Location "$Root\mobile"
npm ci --silent
Write-Host "    Node dependencies installed."
Set-Location $Root

# ── Docs site ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── Docs site ──"
Set-Location "$Root\docs-site"
npm ci --silent
Write-Host "    Node dependencies installed."
Set-Location $Root

# ── .env ─────────────────────────────────────────────────────────────────────
$envFile = "$Root\backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Host ""
    Write-Host "── Creating backend\.env ──"
    @"
DATABASE_URL=sqlite:///./agon.db
AGON_JWT_SECRET=
AGON_SECRET_KEY=
LLM_PROVIDER=groq
LLM_MODEL=groq/llama-3.3-70b-versatile
LLM_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
"@ | Set-Content $envFile
    Write-Host "    Created backend\.env — fill in optional keys as needed."
}

Write-Host ""
Write-Host "Setup complete!"
Write-Host ""
Write-Host "  Start the backend:  cd backend; .venv\Scripts\Activate.ps1; uvicorn main:app --reload"
Write-Host "  Start the desktop:  cd frontend; npm run dev"
Write-Host "  Start mobile:       cd mobile; npx expo start"
Write-Host "  Docs site:          cd docs-site; npm run start"
