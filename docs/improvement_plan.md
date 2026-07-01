# Agon — Improvement Plan
## Obiettivo: portare tutti e 8 i risk score vicini a 1/10

**Scores attuali → target**

| Categoria              | Attuale | Target |
|------------------------|---------|--------|
| Architecture           | 2       | 1      |
| Code Quality           | 3       | 1      |
| Maintainability        | 4       | 2      |
| Security               | 4       | 2      |
| Documentation          | 3       | 1      |
| Test Coverage          | 5       | 2      |
| Contributor Friendliness | 5     | 1      |
| Long-term Sustainability | 6     | 3      |

Il piano è diviso in **8 fasi**. Ogni fase deve essere completata in ordine
perché le fasi successive dipendono dai risultati delle precedenti.
Effort stimato per sviluppatore singolo: ~30–40 giorni.

---

## Legenda

- **Effort**: XS < 30 min · S 30–120 min · M 2–6 h · L 1–2 gg · XL 3+ gg
- **Agent**: quale sub-agent esegue il task (backend / frontend / mobile / docs / infra)
- **Scores impattati**: categorie del risk assessment che migliorano

---

## FASE A — BLOCKERS
*Prerequisito per qualsiasi rilascio. Questi task sbloccano il verdetto "Approve".*

Scores dopo la fase: Documentation 3→2 · Test Coverage 5→4 · Architecture 2→2

### A1 — Chiarire SQLCipher
**Effort:** S · **Agent:** backend
Il Project Bible afferma "the SQLite database is encrypted at rest" ma
`backend/database.py` non mostra alcuna configurazione SQLCipher.
Azioni:
1. Verificare se SQLCipher è installato e configurato (cerca `sqlcipher` in requirements.txt e database.py)
2. Se non lo è: rimuovere il claim dal Project Bible e aggiungere nota "encryption at rest is planned for V2"
3. Se lo è: documentarlo esplicitamente in ARCHITECTURE.md (fase G)

### A2 — Documentare lifecycle Electron-FastAPI
**Effort:** M · **Agent:** frontend (electron/main.ts)
Azioni:
1. Verificare che `electron/main.ts` gestisca: (a) porta 8000 già occupata → messaggio di errore utente; (b) crash uvicorn → auto-restart con max 3 tentativi; (c) shutdown ordinato (kill child process su app quit)
2. Implementare le parti mancanti
3. Aggiungere log su console che riportino ogni stato (spawning, ready, crashed, restarting)

### A3 — Creare DEPLOYMENT.md
**Effort:** M · **Agent:** docs
Contenuto minimo:
- Prerequisiti (Python 3.11+, Node 20+, pip, npm)
- Installazione da sorgente (passo per passo)
- Eseguibile pre-compilato (electron-builder output)
- Come aggiornare a una nuova versione (aggiorna eseguibile → Alembic migra automaticamente)
- Dove vengono scritti i log
- Backup e restore del database

### A4 — Creare TROUBLESHOOTING.md
**Effort:** M · **Agent:** docs
Problemi da coprire:
- "Cloudflare Tunnel non si avvia" → soluzione passo per passo
- "Porta 8000 già in uso" → come trovare e terminare il processo
- "Il backup è fallito" → come verificare i log e ripristinare manualmente
- "L'app non si connette al server dello studio" → checklist di verifica
- "Errore durante il login" → token scaduto vs credenziali errate vs server giù
- "La migrazione Alembic è fallita" → come fare rollback

### A5 — Primo test integration end-to-end (backend)
**Effort:** L · **Agent:** backend
Creare `backend/tests/test_e2e_booking_flow.py`:
```
login manager → crea class_template → schedula classe → 
login client → prenota → verifica booking → check-in → 
verifica checkin status → cancella → verifica credito rimborsato
```
Questo è l'unico test e2e che sblocca il verdetto "Approve".

---

## FASE B — CODE QUALITY STANDARDS
*Fondamenta che impediscono la degradazione della qualità nel tempo.*

Scores dopo la fase: Code Quality 3→2 · Contributor Friendliness 5→4

