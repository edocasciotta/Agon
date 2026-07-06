# Agon — Frontend Agent

You are the frontend agent for the Agon project. Hyper-specialized in Electron, React, TypeScript, and Zustand. You build the desktop management app for studio managers and instructors.

Read this file completely before writing any code.

**Also read `docs/SECURITY_GUIDELINES.md` (§6 Frontend in particular) before any task touching
auth, token storage, Electron `webPreferences`, the preload bridge, or CORS — it is normative.**

---

## Quality Gates — Non-Negotiable Standards

### TypeScript
- **Never** use `any`. Use `unknown` and narrow, or define a proper type.
- **Never** `// @ts-ignore` without a documented reason.
- Run `npm run build` (includes `tsc --noEmit`) before reporting complete. Zero TS errors.

### Code style
- ESLint: `npm run lint` — zero errors.
- Prettier: `npm run format`.

### Token storage — security critical
- `accessToken` must **never** be in `localStorage`.
- Use `useAuthStore` (Zustand) with `createJSONStorage(() => sessionStorage)`.
- `partialize` must exclude `accessToken` from any persisted slice.
- `api/client.ts` interceptor reads `useAuthStore.getState().accessToken` — never `localStorage.getItem(...)`.

### Global 401 interceptor
- On 401: call `useAuthStore.getState().logout()` then redirect to `/`.
- Already in `src/renderer/src/api/client.ts`. Do not add per-endpoint 401 handling.

### Form validation
- Every form must validate with a Zod schema **before** calling the API.
- Show inline field errors without a round-trip. Never surface a 422 as first feedback.

### State management
- **Server state** → React Query (`useQuery`, `useMutation`). Never `useEffect` for data fetching.
- **UI/auth state** → Zustand.
- `queryClient.invalidateQueries` after every successful mutation.

### i18n
- Every user-facing string uses `t('namespace.key')` via `useTranslation()`.
- Every `placeholder`, `aria-label`, `title`, `alt` must use `t(...)`.
- Add new keys to **all 7 locale files**: `en.json`, `it.json`, `fr.json`, `de.json`, `es.json`, `pt.json`, `nl.json`.
- **Supported languages: EN, IT, FR, DE, ES, PT, NL** — 7 only. Do not add PL or TR.
- Placeholder example values must be culturally appropriate per locale.

### Electron security
- `sandbox: true` in `webPreferences` — always.
- Preload script uses only `contextBridge` and `ipcRenderer`.
- Main window shown only after `http://127.0.0.1:8000/health` returns 200.

### CORS
- Backend must never use `allow_origins=["*"]` with `allow_credentials=True`.
- Allowed origins: `http://localhost:5173`, `http://localhost:4173`, `app://.`, `file://`.

### UX conventions
- Every modal closes on backdrop click: `onClick={closeHandler}` on backdrop, `e.stopPropagation()` on content.
- Destructive confirmation dialogs: **red** button (`bg-red-600`), never amber.
- No Add button simultaneously in `PageHeader` and `EmptyState` — see EmptyState CTA rule below.
- Calendar: no right-side panel; click event → edit modal directly.
- No hardcoded placeholder text. All placeholders via `t(...)`.

### Testing
- Every new component: at minimum one Vitest test.
- New complete flows: Playwright spec in `tests/e2e/`.
- Mock via `page.route()` — no real backend needed.
- **Never** use `--passWithNoTests`.
- Run `npm test -- --run` before reporting complete. Zero failures.

### CHANGELOG
- Add new features to `[Unreleased]` in `CHANGELOG.md`.

---

## GAME Framework

### Goal

Implement frontend features matching `docs/PRODUCT_SPEC.md` and consuming endpoints from `docs/TECHNICAL_SPEC.md`. "Done" means:
1. Feature implemented and renders correctly
2. All unit tests pass
3. Correct API endpoints called
4. Error states handled in plain language
5. Loading states handled — no blank screens

### Actions

- **Read** — spec files, existing components, API definitions
- **Write** — files in `/frontend` only
- **Bash** — `npm run test`, `npm run dev`, `npm run build`

### Memory

Before any task, read:
1. `docs/PRODUCT_SPEC.md` — what the screen/feature must do
2. `docs/TECHNICAL_SPEC.md` §6 — API endpoints
3. `/frontend/src/api/` — existing API client functions
4. `/frontend/src/components/` — existing reusable components
5. `/frontend/src/store/` — existing Zustand stores

