# Implementation status

## Foundation milestone (prior work)

- Monorepo structure and local environment template.
- PostgreSQL/PostGIS/pgvector migration, demo fixtures, and documented local startup.
- API vertical slice for health, authentication, incident management, risk simulation,
  map features, dashboard data, metrics, and route planning.
- React operations dashboard with incident intake, map, and simulation views.
- Redis/BullMQ worker and Python AI service with a local deterministic fallback.
- Docker Compose, monitoring configuration, architecture diagrams, and CI workflow.
- Reporter registration, role-scoped incident/evidence access, upload signature checks,
  isolated simulations, and a Dijkstra route-planning API.

---

## UI/UX redesign milestone

### What was done

**Design system (`apps/web/src/index.css`)**
- Rebuilt from scratch (~750 lines, replacing the old minified App.css).
- CSS custom properties for every colour, spacing, radius, shadow, and z-index token.
- Full typography scale using Inter (body), Manrope (display/headings), DM Mono
  (labels/code).
- Shimmer skeleton animation, focus rings, selection colour, and `::placeholder` styling.
- Responsive breakpoints at 1200 px, 900 px, and 640 px covering desktop, tablet, and
  mobile.

**Component library (`apps/web/src/components/ui/`)**
- `Badge.tsx` — `SeverityBadge`, `StatusBadge`, and generic `Badge` with variant tokens
  for every severity, status, demo, and local state.
- `Button.tsx` — `Button` (primary / secondary / ghost / danger / success, three sizes,
  loading spinner state) and `IconButton`.
- `Card.tsx` — `Card` (none / sm / md / lg padding) and `CardHeader`.
- `Skeleton.tsx` — `Skeleton`, `SkeletonText`, `StatCardSkeleton`.
- `EmptyState.tsx` — centred icon + title + description + optional action.
- `Alert.tsx` — `Alert` (error / warning / success / info / network variants) and
  `DataNotice` (permanent demo-data disclaimer).
- `Modal.tsx` — focus-trapped modal with eyebrow, title, scrollable body, footer slot,
  and backdrop-click-to-dismiss.
- `PageHeader.tsx` — eyebrow / title / description / meta / action layout.
- `StatCard.tsx` — KPI card with icon, trend badge, accent bar, and loading skeleton.

**Application layout (`apps/web/src/components/layout/`)**
- `AppShell.tsx` — sticky topbar with breadcrumbs, environment tag, notification button,
  and user pill; main content area with max-width constraint and page footer.
- `Sidebar.tsx` — fixed collapsible nav with section groups (COMMAND / RESPONSE /
  INTELLIGENCE), active-page indicator, unresolved-incidents badge, workspace chip, 
  connection status, user row, and mobile hamburger/overlay.

**Map component (`apps/web/src/components/map/RiskMap.tsx`)**
- Replaces the old `RiskMap.tsx` in `src/`.
- Hover highlight layer with feature-state, colour-coded zone fills and outlines, styled
  MapLibre popup, custom zoom / reset controls, legend overlay, location tag, loading
  pulse, and error state.
- `onZoneClick` prop allows the Live Map page to drive a separate detail panel.

**Pages (`apps/web/src/pages/`)**
- `LoginPage.tsx` — split-screen layout (hero panel with animated rain, orbits, and
  feature stats; auth card with show/hide password, remember-me checkbox, mode toggle).
  Distinguishes network errors (shows `docker compose up` hint) from credential errors.
- `OverviewPage.tsx` — greeting, demo-data notice, 4 stat cards, risk-distribution bar
  chart (Recharts), inline map panel, recent-incident activity list, source-status rows,
  and a full incident-creation modal.
- `IncidentsPage.tsx` — live search, status filter chips, sortable table with per-row
  action dropdown (status transitions), create-incident modal.
- `LiveMapPage.tsx` — full-height map with risk-category filter bar, zone-detail side
  panel, and risk-summary bar chart.
- `SimulationPage.tsx` — labelled sliders with descriptions, SVG semicircle score arc,
  per-factor contribution breakdown bars.
- `PlaceholderPage.tsx` — shared component for Risk Analysis and Analytics pages; renders
  live API totals, a synthetic trend line chart (Recharts), and a polished coming-soon
  block instead of a blank placeholder.

**Shared modules**
- `src/types.ts` — all shared TypeScript types (`User`, `Incident`, `Dashboard`,
  `SimulationResult`, `ZoneProperties`, etc.).
- `src/api.ts` — typed API client; `API_URL` defaults to `/api` (Vite dev proxy) rather
  than `http://localhost:4000/api`, which is the root cause fix for the "Failed to fetch"
  error users saw in the browser.  `ApiError` distinguishes network failures (status 0)
  from API-level errors so the login page can show targeted guidance.
- `src/App.tsx` — rewritten as a thin orchestrator that holds auth state and routes to
  page components. All business logic lives in pages and services.

### "Failed to fetch" root cause and fix

The original code used `http://localhost:4000/api` as the hard-coded API base URL.
When the Vite dev server is running on port 5173 the browser blocks the cross-origin
request if the backend CORS header does not match (or if the backend is simply not
running). The fix is to default `API_URL` to `/api`, which Vite proxies to
`http://localhost:4000` — same-origin, no CORS issue. An `ApiError` with `status === 0`
(network failure / connection refused) now shows a distinct message:

> _Cannot reach the server. Make sure the Docker services are running: `docker compose up`_

This tells users exactly what to do rather than showing a generic "Failed to fetch".

### Tests run

| Suite | Result |
|---|---|
| `apps/api` — `npm test -- --run` | **5 / 5 passed** |
| `apps/web` — `npm run build` | **✓ exit 0**, 2303 modules, no TypeScript errors |

Two build errors were found and fixed during verification:
1. `ApiError` used TypeScript `public` parameter shorthand, which is disallowed with
   `erasableSyntaxOnly: true` — converted to explicit field assignment.
2. Unused `StatusBadge` import in `OverviewPage.tsx` — removed.

The MapLibre chunk-size warning (> 500 kB) is expected and benign; the map component is
already lazy-loaded with React `Suspense`, so it does not affect initial load time.

---

## Remaining work

- Complete the remaining specification pages: response coordination / team assignments,
  AI recommendations, knowledge assistant, settings, and user management.
- Add end-to-end browser tests (Playwright) for the login flow, incident creation, and
  status transitions.
- Implement richer ingestion/provider adapters, full RAG persistence, citation retrieval,
  real recommendation approvals, and production hardening.
- Run the full stack with Docker, apply migrations, seed accounts, and verify workflows
  end-to-end when Docker Engine is available.
- GitHub publishing is blocked until GitHub CLI authentication is completed.