### B1 — Configurare linting backend (black + isort + ruff)
**Effort:** S · **Agent:** backend
1. Aggiungere `black`, `isort`, `ruff` a `requirements-dev.txt`
2. Creare `pyproject.toml` con configurazione black (line-length=100) e isort
3. Eseguire `black .` e `isort .` su tutto il codice esistente
4. Verificare che `pytest` continui a passare

### B2 — Configurare linting frontend + mobile (ESLint + Prettier)
**Effort:** S · **Agent:** frontend
1. Aggiungere `@typescript-eslint/recommended` e `prettier` alle devDeps
2. Creare `.eslintrc.cjs` e `.prettierrc` nella root di frontend e mobile
3. Eseguire `npm run lint --fix` su tutto il codice esistente
4. Aggiungere `"lint": "eslint src --ext ts,tsx"` e `"format": "prettier --write src"` agli script

### B3 — Aggiungere pre-commit hooks
**Effort:** S · **Agent:** infra (root del repo)
1. Creare `.pre-commit-config.yaml` nella root:
   - backend: black, isort, ruff, pytest (solo i test veloci)
   - frontend: eslint, prettier, tsc --noEmit
   - mobile: eslint, prettier
2. Aggiungere `.pre-commit-config.yaml` al CONTRIBUTING.md con istruzione `pre-commit install`

### B4 — Migrare Pydantic v2 (ConfigDict)
**Effort:** S · **Agent:** backend
Tutti i modelli `backend/app/schemas/` che usano `class Config:` vanno aggiornati:
```python
# da
class Config:
    from_attributes = True
# a
model_config = ConfigDict(from_attributes=True)
```
Elimina tutti i deprecation warning in test output.

### B5 — Standardizzare formato error response
**Effort:** M · **Agent:** backend
TECHNICAL_SPEC.md section 11 definisce: `{"error": {"code": "...", "message": "...", "details": {...}}}`
1. Audit di ogni router: verificare che tutti i 4xx/5xx restituiscano questo formato
2. Creare helper `raise_api_error(code, message, status_code, details=None)` in `app/utils.py`
3. Sostituire tutti i `raise HTTPException(detail=...)` non conformi

### B6 — Global 401 interceptor nel frontend
**Effort:** S · **Agent:** frontend
In `frontend/src/renderer/src/api/client.ts`:
1. Aggiungere `apiClient.interceptors.response.use()` che su 401 tenta refresh token
2. Se il refresh fallisce, chiama `useAuthStore.getState().logout()` e reindirizza a `/login`
3. Rimuovere gestione 401 duplicata dagli endpoint singoli

### B7 — Validazione form client-side
**Effort:** M · **Agent:** frontend
Per le pagine con form (Clients, Instructors, Memberships, ClassTypes, Establishments):
1. Aggiungere `zod` come dipendenza
2. Definire uno schema Zod per ogni form
3. Validare prima del submit, mostrare errori inline senza chiamata API

---

## FASE C — SECURITY HARDENING
*Riduce i rischi operativi e di sicurezza senza richiedere architetture nuove.*

Scores dopo la fase: Security 4→3

### C1 — Ridurre QR token expiry da 24h a 2h
**Effort:** XS · **Agent:** backend
In `backend/app/auth.py`:
```python
# da
timedelta(hours=24)
# a
timedelta(hours=2)
```
Aggiornare il test corrispondente se presente.

### C2 — Rate limiting per client_id su /bookings
**Effort:** S · **Agent:** backend
In `backend/app/routers/bookings.py`:
1. Aggiungere `@limiter.limit("10/minute")` su `POST /bookings`
2. Il limiter usa `client_id` dal token JWT come chiave (non IP)
3. Aggiungere test: 11 booking in rapida successione → il 11° riceve 429

### C3 — Log redaction per PII
**Effort:** S · **Agent:** backend
1. Creare `app/logging_config.py` con un `logging.Filter` che oscura:
   - pattern email: `[redacted@email]`
   - pattern telefono: `[redacted-phone]`
2. Applicare il filter al root logger in `main.py`
3. Nessun PII nei log di errore o di accesso