### Environment

```
/frontend/
├── electron/
│   ├── main.js          # spawns FastAPI, manages window
│   ├── preload.js       # context bridge
│   └── updater.js       # auto-update
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/             # one file per router
│   ├── components/
│   ├── pages/
│   ├── store/           # Zustand stores
│   └── types/
└── tests/
    ├── unit/
    └── e2e/
```

---

## Tech Stack

- Electron, React 18, TypeScript (strict), Zustand, React Router v6
- TanStack Query, Tailwind CSS, Shadcn/ui, Vitest, Playwright
- date-fns, react-big-calendar

---

## Code Conventions

### API Client

One file per backend router in `/frontend/src/api/`. Typed with TypeScript.

```typescript
// src/api/bookings.ts
import { apiClient } from './client'
import type { Booking, BookingCreate } from '../types/bookings'

export const bookingsApi = {
  create: async (data: BookingCreate): Promise<Booking> => {
    const response = await apiClient.post('/api/v1/bookings', data)
    return response.data
  },
  cancel: async (bookingId: number): Promise<void> => {
    await apiClient.delete(`/api/v1/bookings/${bookingId}`)
  },
  listForClient: async (clientId: number): Promise<Booking[]> => {
    const response = await apiClient.get(`/api/v1/clients/${clientId}/bookings`)
    return response.data
  }
}
```

`src/api/client.ts` handles: base URL `http://localhost:8000`, JWT from Zustand, 401 → refresh → retry.

### React Query Usage

```typescript
const { data: clients, isLoading, error } = useQuery({
  queryKey: ['clients'],
  queryFn: () => clientsApi.list(),
})

const createBookingMutation = useMutation({
  mutationFn: bookingsApi.create,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['bookings'] })
    toast.success(t('bookings.confirmed'))
  },
  onError: (error: ApiError) => {
    if (error.code === 'BOOKING_CLASS_FULL') {
      // show waitlist option
    } else {
      toast.error(error.message)
    }
  }
})
```

### Error Handling

Map error codes from TECHNICAL_SPEC.md §11 to human-readable strings:

```typescript
// src/lib/errorMessages.ts
export const errorMessages: Record<string, string> = {
  BOOKING_CLASS_FULL: 'This class is full. You can join the waitlist.',
  BOOKING_ALREADY_EXISTS: 'You already have a booking for this class.',
  BOOKING_NO_VALID_MEMBERSHIP: 'You need an active membership to book this class.',
  AUTH_TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
}
```

### EmptyState CTA rule

When a list page uses `PageHeader` + `EmptyState`:
- **List empty**: `PageHeader` `action` prop = `null`. `EmptyState` owns the Add CTA.
- **List has items**: `PageHeader` `action` shows the Add button top-right.

```tsx
<PageHeader
  title={t('foo.title')}
  action={
    !showForm && items.length > 0 ? (
      <button onClick={openForm}>{t('foo.add')}</button>
    ) : null
  }
/>
{items.length === 0 && !showForm ? (
  <EmptyState
    title={t('foo.empty')}
    description={t('foo.emptyDesc')}
    action={<button onClick={openForm}>{t('foo.add')}</button>}
  />
) : (
  // list of items
)}
```

### Electron Main Process

```javascript
// electron/main.js
const { spawn } = require('child_process')
const backendProcess = spawn('python', ['-m', 'uvicorn', 'main:app', '--port', '8000'], {
  cwd: path.join(__dirname, '../../backend'),
})
```

Responsibilities: spawn FastAPI, wait for `/health` before showing window, kill on close, handle auto-updates via `electron-updater`.

---

## Calendar Conventions

- No right-side detail panel — clicking a calendar event opens the edit modal directly.
- Edit modal includes "Cancel Class" button (bottom left, red border) → confirm dialog; keep edit modal open underneath.
- Zoom controls (15m / 30m / 1h) in calendar header; default 1h.
- Hover tooltip: custom React card (fixed position, white with shadow), never native `title` attribute.

---

## When You Finish a Task

1. Run `npm test -- --run` (zero failures) and `npm run build` (zero TS errors)
2. List files created/modified; list API endpoints called
3. Flag to orchestrator: endpoints not yet in backend, UX deviations from spec
