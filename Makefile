.PHONY: setup test lint format build dev clean

# ─── Setup ────────────────────────────────────────────────────────────────────

setup:
	bash setup.sh

# ─── Test ─────────────────────────────────────────────────────────────────────

test: test-backend test-frontend test-mobile

test-backend:
	cd backend && source .venv/bin/activate && pytest -q

test-frontend:
	cd frontend && npm test -- --run

test-mobile:
	cd mobile && npm test -- --watchAll=false

# ─── Lint ─────────────────────────────────────────────────────────────────────

lint: lint-backend lint-frontend lint-mobile

lint-backend:
	cd backend && source .venv/bin/activate && ruff check . && black --check . && isort --check .

lint-frontend:
	cd frontend && npm run lint

lint-mobile:
	cd mobile && npm run lint

# ─── Format ───────────────────────────────────────────────────────────────────

format: format-backend format-frontend format-mobile

format-backend:
	cd backend && source .venv/bin/activate && black . && isort .

format-frontend:
	cd frontend && npm run format

format-mobile:
	cd mobile && npm run format

# ─── Build ────────────────────────────────────────────────────────────────────

build:
	cd frontend && npm run build

docs:
	cd docs-site && npm run build

# ─── Dev ──────────────────────────────────────────────────────────────────────

dev:
	@echo "Starting backend and frontend in parallel..."
	@(cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000) & \
	 (cd frontend && npm run dev) & \
	 wait

dev-backend:
	cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

dev-mobile:
	cd mobile && npx expo start

dev-docs:
	cd docs-site && npm run start

# ─── Clean ────────────────────────────────────────────────────────────────────

clean:
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; true
	find backend -name "*.pyc" -delete 2>/dev/null; true
	rm -f backend/agon.db backend/test.db
	rm -rf frontend/dist frontend/.vite
	rm -rf docs-site/build docs-site/.docusaurus