### C4 — Security checklist in CONTRIBUTING.md
**Effort:** XS · **Agent:** docs
Aggiungere sezione "Security Review Checklist" a CONTRIBUTING.md:
- [ ] Nessun segreto in codice o history git
- [ ] Input validation su tutti gli endpoint (Pydantic)
- [ ] Rate limiting su endpoint sensibili
- [ ] Nessun PII nei log
- [ ] Test IDOR: client non può accedere a dati di altri client
- [ ] Query costruite via ORM, mai string concatenation

---

## FASE D — DATABASE & PERFORMANCE
*Previene degradazione non-lineare delle performance con dati reali.*

Scores dopo la fase: Architecture 2→1 · Code Quality 2→1

### D1 — Abilitare SQLite WAL mode
**Effort:** XS · **Agent:** backend
In `backend/app/database.py`, nella funzione `set_pragma`:
```python
cursor.execute("PRAGMA journal_mode=WAL")
cursor.execute("PRAGMA synchronous=NORMAL")  # WAL sicuro con NORMAL
```
Riduce il lock contention tra background tasks e UI.

### D2 — Aggiungere composite indexes
**Effort:** S · **Agent:** backend
In `backend/app/models/`:
```python
# booking
Index('idx_booking_class_status', 'scheduled_class_id', 'status')
Index('idx_booking_client_status', 'client_id', 'status')
# scheduled_class
Index('idx_class_date_location', 'date', 'location_id', 'is_cancelled')
# membership
Index('idx_membership_client_status', 'client_id', 'status')
```
Creare migrazione Alembic dedicata: `alembic revision --autogenerate -m "add composite indexes"`

### D3 — Query performance tests
**Effort:** M · **Agent:** backend
Creare `backend/tests/test_performance.py`:
- Inserire 1000 scheduled_class, 500 client, 2000 booking
- Verificare che le query principali (list classes, list bookings per class, roster) girino in <100ms
- Usare `time.perf_counter()` non mocking

### D4 — Documentare strategia cascade delete / soft delete
**Effort:** S · **Agent:** docs (ARCHITECTURE.md)
Per ogni entità principale, documentare:
- `class_template` eliminato → cascade su `scheduled_class`? (soft delete o hard delete)
- `client` eliminato → GDPR: anonimizzazione o hard delete?
- `instructor` eliminato → solo se nessuna scheduled_class futura (già implementato)
- `scheduled_class` cancellata → booking status → crediti rimborsati automaticamente?

### D5 — Migration verification test
**Effort:** S · **Agent:** backend
Creare `backend/tests/test_migrations.py`:
```python
def test_alembic_upgrade_head_on_fresh_db(tmp_path):
    # Crea DB vuoto, applica tutte le migrazioni, verifica tabelle esistono
    engine = create_engine(f"sqlite:///{tmp_path}/test.db")
    with engine.connect() as conn:
        context = MigrationContext.configure(conn)
        script = ScriptDirectory.from_config(alembic_cfg)
        script.run_env()
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    assert len(tables) >= 14  # tutte le tabelle del core
```

### D6 — Creare ERD del database
**Effort:** S · **Agent:** docs
Generare ERD da `backend/app/models/` con `eralchemy2` o disegnarlo manualmente in Mermaid.
Pubblicarlo come pagina Docusaurus "Database Schema" con:
- Diagramma delle relazioni
- Tabella con descrizione di ogni campo chiave
- Note su UTC-naive datetime, location_id convention, soft delete policy

---

## FASE E — TEST STRATEGY
*Porta la copertura da "happy paths" a "sistema verificato end-to-end".*

Scores dopo la fase: Test Coverage 5→2 · Security 3→2

### E1 — Test IDOR (authorization)
**Effort:** M · **Agent:** backend
Creare `backend/tests/test_authorization.py`:
- Client A non può leggere bookings di Client B
- Client non può accedere a endpoint manager
- Instructor non può modificare impostazioni studio
- Manager non può accedere a dati di altri studio (futuro V2 multi-location)

### E2 — Test backup restoration
**Effort:** S · **Agent:** backend
Creare `backend/tests/test_backup.py`:
1. Creare DB con dati noti
2. Eseguire backup task
3. Verificare che il file backup esista e sia leggibile
4. Ripristinare su nuovo DB vuoto
5. Verificare row count identico

### E3 — Playwright e2e tests (frontend)
**Effort:** XL · **Agent:** frontend
Creare `frontend/tests/e2e/`:
- `auth.spec.ts`: login, logout, sessione scaduta
- `calendar.spec.ts`: crea classe, modifica, cancella, visualizzazione
- `instructors.spec.ts`: crea instructor, modifica, deattiva, rimuove
- `clients.spec.ts`: crea client, cerca, assegna membership
Usare `@playwright/test` già in dipendenze. Configurare per puntare a `http://localhost:5173`.

### E4 — Load test booking engine
**Effort:** M · **Agent:** backend
Creare `backend/tests/test_load.py` con `pytest-benchmark` o script standalone:
- 100 client tentano di prenotare la stessa classe (capacity 50)
- Verificare: esattamente 50 booking confermati, 50 "class full"
- Verificare: nessuna race condition (no duplicati, no overbooking)
- Verificare: tempo totale < 5 secondi

### E5 — Test edge cases input invalidi
**Effort:** S · **Agent:** backend
Aggiungere a ogni test file i test di validazione mancanti:
- Durata negativa per scheduled_class
- Capacità 0 per class_template
- Data nel passato per scheduled_class
- Email malformata per client/instructor
- Password < 8 caratteri

### E6 — Mobile: risolvere peer dep conflict + test offline
**Effort:** M · **Agent:** mobile
1. Aggiornare `package.json` per risolvere il conflict React 18 / `@testing-library/react-native` senza `--legacy-peer-deps`
2. Aggiungere test per stato offline: quando `NetInfo.fetch()` ritorna `isConnected: false`, lo store mostra banner "offline"
3. Aggiungere `expo-network` o `@react-native-community/netinfo` alle dipendenze

---

## FASE F — DEVELOPER EXPERIENCE
*Riduce il tempo di setup da ore a minuti per nuovi contributor.*

Scores dopo la fase: Contributor Friendliness 4→2

### F1 — Creare setup.sh + setup.ps1
**Effort:** S · **Agent:** infra (root)
`setup.sh` (macOS/Linux):
```bash
#!/bin/bash
set -e
# Backend
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && alembic upgrade head
# Frontend
cd ../frontend && npm ci
# Mobile
cd ../mobile && npm ci
# Docs
cd ../docs-site && npm ci
echo "Setup completo. Esegui 'make dev' per avviare tutto."
```
`setup.ps1` (Windows): equivalente con PowerShell.

### F2 — Creare Makefile
**Effort:** S · **Agent:** infra (root)
```makefile
.PHONY: test dev lint build setup

test:
    cd backend && pytest -q
    cd frontend && npm test -- --run
    cd mobile && npm test -- --watchAll=false

lint:
    cd backend && black --check . && isort --check . && ruff .
    cd frontend && npm run lint
    cd mobile && npm run lint

build:
    cd frontend && npm run build

dev:
    # avvia backend e frontend in parallelo
    (cd backend && uvicorn app.main:app --reload) &
    (cd frontend && npm run dev) &
    wait

setup:
    bash setup.sh
```

### F3 — Aggiungere .editorconfig
**Effort:** XS · **Agent:** infra (root)
```ini
root = true
[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
[*.py]
indent_size = 4
```

### F4 — Creare PR template
**Effort:** XS · **Agent:** infra (.github/)
`.github/pull_request_template.md`:
```markdown
## Cosa cambia?
[Descrizione]

## Perché?
[Motivazione]

## Checklist
- [ ] Tutti i test passano (pytest, npm test)
- [ ] Nuovi test per il nuovo codice
- [ ] Chiavi i18n aggiunte a tutti i file locale
- [ ] Nessun secret hardcoded
- [ ] Nessun PII nei log
- [ ] Build passa senza errori TypeScript

## Issue correlate
Closes #
```

### F5 — VS Code Dev Container
**Effort:** S · **Agent:** infra (.devcontainer/)
`.devcontainer/devcontainer.json`:
- Image: `mcr.microsoft.com/devcontainers/python:3.11` + Node 20
- `postCreateCommand`: eseguire `setup.sh`
- Extensions: Python, Pylance, ESLint, Prettier, Tailwind CSS IntelliSense
- Port forwarding: 8000 (backend), 5173 (frontend)

---

## FASE G — DOCUMENTATION
*Porta la documentazione da "feature-complete" a "operationally complete".*

Scores dopo la fase: Documentation 3→1 · Maintainability 4→2

### G1 — Creare ARCHITECTURE.md
**Effort:** L · **Agent:** docs
Sezioni:
1. **System components**: Electron, FastAPI, SQLite, Cloudflare Tunnel — come comunicano
2. **Startup sequence**: diagramma Mermaid (Electron → spawn uvicorn → poll /health → show window)
3. **Transaction semantics**: "db.commit() solo nei router, mai nei service. Se service B fallisce dopo service A, il router non committa."
4. **Background task lifecycle**: quando partono, come gestiscono eccezioni, cosa succede se falliscono
5. **Error handling**: struttura standard JSON degli errori, codici errore, come aggiungerne di nuovi
6. **Database patterns**: UTC-naive datetime, location_id convention, soft delete vs hard delete

### G2 — Creare OPERATIONS.md (runbook)
**Effort:** M · **Agent:** docs
Sezioni:
1. **Aggiornare Agon**: step-by-step (download nuova versione → backup DB → avvia app → Alembic auto-migra)
2. **Backup manuale**: dove trovare i backup, come copiare il file SQLite
3. **Restore dal backup**: copia file → verifica → riavvia app
4. **Monitoring**: dove trovare i log, cosa cercare
5. **Cloudflare Tunnel**: come ottenere il token, dove configurarlo, cosa fare se il tunnel va down
6. **Stripe**: come configurare le chiavi, test vs produzione

### G3 — Creare ROADMAP.md
**Effort:** S · **Agent:** docs
```markdown
# Roadmap

## V1.0 (current) — Single-location studio management
- Booking engine, check-in, memberships, payments, GDPR

## V1.1 (next) — Operational hardening
- Integration tests, e2e tests, DEPLOYMENT.md, pre-commit hooks

## V2.0 (planned) — Multi-location
- location_id already in schema — migration minimal
- Per-location settings, per-location instructors
- Central reporting across locations

## V3.0 (vision) — Marketplace
- Open marketplace for class types and instructors
- Community templates
```

### G4 — Aggiungere CODE_OF_CONDUCT.md
**Effort:** XS · **Agent:** docs
Usare Contributor Covenant v2.1 (standard OSS).
Aggiungere link da CONTRIBUTING.md e README.

### G5 — Auto-generare API reference
**Effort:** M · **Agent:** docs + backend
1. Aggiungere docstring `summary` e `description` agli endpoint FastAPI mancanti
2. Creare script `docs-site/scripts/fetch-openapi.js` che scarica `/openapi.json` e genera pagine MDX
3. Aggiungere la pagina "API Reference" al sidebar Docusaurus
4. Questo garantisce che la doc API non diverga dal codice

### G6 — Creare glossario
**Effort:** XS · **Agent:** docs
Pagina Docusaurus "Glossary":
- Studio Manager = proprietario dell'istanza Agon
- Client = utente finale che prenota le classi
- Instructor = membro dello staff
- Membership = abbonamento (recurring o credit pack)
- Credit = diritto di accesso a una singola classe
- Location = sede fisica (V2: supporto multi-sede)
- Tunnel = URL pubblico per l'accesso remoto dei client
- Check-in = conferma della presenza a una classe

### G7 — CHANGELOG.md + policy di release
**Effort:** XS · **Agent:** docs
Creare CHANGELOG.md con formato [Keep a Changelog](https://keepachangelog.com):
```markdown
# Changelog

## [Unreleased]

## [1.0.0] — 2026-07-01
### Added
- Booking engine con waitlist
- Check-in QR e NFC
- Memberships e pagamenti Stripe
- GDPR export e deletion
- Migration assistant
- AI support agent
```

---

## FASE H — LONG-TERM SUSTAINABILITY
*Riduce il rischio che il progetto si blocchi per singolo punto di fallimento.*

Scores dopo la fase: Long-term Sustainability 6→3 · Contributor Friendliness 2→1

### H1 — Documentare percorso secondo maintainer
**Effort:** S · **Agent:** docs (CONTRIBUTING.md)
Aggiungere sezione "Becoming a Co-Maintainer":
- Criteri (N PR merged, attività sostenuta per X mesi)
- Responsabilità (review PR, risposta issue, gestione release)
- Privilegi (merge access, npm publish, GitHub releases)
- Processo (nomination, periodo di prova, accettazione)

### H2 — Mobile: offline-first con React Query
**Effort:** L · **Agent:** mobile
1. Configurare `QueryClient` con `staleTime: 5 * 60 * 1000` e `gcTime: 24 * 60 * 60 * 1000`
2. Aggiungere `NetInfo` per rilevare disconnessione
3. Mostrare banner "Offline — dati aggiornati alle [ora]" quando `isConnected: false`
4. Fare queue delle mutation offline (prenotazione, cancellazione) e rieseguirle al reconnect
5. Test: disconnetti → prenota → reconnetti → verifica booking inviato

### H3 — Mobile: deep linking per notification tap
**Effort:** M · **Agent:** mobile
1. Configurare `app.json` con scheme `agon://`
2. Mapping notification → route: booking_confirmed → `agon://bookings/[id]`
3. Handler in `app/_layout.tsx` per `Linking.getInitialURL()` e `Linking.addEventListener`

### H4 — Electron: documentare e testare auto-update
**Effort:** M · **Agent:** frontend + docs
1. Verificare configurazione `electron-updater` in `electron/updater.ts`
2. Documentare in OPERATIONS.md il processo: dove viene pubblicato il release, come viene firmato, come il client riceve l'update
3. Aggiungere test manuale: "come simulare un update in dev"
4. Documentare cosa succede alle migrazioni Alembic durante un auto-update

### H5 — Storybook per il design system
**Effort:** XL · **Agent:** frontend
*(Bassa priorità, alto impatto per contributor)*
1. Installare `@storybook/react-vite`
2. Creare stories per: Button (primary, secondary, destructive), Input, Modal, PageHeader, EmptyState, Pagination, LoadingSpinner
3. Pubblicare su GitHub Pages accanto ai docs

---

## SCORE PROGRESSION PER FASE

| Fase | Architecture | Code Quality | Maintainability | Security | Documentation | Test Coverage | Contributor | Sustainability |
|------|-------------|-------------|-----------------|----------|---------------|---------------|-------------|----------------|
| Inizio | 2 | 3 | 4 | 4 | 3 | 5 | 5 | 6 |
| Dopo A | 2 | 3 | 4 | 4 | **2** | **4** | 5 | 6 |
| Dopo B | 2 | **2** | 4 | 4 | 2 | 4 | **4** | 6 |
| Dopo C | 2 | 2 | 4 | **3** | 2 | 4 | 4 | 6 |
| Dopo D | **1** | **1** | 4 | 3 | 2 | 4 | 4 | 6 |
| Dopo E | 1 | 1 | 4 | **2** | 2 | **2** | 4 | 6 |
| Dopo F | 1 | 1 | 4 | 2 | 2 | 2 | **2** | 6 |
| Dopo G | 1 | 1 | **2** | 2 | **1** | 2 | 2 | 6 |
| Dopo H | 1 | 1 | 2 | 2 | 1 | 2 | **1** | **3** |

---

## SUMMARY TASK COUNT

| Fase | N. Task | Effort stimato |
|------|---------|----------------|
| A — Blockers | 5 | ~3 giorni |
| B — Code Quality | 7 | ~3 giorni |
| C — Security | 4 | ~1 giorno |
| D — Database | 6 | ~2 giorni |
| E — Tests | 6 | ~7 giorni |
| F — DX | 5 | ~2 giorni |
| G — Documentation | 7 | ~4 giorni |
| H — Sustainability | 5 | ~7 giorni |
| **Totale** | **45** | **~29 giorni** |

---

## NOTA FINALE

Le fasi A–D sono indipendenti e possono essere eseguite in parallelo da agent diversi
(backend agent per D, frontend agent per B6/B7, docs agent per A3/A4).

Le fasi E–H dipendono dal completamento delle fasi precedenti perché:
- I test E3 (Playwright) richiedono il global 401 interceptor (B6)
- Il load test E4 richiede gli index (D2) per avere risultati realistici
- La Fase H richiede che il sistema sia stabile (fasi A–G complete)
