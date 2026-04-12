# SOFEM MES -- COMPLETE APPLICATION SPECIFICATION

> This document is an exhaustive, line-by-level specification of the SOFEM MES application. It is intended for a developer or AI to rebuild the entire application from scratch using different technologies. **Nothing is omitted.**

---

## 1. PROJECT OVERVIEW

### 1.1 Project Name, Version, Purpose
- **Name:** SOFEM MES (Manufacturing Execution System)
- **Version:** v6.0 (admin), v3.0 (operator), v2.0 (login)
- **Purpose:** End-to-end manufacturing management for SOFEM (a metal fabrication company in Sfax, Tunisia). Manages production orders (OF), materials inventory, purchasing chain (DA/BC/BR/FA), delivery notes (BL), quality control, non-conformities, machines, maintenance, planning, operators, clients, suppliers, and reporting/analytics.

### 1.2 Technologies

**Frontend:**
- **Framework:** React 18+ with Vite 5+
- **Language:** TypeScript (strict mode — see section 1.5.3)
- **Routing:** React Router v6 (hash-based: `#dashboard`, `#orders`, etc.)
- **UI Styling:** Tailwind CSS 3+ with custom design tokens matching the spec's color system
- **State Management:** TanStack Query (React Query) for data fetching/caching; Zustand for app state
- **Forms:** React Hook Form + Zod resolver
- **Component Library:** Shared UI components (see section 1.5.2) — Button, Badge, Modal, Table, KpiCard, Pipeline, Toast, etc.
- **Testing:** Vitest (unit), React Testing Library (components), Playwright (E2E)

**Backend:**
- **Runtime:** Node.js 20+ with Express 4 + TypeScript (ES2022, ESM modules)
- **Database:** PostgreSQL 14+ (via `pg` connection pool)
- **Authentication:** JWT (HS256) stored in HttpOnly cookies, bcryptjs for PIN hashing
- **Validation:** Zod (shared schemas with frontend via mono-repo package or path alias)
- **PDF Generation:** `@react-pdf/renderer` or `pdf-lib` (backend-generated, returned as blobs)

**Infrastructure:**
- **Deployment:** Vercel (serverless functions + static files)
- **Local Dev:** Docker Compose (PostgreSQL 16, optional Redis, backend, frontend)
- **API Docs:** OpenAPI 3.1 spec with Swagger UI (dev only)

### 1.3 Architecture
- **Monorepo structure** with separate frontend and backend directories
- **Frontend:** See section 1.5 (Frontend Architecture Recommendations)
- **Backend:** Express API on port 8000, serves frontend static files when `serveFrontend: true`
- **Vercel deployment:** Uses `api/[...path].ts` bridge function to route `/api/*` to backend; static rewrites for HTML pages
- **Routing:** Hash-based client-side routing within the admin dashboard (#dashboard, #orders, etc.)

### 1.4 TypeScript Configuration
**Frontend** (`frontend/tsconfig.json`):
- target: ES2022, module: ESNext, moduleResolution: Bundler
- rootDir: `admin/ts`, outDir: `admin/js`
- strict: true, noImplicitAny: true, skipLibCheck: true
- lib: DOM, ES2022
- strictNullChecks: false, noImplicitThis: false, useUnknownInCatchVariables: false

**Backend** (`backend-ts/tsconfig.json`):
- target: ES2022, module: NodeNext, moduleResolution: NodeNext
- rootDir: `src`, outDir: `dist`
- strict: true, noImplicitAny: true, esModuleInterop: true

### 1.5 Frontend Architecture Recommendations

#### 1.5.1 Framework Choice — Confirmed
**React 18+ with Vite + TypeScript + React Router** is the confirmed frontend stack.

**Rationale:**
- 20+ forms with similar patterns (modal, validation, submit) benefit from component reuse
- Shared state (current user, notifications, settings) is easier with React Context + Zustand
- Testing infrastructure (Vitest, React Testing Library) is mature
- Hot Module Replacement (HMR) speeds up development
- TanStack Query handles API caching, background refetch, and invalidation automatically

**Styling approach:** Tailwind CSS with CSS custom properties for the spec's color tokens (`--red`, `--bg`, `--border`, etc.). This preserves the dark/light theme system and accent color customization defined in section 3 while avoiding hand-written CSS duplication across 20+ pages.

**Form handling:** React Hook Form + Zod resolver for all forms. Zod schemas are shared between frontend (form validation) and backend (request validation), guaranteeing type consistency.

#### 1.5.2 Component Library (Don't Repeat Yourself)
The original spec has 20+ pages with repeated modal, table, form, badge, and button code. Build a shared component library:

```
frontend/src/components/
├── ui/
│   ├── Button.tsx          — variant: primary(danger)/secondary/ghost, size: sm/md/lg
│   ├── Badge.tsx           — color: red/green/blue/orange/muted, variant: filled/outlined
│   ├── Input.tsx           — text, number, date, select with label + validation
│   ├── Modal.tsx           — header, body, footer slots, overlay, close on Escape
│   ├── Table.tsx           — sortable columns, checkbox column, pagination, loading state
│   ├── ProgressBar.tsx     — width%, color variants, animated
│   ├── Toast.tsx           — success/error/warning, auto-dismiss, stacked
│   ├── KpiCard.tsx         — value, label, icon, trend indicator
│   ├── Pipeline.tsx        — stage circles with arrows, clickable states
│   ├── EmptyState.tsx      — icon, message, action button
│   └── ConfirmDialog.tsx   — title, message, confirm/cancel
├── forms/
│   ├── OperationBuilder.tsx — add/remove operations, machine select, operator assign
│   ├── BomPreview.tsx      — material list with stock warning
│   └── StockWarning.tsx    — shortfall list, auto-DA info
└── layouts/
    ├── Sidebar.tsx
    ├── Topbar.tsx
    └── PageLayout.tsx      — topbar + sidebar + content wrapper
```

#### 1.5.3 TypeScript Strict Mode
The original spec has `strictNullChecks: false, noImplicitThis: false`. **Enable these for the new build:**
- `strictNullChecks: true` — prevents undefined/null runtime errors
- `noImplicitAny: true` — already enabled, keep it
- `noImplicitThis: true` — catches incorrect `this` usage
- `useUnknownInCatchVariables: true` — catch blocks get `unknown` type
- `exactOptionalPropertyTypes: true` — optional props can't be explicitly undefined

#### 1.5.4 Testing Strategy
- **Unit tests:** Vitest for utility functions (date formatting, number parsing, validation)
- **Component tests:** React Testing Library for modals, forms, tables
- **Integration tests:** API client mocking, full page render with data fetching
- **E2E tests:** Playwright for critical workflows (OF creation, stock movement, quality control)
- **Minimum coverage:** 70% lines, 80% branches on business logic

#### 1.5.5 State Management
- **React Context** for: current user, theme, notifications, sidebar state
- **Zustand or Jotai** for: OF list, materials cache, form state (lighter than Redux)
- **React Query (TanStack Query)** for: data fetching, caching, invalidation, background refetch
- **localStorage** ONLY for: theme, sidebar collapsed, API URL override

#### 1.5.6 Accessibility (a11y)
- All forms: `<label>` associated with `<input>`, `aria-describedby` for errors
- Modals: `role="dialog"`, `aria-modal="true"`, focus trap, Escape to close
- Tables: `scope="col"` on headers, `aria-label` on action buttons
- Colors: minimum 4.5:1 contrast ratio (WCAG AA)
- Keyboard navigation: Tab order logical, Enter/Space on buttons

---

## 2. TYPOGRAPHY

### 2.1 Google Fonts Import (all HTML files)
```html
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
```

### 2.2 Font Families
| Font | Usage |
|------|-------|
| `'Bebas Neue', sans-serif` | Logo, page headers, KPI values, modal titles, stage labels |
| `'IBM Plex Mono', monospace` (weights 400, 600) | Data values, codes, badges, timestamps, filter bar buttons, sidebar labels, clock, form labels, PIN display |
| `'IBM Plex Sans', sans-serif` (weights 300, 400, 500, 600) | Body text, form inputs, table cells, descriptions, general UI text |

Key sizes: Page headers ~28-30px, KPI values ~36-40px, table body ~11-13px, form labels ~8px, badges ~8-9px, numpad keys ~22px. Letter spacing: 1-4px on mono/display fonts.

---

## 3. COLOR SYSTEM

### 3.1 CSS Custom Properties (Dark Theme Default)
Core tokens: `--red` (primary brand), `--red-d` (hover), `--red-g` (glow/tint), `--bg`, `--bg2`, `--bg3` (background hierarchy), `--border`, `--text`, `--muted`, `--accent` (orange), `--green`, `--blue`.

### 3.2 Light Theme
Same tokens with inverted light palette. Additional rules: topbar/sidebar shadows, nav-item hover backgrounds, table text color overrides.

### 3.3 Status/Category Color Assignments
- **Priority:** URGENT (red), HAUTE (orange), NORMAL (blue), BASSE (muted)
- **OF Status:** IN_PROGRESS (red tint), COMPLETED (green), DRAFT (muted), APPROVED (blue), CANCELLED (red)
- **Roles:** ADMIN (red), MANAGER (blue), OPERATOR (green)
- **Machine Status:** OPERATIONNELLE (green), EN_MAINTENANCE (orange), EN_PANNE (red), ARRETEE (muted)
- **Gravity:** MINEURE (blue), MAJEURE (red), CRITIQUE (red)
- **Notification Levels:** danger (red), warning (orange), info (blue)
- **Movement Types:** ENTREE (green), SORTIE (red), ADJUST (orange)
- **Operation Dots:** COMPLETED (green), IN_PROGRESS (blinking orange), PENDING (red dim)
- **Stock Bars:** danger <50% (red), warning 50-90% (orange), ok >90% (green)
- **Date Cells:** past (red bold), within 3 days (orange), normal (muted)

### 3.4 Accent Color Customization
Users can change `--red` via settings to preset colors (red, blue, green, orange, violet, pink) or any custom color via color picker.

---

## 4. LOGIN PAGE

### 4.1 File: `frontend/index.html`

### 4.2 Layout
Centered card (340px wide, 2.5rem padding, border-radius 16px, bg2) on full viewport flex center. Card top accent: 3px red bar. Body has 45deg stripe pattern overlay.

### 4.3 Elements
1. **Logo section:** 56x56px red icon with "S" (Bebas Neue 28px), "SOFEM" (Bebas Neue 28px, 4px letter-spacing), sub text "MES v2.0 - Manufacturing Execution System" (9px red mono)
2. **PIN label:** "Entrez votre code PIN" (9px muted mono, uppercase)
3. **PIN dots:** 4 circles (16px), filled state: red bg, scale 1.1
4. **Numpad:** 3x4 grid (keys 1-9, empty, 0, backspace), Bebas Neue 22px, hover: red glow
5. **Login button:** "CONNEXION" (11px mono, uppercase), default opacity 0.4, class `ready` = opacity 1
6. **Error message:** red, 10px mono, shake animation
7. **Footer:** "SMARTMOVE - Mahmoud Njeh - (c) 2025" (9px muted mono)

### 4.4 PIN System Workflow
1. User clicks numpad keys or uses keyboard (0-9) to enter 4 digits
2. Each digit fills the next dot with red background and scale transform
3. On 4th digit entry: auto-submit triggered after 300ms setTimeout
4. Enter key also triggers login if 4 digits are entered
5. Backspace deletes last digit, unfills dot
6. POST to `${API}/api/auth/login` with body `{"pin": "1234"}`
7. Server validates PIN against all active users, sets HttpOnly cookie on success
8. Response JSON: `{role, nom, prenom, operateur_id}`
9. Redirect: ADMIN/MANAGER -> `/admin`, otherwise -> `/operator`
10. Error flow: reset PIN to '', clear dots, remove ready class, show shake animation

### 4.5 API Base Resolution (`resolveApiBase()`)
1. Check `window.SOFEM_API_URL` global variable
2. Check `localStorage.getItem('SOFEM_API_URL')`
3. If either set: trim, remove trailing slashes, return
4. If localhost/127.0.0.1 with non-8000 port: return `protocol://hostname:8000`
5. Otherwise: return current origin

### 4.6 Error Handling
- If API returns HTML instead of JSON: show "API non joignable: HTML recu au lieu de JSON..."
- On any error: reset PIN, clear dots, reset button text, remove ready class, shake animation

---

## 5. ADMIN DASHBOARD - COMPLETE PAGE-BY-PAGE SPECIFICATION

### 5.0 Main HTML File: `frontend/admin/index.html`

### 5.1 Sidebar Navigation
190px wide, bg2 background, border-right. Collapses to 0px via `collapsed` class. State persisted in localStorage (`sofem_sidebar_collapsed`). Transition 0.3s ease. Toggle via hamburger button (ID `sidebar-toggle`) in topbar.

**Navigation Groups and Items:**

| Group | Nav Items (data-p value) |
|-------|------------------------|
| **Principal** | dashboard, operator-dashboard, orders, calendar, monitor, bl |
| **Gestion** | materials, products, clients, operators |
| **Achats** | da, bc, br, fa |
| **Qualite** | qualite, nc |
| **Equipements** | machines, maintenance, planning |
| **Fournisseurs** | fournisseurs |
| **Data** (label red) | reports, activity |
| **Analytique** (label red) | analytics-production, analytics-achats, analytics-operateurs, analytics-qualite |
| **Admin** (id: admin-only-nav, hidden for non-ADMIN) | settings, users, op-types |

**Sidebar Footer:** "SOFEM MES v6.0<br>SMARTMOVE - 2025" (8px mono muted, border-top)

**Active state:** white text, red glow background, 2px red left border. **Hover:** text color, subtle white background.

### 5.2 Topbar
58px height, bg2, sticky top z-200, border-bottom.

**Left:** Brand logo (34x34px red with SVG), "SOFEM MES" (Bebas Neue 20px), "Administration" sub (8px red mono), role badge (red bordered).

**Right:** Sidebar toggle, user info (10px mono muted), live clock (French locale), theme toggle (moon/sun emoji), logout button ("DECONNEXION", 9px mono).

### 5.3 Dashboard Page (page-dashboard)

**What it does:** The central landing page showing production health at a glance. Provides KPIs, a production pipeline for active OFs, recent OF table, stock alerts, monthly production chart, and quick links to analytics.

**How users interact:**
1. User navigates to dashboard (default page on login)
2. Five KPI cards display at top with real-time counts
3. Pipeline section auto-selects first IN_PROGRESS OF; user can select different OF from dropdown
4. Pipeline shows 5 stage circles (color-coded by status) with arrows between them
5. User clicks stage buttons to advance operations (PENDING -> IN_PROGRESS -> COMPLETED)
6. "Modifier pipeline" button opens OF detail modal for full editing
7. Recent OFs table shows last 6 of first 100 OFs with click-to-edit
8. Stock alerts panel shows up to 12 materials sorted by stock level with progress bars
9. Monthly bar chart shows OFs per month (last 8 months)
10. Quick access buttons navigate to analytics pages

**Complete workflow:**
1. Page loads -> `loadDashboard()` fires
2. GET `/api/dashboard` fetches KPI stats (ordres_actifs, urgents, taux_completion, alertes_stock, en_retard, graphique)
3. GET `/api/of?limit=100` fetches OFs for recent table
4. GET `/api/rapports/stock-alertes` (or parses from OF data) shows materials below minimum
5. KPIs rendered with color-coded classes (g=green, a=accent, b=blue, o=orange)
6. Pipeline: dropdown populated with OFs sorted by status (IN_PROGRESS first)
7. Auto-select first IN_PROGRESS OF, render its pipeline stages
8. Monthly chart: bars with current month at opacity 1/red, others at 0.55

**Behind the scenes:**
- Dashboard stats query: aggregates from ordres_fabrication (SUM with CASE WHEN for each KPI)
- Graphique query: groups OFs by year/month for last 6 months
- Pipeline stages rendered as interactive buttons with three visual states
- Stage advancement calls PUT `/api/of/{id}/operations/{op_id}` with statut
- Auto-advance: completing an operation triggers syncOfStatus() which recalculates parent OF status
- Stock alerts use materiaux WHERE stock_actuel < stock_minimum

**Edge cases:**
- No IN_PROGRESS OFs: dropdown shows all OFs, none auto-selected
- Zero OFs: KPIs show 0, pipeline section empty
- No stock alerts: stock panel shows "Stock OK" message
- Chart with no data: shows empty placeholder
- API failure: toast error, KPIs show 0 defaults

### 5.4 Orders Page (page-orders)

**What it does:** The complete management interface for Production Orders (Ordres de Fabrication). Users can create, edit, duplicate, cancel, advance status, search, filter, bulk-select, and generate invoices from OFs. This is the most feature-rich page in the application.

**How users interact:**
1. User clicks "Ordres de Fab." in sidebar or navigates to #orders
2. Full table of OFs displayed with 12 columns
3. Filter bar at top: status filter buttons (Tous, En cours, Brouillon, Approuve, Termine, Urgent), search input, date input, reset button
4. Count row shows total filtered count and bulk actions
5. Each row has action buttons: Fiche, Facture, Interne, advance, edit, temps, dupliquer, annuler
6. "+ Nouvel OF" button opens the create modal
7. Refresh button reloads data

**Complete workflow - Create OF:**
1. User clicks "+ Nouvel OF" -> opens `m-of` modal
2. User selects product (triggers BOM data loading via `data-bom` attribute)
3. User enters quantity (default 1), selects priority (URGENT/HIGH/NORMAL/LOW)
4. User selects client, chef d'atelier (filtered by CHEF_ATELIER role), workshop (default "Atelier A")
5. User sets deadline date (required), optional plan reference
6. User builds operations: selects operation type, machine (OPERATIONNELLE only), assigns operator checkboxes
7. BOM preview auto-shows: material, qty needed (qty_per_unit * OF qty), current stock, override input
8. Stock warning shows "! X DA(s) auto" if shortfall, or "Stock OK" checkmark
9. Notes textarea (optional)
10. "Creer OF + BL" button submits -> POST `/api/of`
11. Backend: creates OF, auto-creates BL (if bl_auto_creation setting), auto-creates DAs for stock shortfalls
12. Response: `{numero, bl_numero, das_crees}` returned
13. Modal closes, toast success, orders table refreshes

**Complete workflow - Edit OF:**
1. User clicks edit (pencil) on OF row -> opens `m-of` modal in edit mode
2. All fields pre-populated with current OF data
3. Operations builder shows existing operations
4. BOM shows current overrides
5. "Enregistrer modifications" button -> PUT `/api/of/{id}/full`
6. Full OF data sent including operations, bom_overrides
7. Backend updates all related tables in transaction
8. Modal closes, table refreshes

**Complete workflow - Advance OF Status:**
1. User clicks advance (play) button on OF row
2. If COMPLETED OF: shows "Facture" and "Fiche" options instead
3. For non-completed: calls `advanceOFSafe(id, statut)` which PUTs to `/api/of/{id}` with new statut
4. Backend validates state transitions (DRAFT->APPROVED->IN_PROGRESS->COMPLETED)
5. OF status updates, row re-renders with new status badge
6. If advancing to COMPLETED: may trigger auto quality control creation (if cq_auto_creation setting)

**Complete workflow - Duplicate OF:**
1. User clicks duplicate button -> opens `m-of-dup` modal
2. Shows source OF number, product info
3. User sets new quantity (default = source qty), priority, date (default +30 days)
4. User selects client, chef, plan reference
5. Summary shows: product name, operation count, BOM count
6. "Confirm Duplicate" -> POST `/api/of/{id}/duplicate`
7. Backend creates new OF with copied operations, BOM, settings
8. New OF created as DRAFT, new BL auto-created
9. Modal closes, orders table refreshes

**Complete workflow - Cancel OF:**
1. User clicks cancel button -> opens `m-cancel` modal
2. Shows OF number and info
3. User must enter mandatory reason (min 5 characters, validated in real-time)
4. Confirm button disabled until reason >= 5 chars
5. Warning displayed: "Action irreversible"
6. "Confirmer" -> PUT `/api/of/{id}/cancel` with `{reason}`
7. Backend cascade: OF->CANCELLED, BL->CANCELLED, DAs->CANCELLED, BCs->CANCELLED
8. If operations had started: `suggest_nc: true` returned (ISO 9001 Clause 10.2)
9. Frontend may suggest creating NC
10. Activity logged with CANCEL action
11. Modal closes, table refreshes

**Complete workflow - Stock Warning:**
1. When creating/editing OF, BOM stock check runs in real-time
2. For each BOM material: required = qty_per_unit * OF_qty, compare with stock_actuel
3. If shortfall: shows "! X DA(s) auto" in orange/red
4. If stock OK: shows green checkmark
5. If user proceeds with insufficient stock and stock_deduction_auto is enabled:
   - Backend auto-creates DAs for shortfall materials
   - Returns DA numbers in response
6. If stock insufficient with pending DAs: 409 Conflict response
7. `m-stock-warning` modal shows: shortfall list (material, stock, required, missing), auto-created DA numbers, pending DA info

**Complete workflow - Bulk Actions:**
1. "Selectionner OFs termines pour facture groupée" checkbox
2. User clicks "Selectionner termines" -> checks all COMPLETED OF checkboxes
3. User can manually check/uncheck individual OF checkboxes
4. "Facture Groupée" button -> POST `/api/facture/grouped` with selected OF IDs
5. Backend generates combined PDF invoice
6. PDF opened in new tab

**Complete workflow - Search and Filter:**
1. Status filter buttons: toggle active class, filter OFs array client-side
2. "Tous" = no filter, "En cours" = statut IN_PROGRESS, "Brouillon" = DRAFT, etc.
3. "Urgent" filter = priorite URGENT
4. Search input: filters by OF number, product name, operator name (client-side)
5. Date input: filters by date_echeance
6. Reset button: clears all filters, reloads all data
7. Count row updates with filtered count

**Behind the scenes:**
- OF data loaded via GET `/api/of?limit=100` (or 500 for monitor)
- Each OF object includes: joined produit_nom, client_nom, chef_projet_nom, bl_numero, bl_statut, operations array
- Operations array: joined machine_nom, operateurs_noms (STRING_AGG), sorted by ordre
- Filter bar state stored in JS variables, re-renders table on change
- Row actions use inline onclick handlers exposed on window object
- Cancelled OFs rendered with line-through and "X ANNULE" label
- COMPLETED OFs show Fiche/Facture buttons, others show advance/edit

**Edge cases:**
- No products available: OF modal shows error toast
- No clients: client select shows empty, OF can be created without client
- No machines: machine select in operations builder shows empty
- Stock deduction fails: 409 response, user must resolve before proceeding
- Cancel with reason < 5 chars: button disabled, real-time validation
- Duplicate OF with invalid data: validation error toast
- Bulk invoice with no OFs selected: error toast

**All modals:**
1. **Create/Edit OF** (`m-of`): Full OF form with product, qty, priority, client, chef, workshop, deadline, plan, operations builder, BOM preview, stock warning, notes
2. **OF Detail** (`m-of-detail`): Header with OF info, 3 tabs (Operations, BOM, Cost), editable tables per tab, save buttons
3. **OF Duplicate** (`m-of-dup`): Source info, new qty/priority/date/client/chef/plan, summary, notes, confirm
4. **Cancel** (`m-cancel`): Document number/info, mandatory reason textarea (min 5 chars), confirm button, irreversible warning
5. **Stock Warning** (`m-stock-warning`): Shortfall list, auto-created DAs display, pending DAs display

### 5.5 Production Monitoring Page (page-monitor)

**What it does:** Real-time monitoring view of all IN_PROGRESS production orders. Shows operations pipeline with clickable stages, progress bars, elapsed time tracking, and auto-refresh.

**How users interact:**
1. User navigates to Monitoring page
2. Stats line shows "X ORDRES EN COURS"
3. Table shows each IN_PROGRESS OF with: OF number/client, product, operations pipeline, progress bar
4. Each stage is a clickable button (PENDING/IN_PROGRESS/COMPLETED states)
5. Click stage to advance: PENDING -> IN_PROGRESS or IN_PROGRESS -> COMPLETED
6. Progress bar shows completion percentage (completed ops / total ops)
7. Elapsed time display for IN_PROGRESS operations updates live
8. "Modifier pipeline" button opens OF detail modal
9. "Actualiser" button manually refreshes data
10. Auto-refresh: elapsed times updated every 30 seconds via setInterval

**Complete workflow:**
1. Page loads -> `loadMonitor()` fires
2. GET `/api/of?limit=500&statut=IN_PROGRESS` fetches all active OFs
3. For each OF: render progress bar (completed/total ops * 100)
4. Render operations as pipeline stage buttons
5. For each IN_PROGRESS operation: calculate elapsed time (NOW() - debut), display live
6. setInterval(updateElapsedTimes, 30000) updates elapsed times every 30 seconds
7. User clicks stage -> calls `advOperation(opId, ofId, newStatus)` -> PUT `/api/of/{id}/operations/{op_id}`
8. Backend validates ordering constraints, updates operation, syncs OF status
9. Table re-renders with updated states
10. If operation completes OF: status changes, OF removed from monitor list

**Behind the scenes:**
- Operations must be completed in order (ordre field)
- Cannot start operation N until all operations 0..N-1 are COMPLETED
- Only ONE operation can be IN_PROGRESS at a time
- When IN_PROGRESS operation completed: next PENDING operation auto-started (if no other IN_PROGRESS)
- Elapsed time calculation: parses debut timestamp, subtracts from current time, formats as HH:MM
- Progress bar: CSS width percentage based on completed/total ratio

**Edge cases:**
- No IN_PROGRESS OFs: shows "Aucun ordre en cours" message
- Operation ordering violation: 409 error toast
- Another operation IN_PROGRESS: 409 error, must complete first
- Auto-refresh during user action: may cause brief flash of old data
- OF completes during monitoring: removed from list on next refresh

### 5.6 Calendar Page (page-calendar)

**What it does:** Visual calendar view of production orders organized by deadline date. Supports month and week views with color-coded priority indicators.

**How users interact:**
1. User navigates to Calendar page
2. Month/Year displayed with prev/next navigation buttons
3. "Aujourd'hui" button jumps to current month
4. View toggle: Mois (month grid) / Semaine (week columns)
5. Legend shows color coding: Red=URGENT, Orange=HAUTE, Blue=NORMALE, Muted=BASSE, Green=TERMINE
6. Month view: 7-column grid (Mon-Sun), day cells with OF labels (max 3 shown, "+N autres" for overflow)
7. Week view: larger day cells with OF cards showing number and product
8. Click on day with OFs: navigates to orders page filtered by that date
9. Click OF card in week view: opens OF detail modal
10. Today cell highlighted with red border and red-tinted background
11. Weekend cells have darker background

**Complete workflow:**
1. Page loads -> `loadCalendar()` fires
2. GET `/api/of?limit=200` fetches OFs
3. OFs filtered by date_echeance, grouped by date
4. Month view: 7-column CSS grid, French day headers (LUN, MAR, MER...)
5. For each day cell: find OFs with that date_echeance, render as colored labels
6. Week view: 7 columns for the week starting Monday
7. OF cards show OF number and product name with status-colored left border
8. Navigation: prev/next buttons adjust current month, re-render grid
9. Day click: navigate to `#orders` with date filter applied

**Behind the scenes:**
- Calendar state: currentMonth, currentYear, viewMode (month/week) stored in JS variables
- OF color derivation: COMPLETED=green, URGENT=red, HAUTE=orange, NORMALE=blue, default=muted
- Day cell rendering: min-height 80px (month), 200px (week)
- OFs per day capped at 3 visible, remaining shown as "+N autres"

**Edge cases:**
- No OFs for month: empty grid with "Aucun ordre" message
- Month boundary: prev/next navigation handles year rollover
- Week view spanning month boundary: shows correct dates from adjacent months
- OFs without date_echeance: excluded from calendar

### 5.7 Materials Page (page-materials)

**What it does:** Full materials inventory management with stock tracking, movement history, and stock level alerts.

**How users interact:**
1. User navigates to Materials page
2. Materials table shows: Code, Name, Stock, Min, Unite, Prix/u (DT), Fournisseur, Level bar, Actions
3. Level bar visually shows stock percentage (red <50%, orange <90%, green >=90%)
4. "+ Materiau" button opens new material modal
5. "+ Mouvement" button opens stock movement modal
6. Edit (pencil) on material row opens edit modal
7. Delete (trash) on material row prompts confirmation, then DELETE
8. Movements History table shows: Date, Material, Type (ENTREE green/SORTIE red/ADJUST orange), Qty, Before, After, OF, Motif
9. Movements limited to last 20 entries

**Complete workflow - Create Material:**
1. User clicks "+ Materiau" -> opens `m-mat` modal
2. Code preview shows auto-generated next code (MAT-YYYY-N format)
3. User enters: Name (required), Unite (default: pcs), Stock initial, Min, Prix unitaire
4. Fournisseur dropdown populated from suppliers
5. "Creer" -> POST `/api/materiaux`
6. Backend creates material, assigns code
7. Modal closes, table refreshes

**Complete workflow - Stock Movement:**
1. User clicks "+ Mouvement" -> opens `m-mv` modal
2. User selects material, type (ENTREE/SORTIE), enters quantity, optional motif
3. "Enregistrer" -> POST `/api/materiaux/mouvement`
4. Backend: reads current stock, calculates new stock, creates movement record
5. For ENTREE: stock_actuel += quantite; for SORTIE: stock_actuel -= quantite; for ADJUST: stock_actuel = quantite
6. Movement record: materiau_id, type, quantite, stock_avant, stock_apres, motif, created_at
7. Modal closes, materials table and movements history refresh

**Complete workflow - Edit Material:**
1. User clicks edit (pencil) -> opens `m-mat-edit` modal
2. Fields pre-populated with current values
3. User modifies: Name, Unite, Min, Prix, Fournisseur
4. Stock initial is NOT editable (use movements instead)
5. "Enregistrer" -> PUT `/api/materiaux/{id}`
6. Modal closes, table refreshes

**Behind the scenes:**
- Materials loaded via GET `/api/materiaux` (active only by default)
- Stock percentage: CASE WHEN stock_minimum > 0 THEN stock_actuel/stock_minimum*100 ELSE 100 END
- Alerte flag: stock_actuel < stock_minimum
- Movements loaded via GET `/api/materiaux/mouvements?limit=20`
- Movement history joins materiaux and ordres_fabrication for full context
- Material delete: soft delete (actif=FALSE)

**Edge cases:**
- Stock goes negative: allowed (system doesn't prevent, relies on workflow controls)
- No suppliers: fournisseur dropdown empty
- Movement with zero quantity: still recorded
- Material with active OFs: deletion still allowed (soft delete only)

### 5.8 Products Page (page-products)

**What it does:** Product catalog management with Bill of Materials (BOM) editor. Products are the items manufactured by SOFEM, each with a BOM defining required materials.

**How users interact:**
1. User navigates to Products page
2. Table shows: Code (auto-generated SOFEM-YYYY-N), Product name, Description, Unite, Prix Vente HT, BOM pills, Actions
3. BOM display inline: pills showing "material_name x quantity", plus "Edit BOM" button
4. "+ Produit" button opens new product modal
5. Click "Edit BOM" on any product -> inline BOM editor panel opens below table
6. BOM editor: title with product name, "Fermer" button
7. Add line: select material, enter quantity, click "Ajouter"
8. BOM lines table: material name, editable quantity, unit, delete button
9. "Enregistrer" -> PUT `/api/produits/{id}/bom` replaces entire BOM
10. Edit product (pencil) opens edit modal

**Complete workflow - Create Product:**
1. User clicks "+ Produit" -> opens `m-prod` modal
2. Code preview shows auto-generated next code (SOFEM-YYYY-N)
3. User enters: Name (required), Description (optional), Unite (default: pcs), Prix Vente HT (default: 0)
4. "Creer" -> POST `/api/produits`
5. Backend creates product with auto-code
6. Modal closes, table refreshes

**Complete workflow - BOM Management:**
1. User clicks "Edit BOM" on product row -> `bom-editor-panel` appears
2. Panel shows current BOM lines in editable table
3. "Add line" section: material dropdown, quantity input, "Ajouter" button
4. Adding line: POST `/api/produits/{id}/bom` with single BOMLine
5. Or: modify quantities in table, click "Enregistrer" -> PUT `/api/produits/{id}/bom` with full BOMLine array (replaces all)
6. Delete line: DELETE `/api/produits/{id}/bom/{mid}`
7. "Fermer" closes panel
8. BOM data used in OF creation: qty_per_unit * OF_qty = required material

**Behind the scenes:**
- Products loaded via GET `/api/produits` (active only, with BOM data joined)
- BOM table: `bom` with columns (produit_id, materiau_id, quantite_par_unite), composite PK
- BOM query joins materiaux for name, unite, stock_actuel
- BOM replace: DELETE all then INSERT all in single transaction
- BOM add: INSERT ON CONFLICT DO UPDATE (upsert)
- Product code auto-generation via document_sequences table (SOFEM prefix)

**Edge cases:**
- No materials available: BOM material dropdown empty
- BOM with zero quantity: filtered out in payload processing
- Duplicate BOM line (same materiau_id): upsert updates quantity
- Product deletion: soft delete (actif=FALSE), BOM lines remain (FK not cascaded)

### 5.9 Operators Page (page-operators)

**What it does:** Manage production team members (operateurs) with specialty, role, pay rates, and contact info. These are the actual workers on the shop floor, distinct from system users.

**How users interact:**
1. User navigates to Operators page
2. Table shows: Avatar (initials circle, 34px red), Prenom, Nom, Specialite, Role badge, Telephone, Taux (rate), Statut badge, Actions
3. Rate display varies by type: HORAIRE = "X TND/h", PIECE = "X TND/pcs", LES_DEUX = "X TND/h + Y TND/pcs"
4. "+ Operateur" button opens new operator modal
5. Edit (pencil) opens edit modal
6. Delete prompts confirmation, then soft-deactivates

**Complete workflow - Create Operator:**
1. User clicks "+ Operateur" -> opens `m-op` modal
2. User enters: Prenom (required), Nom (required), Specialite (default: "Ponçage"), Role (dropdown: OPERATEUR/CHEF_ATELIER/RESPONSABLE/TECHNICIEN), Telephone, Email
3. Taux type selector: HORAIRE/PIECE/LES_DEUX - shows/hides rate fields
4. Taux horaire and Taux piece inputs (shown based on type selection)
5. "Creer" -> POST `/api/operateurs`
6. Backend creates operator with rate defaults (0)
7. Modal closes, table refreshes

**Behind the scenes:**
- Operators loaded via GET `/api/operateurs` (active only, optional role filter)
- Roles: OPERATEUR, CHEF_ATELIER, RESPONSABLE, TECHNICIEN (different from user roles)
- Rate types: HORAIRE, PIECE, BOTH (stored as type_taux)
- Soft delete: actif=FALSE
- Avatar: initials circle, red background, Bebas Neue font

**Edge cases:**
- Operator linked to active user: deletion still allowed (soft delete only)
- Operator assigned to active OF: deactivation warning but still allowed
- Duplicate name: allowed (no unique constraint on nom+prenom)

### 5.10 Users Page (page-users)

**What it does:** Manage system users who can log in. Each user has a PIN for authentication, a role (ADMIN/MANAGER/OPERATOR), and optionally a link to an operateur record.

**How users interact:**
1. User navigates to Users page (admin-only)
2. Table shows: Nom, Prenom, Role badge, Operateur lie, Statut (ACTIF/INACTIF), Actions
3. "+ Utilisateur" button opens user creation modal
4. Edit opens edit modal
5. Desactiver button soft-deactivates user

**Complete workflow - Create User:**
1. User clicks "+ Utilisateur" -> opens `m-user` modal
2. User enters: Prenom (required), Nom (required), Role (ADMIN/MANAGER/OPERATOR), PIN (4 digits), Operateur lie (dropdown)
3. PIN validated: exactly 4 digits required
4. "Creer" -> POST `/api/auth/users`
5. Backend: hash PIN with bcrypt, create user
6. Modal closes, table refreshes

**Behind the scenes:**
- Users loaded via GET `/api/auth/users` (paginated, limit/offset)
- PIN hashing: bcrypt level 10 (migrated from legacy SHA-256 on first login)
- Role options: ADMIN, MANAGER, OPERATOR (different from operateur roles)
- operateur_id links to operateurs table (nullable)
- Soft delete: actif=FALSE
- PIN validation: regex /^\d{4}$/

**Edge cases:**
- PIN not 4 digits: validation error toast
- Duplicate name: allowed
- User with active sessions: deactivation doesn't kill existing sessions (only prevents new logins)

### 5.11 Machines Page (page-machines)

**What it does:** Equipment registry with status tracking. Machines are physical equipment used in production operations.

**How users interact:**
1. User navigates to Machines page
2. KPIs: Total, Operationnelles (green), En Maintenance (orange), En Panne (red)
3. Table: Code, Nom, Type, Atelier, Marque/Modele, Statut badge, Actions
4. "+ Nouvelle Machine" button opens creation modal
5. Status dropdown per row: OPERATIONNELLE, EN_MAINTENANCE, EN_PANNE, ARRETEE
6. Edit button opens edit modal
7. Delete button with confirmation

**Complete workflow - Create Machine:**
1. User clicks "+ Nouvelle Machine" -> opens `modal-machine`
2. Code preview: auto-generated (MCH-YYYY-N)
3. User enters: Nom (required), Type, Atelier (default: "Atelier A"), Marque, Modele, Numero de serie, Date d'acquisition, Notes
4. "Creer" -> POST `/api/machines`
5. Backend assigns code, creates record
6. Modal closes, table and KPIs refresh

**Complete workflow - Change Status:**
1. User clicks status dropdown on machine row
2. Selects new status: OPERATIONNELLE, EN_MAINTENANCE, EN_PANNE, ARRETEE
3. PUT `/api/machines/{id}` with {statut: new_status}
4. Badge updates immediately
5. KPIs recalculate

**Behind the scenes:**
- Machines loaded via GET `/api/machines` (active only)
- Stats via GET `/api/machines/stats/overview` (COUNT with FILTER WHERE clauses)
- Soft delete: actif=FALSE
- Status values: OPERATIONNELLE, EN_MAINTENANCE, EN_PANNE, ARRETEE
- Code auto-generation via nextCode("MCH")

**Edge cases:**
- Machine assigned to active operations: status change still allowed
- Machine with active planning slots: status change still allowed
- Delete with active references: soft delete only

### 5.12 Maintenance Page (page-maintenance)

**What it does:** Maintenance order management for machines. Supports preventive, corrective, and emergency maintenance types.

**How users interact:**
1. User navigates to Maintenance page
2. KPIs: Total OMs, En Cours (orange), Planifies, Urgences (red), Cout Total (TND)
3. Table: N (OM number), Type icon (shield/hammer/siren), Titre, Machine, Technicien, Date, Priorite badge, Statut badge, Actions
4. "+ Nouvel Ordre" button opens creation modal
5. Status dropdown per row: Planifie, En Cours, Termine
6. Cancel button opens cancel modal

**Complete workflow - Create Maintenance Order:**
1. User clicks "+ Nouvel Ordre" -> opens `modal-maintenance`
2. User selects: Machine dropdown, Type (PREVENTIF/CORRECTIF), Titre (required), Description, Priorite, Technicien dropdown, Date planifiee, Duree estimée
3. "Creer" -> POST `/api/maintenance`
4. Backend assigns OM number, creates record
5. Modal closes, table refreshes

**Behind the scenes:**
- Maintenance orders loaded via GET `/api/maintenance`
- Types: PREVENTIVE, CORRECTIVE, URGENCE
- Priority: BASSE, NORMAL, HAUTE, URGENTE
- Status: PLANIFIE, EN_COURS, TERMINE, ANNULE
- Soft cancel: statut=ANNULE with activity logging
- Numbering: OM-YYYY-N format

**Edge cases:**
- Machine already under maintenance: still allows creating new order
- Technician not available: no validation, just recorded
- Cancel with no reason: requires reason (ISO 9001 compliance)

### 5.13 Planning Page (page-planning)

**What it does:** Production scheduling with Gantt chart visualization. Assign OFs to machines and operators with date/time slots.

**How users interact:**
1. User navigates to Planning page
2. Gantt chart shows colored bars for each planning slot on a timeline
3. Table: OF, Produit, Machine, Operateur, Debut, Fin, Statut, Actions (delete)
4. "+ Nouveau Creneau" button opens creation modal
5. OF selection opens picker modal with card grid
6. User selects OF, machine, operator, start/end dates
7. Duration indicator auto-calculated from dates
8. Info preview shows: product, client, quantity, deadline, priority
9. Delete button removes planning slot

**Complete workflow - Create Planning Slot:**
1. User clicks "+ Nouveau Creneau" -> opens `modal-planning`
2. User clicks OF selection -> opens `modal-of-picker`
3. Picker: search input (filters by number, product, client, status, workshop), card grid
4. Each card: OF number, product name, client, quantity, deadline, workshop, priority badge, progress bar
5. User clicks card -> fills planning form with OF data
6. User selects machine (OPERATIONNELLE only), operator
7. User sets date debut (required), date fin (required)
8. Duration auto-calculated and displayed
9. "Creer" -> POST `/api/planning`
10. Backend validates dates (fin > debut), creates slot
11. Gantt chart and table refresh

**Behind the scenes:**
- Planning data via GET `/api/planning`
- Gantt data via GET `/api/planning/gantt` (manager+ only)
- planning_slots table: of_id, machine_id, operateur_id, date_debut, date_fin, statut, notes
- OF picker loads OFs with status-colored left borders
- Duration calculation: date_fin - date_debut in hours/minutes
- Machine filter: only OPERATIONNELLE status

**Edge cases:**
- Overlapping slots on same machine: no validation (system allows double-booking)
- End date before start date: validation error
- OF without deadline: can still be scheduled
- Machine status changes to non-OPERATIONNELLE: existing slots remain

### 5.14 Quality Page (page-qualite)

**What it does:** Quality control management. Records inspections of production orders with pass/fail counts and auto-derives conformity status.

**How users interact:**
1. User navigates to Quality page
2. KPIs: Total Contrôles, Taux Conformité (green), Non Conformes (red), En Attente (orange)
3. Table: N CQ, OF, Produit, Type, Contrôleur, Date, Contrôlé, Conf, Rebut, Résultat badge+%, Actions
4. "+ Nouveau Contrôle" button opens creation modal
5. Status dropdown per row: Conforme, Non Conforme, En Attente
6. "+NC" button (only if NON_CONFORME): opens NC modal pre-filled

**Complete workflow - Create Quality Control:**
1. User clicks "+ Nouveau Contrôle" -> opens `modal-qualite`
2. User selects: OF dropdown (IN_PROGRESS and COMPLETED only), Type (default: FINAL), Operateur, Date (default today)
3. User enters: Quantité contrôlée (required), Quantité conforme, Quantité rebut
4. Live resultat badge updates on input:
   - If rebut > 0 OR ok < total: NON_CONFORME (red)
   - If total > 0: CONFORME (green)
   - Otherwise: EN_ATTENTE (orange)
5. Notes (optional)
6. "Enregistrer" -> POST `/api/qualite/controles`
7. Backend auto-derives statut from quantities
8. Modal closes, table refreshes

**Complete workflow - Create NC from Quality Control:**
1. User clicks "+NC" button on NON_CONFORME row
2. NC modal opens pre-filled: OF from CQ, description references CQ number
3. User enters: Type défaut (required), Description, Gravite (default: MINEURE), Action corrective, Responsable
4. "Creer" -> POST `/api/qualite/nc`
5. NC created as OUVERTE
6. Modal closes

**Behind the scenes:**
- Controls loaded via GET `/api/qualite/controles`
- CQ table: cq_numero (auto CQ-YYYY-N), of_id, type_controle, operateur_id, date_controle, statut, quantite_controlee, quantite_conforme, quantite_rebut, notes
- Statut auto-derivation in backend on save
- NC link: cq_id foreign key (nullable)
- OF filter: only IN_PROGRESS and COMPLETED OFs available

**Edge cases:**
- OF not in progress or completed: not available in dropdown
- Quantities don't add up: system doesn't validate (conforme + rebut can differ from controlee)
- NC from CONFORME control: "+NC" button hidden

### 5.15 Non-Conformities Page (page-nc)

**What it does:** Track and manage production defects/non-conformities with severity levels and corrective actions.

**How users interact:**
1. User navigates to Non-Conformities page
2. KPIs: Ouvertes (red), En Cours (orange), Critiques (red), Clôturées (green)
3. Table: N NC, OF, Type défaut (+ description snippet), Gravite badge with emoji, Action Corrective, Responsable, Statut, Actions
4. "+ Nouvelle NC" button opens creation modal
5. Status flow: OUVERTE -> EN_COURS -> CLOTUREE

**Complete workflow - Create NC:**
1. User clicks "+ Nouvelle NC" -> opens `modal-nc`
2. User selects: OF dropdown, enters Type défaut (required), Description, Gravite (MINEURE/MAJEURE/CRITIQUE, default: MINEURE), Action corrective, Responsable dropdown
3. "Creer" -> POST `/api/qualite/nc`
4. Backend assigns NC number, creates as OUVERTE
5. Modal closes, table refreshes

**Behind the scenes:**
- NCs loaded via GET `/api/qualite/nc`
- NC table: nc_numero (auto NC-YYYY-N), cq_id (nullable), of_id (nullable), type_defaut, description, gravite, statut, action_corrective, responsable_id, date_cloture
- Gravity: MINEURE, MAJEURE, CRITIQUE
- Status: OUVERTE, EN_COURS, CLOTUREE
- date_cloture set when statut changes to CLOTUREE

**Edge cases:**
- NC without OF link: allowed (of_id nullable)
- NC without CQ link: allowed (cq_id nullable, can be created standalone)
- Reopening closed NC: status can be changed back from CLOTUREE

### 5.16 Suppliers Page (page-fournisseurs)

**What it does:** Supplier registry with contact info, status tracking, and blacklisting capability.

**How users interact:**
1. User navigates to Suppliers page
2. Table: Code, Raison Sociale (with MF subline), Contact, Telephone, Email, Ville, Statut badge, Actions
3. Status: ACTIF (green check), INACTIF (muted circle), BLACKLISTE (red X)
4. "+ Nouveau Fournisseur" button opens creation modal
5. Edit button opens edit modal
6. Status dropdown per row: Actif, Inactif, Blackliste

**Complete workflow - Create Supplier:**
1. User clicks "+ Nouveau Fournisseur" -> opens `modal-fournisseur`
2. Code preview: auto-generated (FOURN-YYYY-N)
3. User enters: Nom (required), Contact, Telephone, Email, Ville (default: Sfax), Pays (default: Tunisie), Matricule Fiscal, Adresse
4. "Creer" -> POST `/api/fournisseurs`
5. Backend assigns code, creates record
6. Modal closes, table refreshes

**Behind the scenes:**
- Suppliers loaded via GET `/api/fournisseurs` (paginated)
- Code auto-generation via nextCode("FOURN", 4)
- Status: ACTIF, INACTIF, BLACKLISTE
- Soft delete: actif=FALSE with deactivation tracking
- Default country: Tunisie
- Matricule Fiscal: Tunisian tax ID

**Edge cases:**
- Supplier with active BCs: status change still allowed
- Blacklisted supplier: still appears in dropdowns (system doesn't prevent selection)
- Duplicate MF: no validation

### 5.17 Operation Types Page (page-op-types)

**What it does:** Catalog of production operation types (e.g., "Decoupage", "Pliage", "Soudage") used in OF operation pipelines.

**How users interact:**
1. User navigates to Operation Types page
2. Table: Ordre, Nom, Description, Statut (ACTIF/INACTIF), Actions
3. "+ Nouvelle Opération" button opens creation modal
4. Edit opens edit modal
5. Delete: if operation is used in OFs, soft-deactivates; otherwise hard deletes

**Complete workflow - Create Operation Type:**
1. User clicks "+ Nouvelle Opération" -> opens `m-op-type` modal
2. User enters: Nom (required), Description, Ordre (auto-increment)
3. "Creer" -> POST `/api/operation-types`
4. Backend checks for duplicate name (400 if exists)
5. Creates with ordre = 0 (or specified value)
6. Modal closes, table refreshes

**Behind the scenes:**
- Active types via GET `/api/operation-types`, all via `/api/operation-types/all`
- operation_types table: id, nom (unique), description, ordre, actif
- Delete: if used in of_operations, soft-deactivate (actif=FALSE); otherwise DELETE
- Duplicate name check: SELECT WHERE nom=$1 before insert

**Edge cases:**
- Duplicate name: 400 error with message
- Type used in OFs: soft-deactivate, shows count of linked OFs
- Order not specified: defaults to 0

### 5.18 Reports Page (page-reports)

**What it does:** Historical reporting with monthly production chart, stock alerts, and operator performance metrics.

**How users interact:**
1. User navigates to Reports page
2. Monthly production chart: bar chart, last 8 months, red bars, current month highlighted
3. Stock alerts: material items with name, stock/min ratio, progress bar (red)
4. Operator performance: avatar, name, specialty, total OFs, completed steps, average duration

**Behind the scenes:**
- Monthly production: GET `/api/rapports/production-mensuelle` (12 months, grouped by TO_CHAR)
- Operators: GET `/api/rapports/operateurs` (joins operateurs, op_operateurs, of_operations)
- Stock alerts: GET `/api/rapports/stock-alertes` (WHERE stock_actuel < stock_minimum)

### 5.19 Activity Page (page-activity)

**What it does:** Audit log of all user actions and system events. Full traceability for ISO 9001 compliance.

**How users interact:**
1. User navigates to Activity page
2. Table: Date/Heure, Action (icon + badge), Utilisateur, Type badge, ID, Detail
3. Action icons: CREATE (+), UPDATE (pencil), DELETE (X), LOGIN (key), LOGOUT (door), APPROVE (check), REJECT (X), PRINT (printer), EXPORT (send), CONFIRM (checkmark)
4. Color coding: CREATE green, UPDATE orange, DELETE red, LOGIN blue, LOGOUT muted, APPROVE green, REJECT red, PRINT muted, EXPORT blue, CONFIRM green
5. "Actualiser" button reloads data
6. CSV export button downloads activity log

**Behind the scenes:**
- Activity loaded via GET `/api/notifications/activity`
- activity_log_v2 table: id (BIGSERIAL), created_at, user_id, user_nom, action, entity_type, entity_id, entity_numero, old_value (JSONB), new_value (JSONB), reason, ip_address, session_token, detail
- Indexes: entity_type+entity_id, user_id, action, created_at, entity_numero
- CSV export: semi-colon separated, UTF-8 with BOM

### 5.20 Analytics Pages

#### 5.20.1 Production Analytics (page-analytics-production)
**What it does:** 12-month production trend analysis with status breakdown, late OF detection, and workshop load distribution.

**How users interact:**
1. User navigates to Analytics -> Production
2. KPIs: OFs (12 mois), Termines (green with %), En cours (blue), En retard (red if >0), Taux completion
3. Bar chart: OF par mois (12 months)
4. Horizontal bars: status distribution
5. Late OFs table: OF number, product, client, status, retard (+Xj in red Bebas Neue 18px)
6. Workshop load: horizontal bars per atelier

**Behind the scenes:**
- Data via GET `/api/analytics/production`
- Response: par_mois (mois_label, total, completes), statuts (statut, n), retards (numero, produit_nom, client_nom, statut, jours_retard), ateliers (atelier, n)
- jours_retard: CURRENT_DATE - date_echeance for OFs past deadline

#### 5.20.2 Purchasing & Stock Analytics (page-analytics-achats)
**What it does:** Stock level analysis, purchase order flow tracking, supplier spending analysis, and stock movement history.

**How users interact:**
1. KPIs: Alertes stock, Stock bas, Valeur stock (blue), DAs en attente, BRs en attente
2. Stock levels: material bars with ALERTE/BAS/OK badges
3. DA flux: status distribution bars
4. Top suppliers: horizontal bars by spending amount
5. Stock movements table: Type, Material, Quantity, Before, After, Motif, Date

**Behind the scenes:**
- Data via GET `/api/analytics/achats`
- Response: stock (nom, pct, stock_actuel, stock_minimum, unite), valeur_totale_stock, da_statuts (statut, n), top_fournisseurs (fournisseur, montant_total), mouvements

#### 5.20.3 Operators Analytics (page-analytics-operateurs)
**What it does:** Operator performance metrics including completed operations, total hours, specialty distribution, and labor cost analysis.

**How users interact:**
1. KPIs: Operateurs actifs, Chefs atelier, Operations terminees, Heures enregistrees, Specialites
2. Performance table: operator avatar+name, role, specialty, ops terminees (green Bebas Neue 22px), total duration, OFs impliqués, taux
3. Specialty distribution: horizontal bars
4. Labor cost by operation: horizontal bars

**Behind the scenes:**
- Data via GET `/api/analytics/operateurs`
- Response: performance (prenom, nom, specialite, role, ops_terminees, duree_totale_min, ofs_impliques, taux_horaire, taux_piece, type_taux), specialites (specialite, n), cout_par_operation (operation_nom, cout_total)

#### 5.20.4 Quality Analytics (page-analytics-qualite)
**What it does:** Quality metrics including conformity rate trends, defect type analysis, and open non-conformity tracking.

**How users interact:**
1. KPIs: Taux conformite, Total controles, NCs ouvertes, NCs critiques, Pieces rebutées
2. Conformity rate chart: 12 months, green if >=95%, orange if >=85%, red otherwise
3. Defect types: horizontal bars by type
4. Open NCs table: NC number, OF, product, defect type, gravity, responsible, age (red if >7 days), corrective action

**Behind the scenes:**
- Data via GET `/api/analytics/qualite`
- Response: kpis (taux_global, total_cq, total_rebut), nc_kpis (ouvertes, critiques), par_mois (mois_label, taux), defauts (type_defaut, n), nc_ouvertes (nc_numero, of_numero, produit_nom, type_defaut, gravite, resp_prenom, resp_nom, age_jours, action_corrective)

### 5.21 Settings Page (page-settings)

**What it does:** System configuration interface with tabs for System settings, Display preferences, and User management.

**How users interact:**
1. User navigates to Settings (admin-only)
2. Three tabs: Système (default), Affichage, Utilisateurs
3. "Sauvegarder" button per card, "Tout Sauvegarder" at top

#### 5.21.1 System Tab (Système)
6 setting cards:

**Card 1: Informations Société** - Company info (nom, tagline, adresse, ville, telephone, email, website, MF, RC)
**Card 2: Paramètres Financiers** - Financial settings (TVA rate, devise, overhead_pct, prix_horaire_defaut, prix_piece_defaut)
**Card 3: Workflow Production** - Production workflow (bl_auto_creation, stock_deduction_auto, cq_avant_completed, cq_auto_creation, da_auto_approve_seuil, of_numero_format, da_numero_format)
**Card 4: Seuil & Alertes** - Thresholds (stock_alerte_auto, retard_alerte_jours, urgent_auto_jours)
**Card 5: Documents & PDF** - PDF settings (pdf_rev, pdf_pied_custom, pdf_entete_custom)
**Card 6: Gestion des Accès** - Access control (session_timeout_min, pin_min_length, da_approve_role, of_delete_role)

Each card has individual "Sauvegarder" + bulk "Tout sauvegarder". Save via PUT `/api/settings/bulk` with `{settings: {cle: value}}`.

#### 5.21.2 Display Tab (Affichage)
- Format & Localisation: date format, number format, currency position (with live previews)
- Tableau de Bord: OF count, auto-refresh interval, default page, notification duration
- Colonnes Liste des OFs: BL column toggle, Chef Atelier column toggle, Client column toggle, compact mode
- Thème de l'Interface: Dark/Light visual preview cards
- Couleur d'Accentuation: 6 presets + custom color picker

> **Source of truth note:** Display preferences (theme, accent color, column toggles, etc.) are stored in **localStorage** under `sofem_display` — these are **user-specific, client-side only** and do NOT sync to the server. System settings (company info, workflow flags, thresholds) are stored in the **database** `settings` table. The two sources are deliberately separate: localStorage for UI preferences, DB for business configuration.

#### 5.21.3 Users Tab (Utilisateurs)
Inline management table with user avatars, role dropdowns, linked operateur, status toggle, PIN change, and inline add form. Security best practices card with 6 tips.

**Behind the scenes:**
- System settings stored in `settings` table: id, groupe, cle, valeur (TEXT), type
- Values parsed: boolean (true/1/yes), number (parseInt/parseFloat), string (default)
- Bulk save: iterates entries, INSERT ON CONFLICT DO UPDATE
- Groups: societe, finance, workflow, alertes, pdf, acces
- Display settings in localStorage: {theme, accent_color, date_format, number_format, currency_position, dash_of_count, auto_refresh_sec, default_page, toast_duration, show_bl_col, show_chef_col, show_client_col, compact_table}

### 5.22 BL Page (page-bl) - Delivery Notes

**What it does:** Manage delivery notes (Bons de Livraison) auto-created with each OF. Track delivery status and generate delivery PDFs.

**How users interact:**
1. User navigates to BL page
2. Table: N BL, N OF, Produit, Qté, Destinataire, Statut (EMIS blue/LIVRE green), Date Livraison, Actions
3. PDF button: opens PDF in new tab
4. Edit (pencil) opens edit modal with version history panel
5. Livrer (green, only if not LIVRE): opens delivery modal
6. If OF not COMPLETED: "not ready" modal shows current OF status, prevents delivery
7. Annuler (if not LIVRE/CANCELLED): opens cancel modal

**Complete workflow - Deliver BL:**
1. User clicks "Livrer" -> checks if OF is COMPLETED
2. If not: opens `m-bl-notready` modal showing OF status, blocks delivery
3. If COMPLETED: opens `m-bl-livrer` modal
4. User enters: Destinataire (required), Adresse (default: "Route Sidi Salem 2.5KM, Sfax"), Date (required), Notes
5. "Confirmer" -> PUT `/api/bl/{id}/livrer`
6. Backend updates BL: statut=LIVRE, date_livraison_reelle=NOW(), destinataire, adresse, date_livraison, notes
7. Modal closes, table refreshes

**Behind the scenes:**
- BLs loaded via GET `/api/bl`
- BL table: id, numero (auto BL-YYYY-N), of_id, statut (EMIS/LIVRE/CANCELLED), destinataire, adresse, date_livraison, date_livraison_reelle, notes, cancel_reason, cancelled_by, cancelled_at
- Auto-creation: when OF created with bl_auto_creation=true
- PDF via GET `/api/bl/{id}/pdf` (cookie auth — opens in new tab, browser sends session cookie automatically)

**Edge cases:**
- BL without completed OF: delivery blocked with status warning
- BL already LIVRE: livrer button hidden
- Cancelled BL: no actions available

### 5.23 DA Page (page-da) - Purchase Requests

**What it does:** Manage purchase requests (Demandes d'Achat) created by operators, validated by managers. Full approval workflow.

**How users interact:**
1. User navigates to DA page
2. Table: N DA, Description, Materiau, Qté, Urgence badge, Statut badge, OF lie, BC/BR references, Actions
3. Status badges: BROUILLON/PENDING (muted), APPROUVEE (green), REJETEE (red), COMMANDEE (red), RECUE (green)
4. "+ Demande" button opens creation modal
5. Approve (check, green): PUT status APPROVED (only if PENDING)
6. Reject (X, red): PUT status REJECTED (only if PENDING)
7. BA PDF: generates purchase order document
8. Cancel: opens cancel modal (if not CANCELLED/RECEIVED/ORDERED)

**Complete workflow - Create DA:**
1. User clicks "+ Demande" -> opens `m-da` modal
2. User enters: Description (required), Materiau dropdown, OF dropdown, Objet, Quantite (default 1), Unite (default pcs), Urgence (NORMAL/URGENT), Demandeur dropdown, Notes
3. "Creer" -> POST `/api/achats/da`
4. Backend assigns DA number, creates as PENDING
5. If amount below da_auto_approve_seuil: auto-approves
6. Modal closes, table refreshes

**Behind the scenes:**
- DAs loaded via GET `/api/achats/da`
- DA table: id, da_numero (auto DA-YYYY-N), description, materiau_id, of_id, objet, quantite, unite, urgence, demandeur_id, statut (PENDING/APPROVED/REJECTED/ORDERED/RECEIVED/CANCELLED), valideur_id, notes, created_at
- Auto-DA creation: when OF created with insufficient stock and stock_deduction_auto enabled
- BA PDF via GET `/api/achats/da/{id}/ba?token=`

### 5.24 BC Page (page-bc) - Purchase Orders

**What it does:** Manage supplier purchase orders (Bons de Commande) with multi-line item support.

**How users interact:**
1. User navigates to BC page
2. Table: N BC, Fournisseur, Montant HT, TVA 19%, Total TTC, Statut badge, DA lie, Date, Actions
3. Status: DRAFT (muted), ENVOYE (blue), RECU (green), ANNULE (red), RECU_PARTIEL (red-glow)
4. "+ Bon Commande" button opens creation modal
5. PDF button opens PDF in new tab
6. Status dropdown: Envoye, Recu partiel, Recu, Annule

**Complete workflow - Create BC:**
1. User clicks "+ Bon Commande" -> opens `m-bc` modal
2. User selects: Fournisseur (required), DA lie (APPROVED only), Notes
3. Multi-line management: add/remove lines dynamically
4. Each line: Materiau select, Description, Quantite, Unite
5. "Ajouter ligne" button adds new line row
6. "Creer" -> POST `/api/achats/bc`
7. Backend creates BC record, then inserts each line item into `bc_lignes` table (single transaction, rollback on any failure)
8. Modal closes, table refreshes

**Behind the scenes:**
- BCs loaded via GET `/api/achats/bc` with line items JOINed from `bc_lignes`
- BC table: id, bc_numero (auto BC-YYYY-N), fournisseur, da_id, statut (DRAFT/ENVOYE/RECU/ANNULE/RECU_PARTIEL), notes, montant_ht, montant_ttc, created_at
- Line items from `bc_lignes` joined on bc_id
- PDF via GET `/api/achats/bc/{id}/pdf` (cookie auth)
- Cancel requires reason

### 5.25 BR Page (page-br) - Goods Receipt

**What it does:** Record goods receipt (Bons de Reception) against purchase orders. Automatically updates stock levels.

**How users interact:**
1. User navigates to BR page
2. Table: N BR, BC lie, Fournisseur, Statut, Quantites (received/ordered), Montant, Actions
3. Status: EN_ATTENTE (muted), PARTIEL (red-glow), COMPLET (green), ANNULE (red)
4. "+ Reception" button opens creation modal
5. Receptionner button: opens confirmation modal (only if not COMPLET/ANNULE)
6. PDF button

**Complete workflow - Create BR:**
1. User clicks "+ Reception" -> opens `m-br` modal
2. User selects: BC dropdown (loads BC lines), Date (required), Statut (default: COMPLET), Notes
3. Line items populate from BC: material/description, qty commanded (disabled), qty received (editable), unit price, total (calculated)
4. User edits qty received for partial reception
5. "Enregistrer" -> POST `/api/achats/br`
6. Backend: creates BR record
7. Modal closes, table refreshes

**Complete workflow - Confirm Reception:**
1. User clicks "Receptionner" -> opens `m-br-confirm` modal
2. Shows: BR number, material info, fournisseur, BC reference
3. Qty commanded (disabled), qty received (editable, defaults to commanded), unit price, total
4. Status indicator: warning for partial, success for complete
5. "Confirmer" -> PUT `/api/achats/br/{id}/confirmer`
6. Backend: updates stock_actuel += quantite_recue, creates ENTREE movement, updates BC status, updates DA status to RECEIVED
7. Modal closes, table refreshes

**Behind the scenes:**
- BRs loaded via GET `/api/achats/br`
- BR table: id, br_numero (auto BR-YYYY-N), bc_id, statut, date_reception, lignes (JSONB array of {quantite_recue, prix_unitaire}), notes, quantite_recue, quantite_commandee, unite, montant_total, fournisseur
- br_lignes join table: bc_ligne_id, quantite_recue, prix_unitaire
- Stock update on confirmation: ENTREE movement type

### 5.26 FA Page (page-fa) - Purchase Invoices

**What it does:** Track supplier purchase invoices (Factures d'Achat) linked to purchase orders.

**How users interact:**
1. User navigates to FA page
2. Table: N FA, Fournisseur, BC lie, Montant HT, TVA, Total TTC, Statut, Date, Actions
3. "+ Facture Achat" button opens creation modal
4. PDF button
5. Payer button marks invoice as paid

**Complete workflow - Create FA:**
1. User clicks "+ Facture Achat" -> opens `m-fa` modal
2. User selects: BC dropdown, Fournisseur (required), Date (required), Notes
3. "Creer" -> POST `/api/achats/fa`
4. Backend assigns FA number, creates record
5. Modal closes, table refreshes

**Behind the scenes:**
- FAs loaded via GET `/api/achats/fa`
- FA table: id, fa_numero (auto FA-YYYY-N), bc_id, of_id, fournisseur, date_facture, montant_ht, notes
- PDF via GET `/api/achats/fa/{id}/pdf` (cookie auth)

### 5.27 Operator Dashboard Page (page-operator-dashboard)

**What it does:** Personalized dashboard for operators showing their assigned tasks, performance metrics, and quick access to key features.

**How users interact:**
1. Operator logs in (not admin/manager) -> redirected to /operator
2. Greeting card: avatar (initials, 52px red), "Bonjour, {prenom} {nom}", date in French, urgent count badge
3. KPIs: Mes taches actives, OFs termines, Performance (%)
4. "My Active OFs" section: OF cards with number, product, priority badge, status badge, progress bar, next operations (max 2)
5. Quick Access Grid (3 columns): Mes OFs, Qualite, Analytique, Calendrier, Monitoring, Parametres

**Complete workflow:**
1. `loadCurrentUser()`: GET `/api/auth/me`, checks role
2. If ADMIN/MANAGER: redirect to `/admin`; if not authenticated: redirect to `/`
3. `loadData()`: GET `/api/dashboard/operator/{operateur_id}` + GET `/api/of` + GET `/api/materiaux`
4. OF cards filtered by operateur_id (assigned via op_operateurs join table)
5. Stage progression: click stage -> PUT `/api/of/{id}/etape/{etape_name}` with {statut, operateur_id}
6. Auto-refresh: setInterval(loadData, 3000) every 3 seconds

**Behind the scenes:**
- Operator stats: mes_ofs_actifs (IN_PROGRESS count), ofs_termines (COMPLETED count), performance (termines/total * 100)
- All API calls use credentials: 'include' for cookie auth
- Dynamic pipeline: stages derived from `operation_types` table (ordered by `ordre` field), NOT hardcoded. Each OF's operations determine which stages are shown. The old hardcoded 5-stage pipeline (AutoCAD, Decoupage, Pliage, Soudage, Ponçage) has been replaced with this dynamic approach.

### 5.28 Notification System

**What it does:** Real-time alert system polling the backend for stock alerts, late OFs, urgent orders, pending DAs, and pending BRs.

**Complete workflow:**
1. On DOMContentLoaded + 1s: `initNotifications()` injects bell icon into topbar
2. Bell icon with badge count (hidden if 0, shows total max 99+)
3. Badge color: red if danger > 0, orange otherwise
4. Bell animation: ring 2s infinite if danger > 0
5. Click bell: opens dropdown panel (360px wide)
6. Panel header: "NOTIFICATIONS" title, summary text ("3 critiques  2 retards  1 info"), refresh button
7. Notification items: icon, title, detail text, color-coded left border
8. Panel footer: "VOIR ANALYTIQUES" button
9. Polling: setInterval(refreshNotifications, 90000) every 90 seconds
10. Uses `apiSilent` (never triggers logout on 401)
11. Click notification: navigates to mapped page (stock->materials, retard->orders, urgent->orders, da->da, br->br)
12. Click outside panel: closes panel

**Behind the scenes:**
- GET `/api/notifications` returns {total, danger, warning, info, items: [{level, type, icon, title, detail}]}
- Navigation map: {stock: 'materials', retard: 'orders', urgent: 'orders', da: 'da', br: 'br'}

### 5.29 User Management & Security

**What it does:** Comprehensive session management, brute-force protection, PIN recovery, and security audit trail.

#### 5.29.1 Session Management
**What it does:** View and manage active user sessions. Admins can revoke any session; users can revoke their own.

**How users interact:**
1. User navigates to Users page -> "Sessions" tab (admin-only)
2. Table shows: User (avatar+name), Session ID, Login date, Last activity, IP address, User-Agent, Actions
3. "Ma session" badge highlights current user's session
4. "Revoquer" button on any session (admin) or own sessions (user)
5. "Tout revoquer" revokes all sessions for a user (admin)
6. Confirmation modal before revocation

**Complete workflow:**
1. On login: session record created with session_token, ip_address, user_agent
2. Session stored in `sessions` table: {id, user_id, session_token, ip_address, user_agent, created_at, last_activity, revoked_at}
3. Every authenticated request updates `last_activity`
4. GET `/api/auth/sessions` returns active sessions (filtered by role)
5. POST `/api/auth/sessions/:sid/revoke` sets `revoked_at = NOW()`
6. Revoked token added to blocklist (in-memory + Redis if available)
7. JWT validated against blocklist on every request
8. Auto-expiry: sessions older than TOKEN_EXPIRE_HOURS automatically cleaned

**Behind the scenes:**
- Session token is the JWT `jti` claim (UUID v4)
- Blocklist: Map<string, number> in memory (key=token, value=expiry_ts)
- Redis blocklist (if available): SETEX jti remaining_seconds 1
- GET `/api/auth/me` checks blocklist before returning user data

#### 5.29.2 Login Rate Limiting & Brute-Force Protection
**What it does:** Prevent PIN brute-force attacks with progressive lockout.

**Complete workflow:**
1. Failed login attempt increments counter in `login_attempts` table: {ip_address, pin_hash_prefix, attempts, locked_until}
2. 3 consecutive failures: 30-second cooldown
3. 5 consecutive failures: 5-minute cooldown
4. 10 consecutive failures: 1-hour cooldown + admin notification
5. Successful login resets counter
6. Lockout status returned in response: `{locked: true, retry_after_seconds: 180}`
7. Frontend shows countdown timer: "Trop de tentatives. Reessayez dans 3:00"
8. Admin receives notification (bell + email if configured) on 10+ failures

**Behind the scenes:**
- Rate limit check before PIN validation
- Counter keyed by IP + truncated PIN hash (first 8 chars, prevents reverse)
- Cleanup: DELETE WHERE locked_until < NOW() - INTERVAL '1 hour'
- Rate limit headers on login response: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After

#### 5.29.3 PIN Reset Flow
**What it does:** Admin-initiated PIN reset for users who forgot their code.

**Complete workflow:**
1. Admin opens Users page, clicks "Reinitialiser PIN" on user row
2. Confirmation modal: "Reinitialiser le PIN de {prenom} {nom}?"
3. Admin enters new 4-digit PIN (or auto-generate)
4. "Confirmer" -> POST `/api/auth/users/:uid/reset-pin` with `{new_pin: "5678", force_change: true}`
5. Backend: hash new PIN, set `pin_must_change = TRUE`
6. User redirected to "Changer votre PIN temporaire" on next login
7. PIN change modal: old PIN (optional if force_change), new PIN (6 digits), confirm new PIN
8. PUT `/api/auth/me/pin` validates strength, sets `pin_must_change = FALSE`

**Behind the scenes:**
- `pin_must_change` BOOLEAN DEFAULT FALSE on users table
- Admin role can reset any PIN; MANAGER can reset OPERATOR only
- All PIN changes logged in activity_log_v2 with action='PIN_RESET'

#### 5.29.4 Failed Login Audit
**What it does:** Track all failed authentication attempts for security monitoring.

**Behind the scenes:**
- `failed_logins` table: {id, attempted_pin_hash, ip_address, user_agent, created_at, resolved_user_id (nullable)}
- If PIN matches a user: resolved_user_id populated
- If PIN matches no user: resolved_user_id NULL, attempted_pin_hash stores full hash
- Viewable in Activity page with action='LOGIN_FAILED'
- Alert threshold: 5+ failures from same IP in 1 hour triggers notification

#### 5.29.5 Two-Factor Authentication (Optional, ADMIN role)
**What it does:** Optional TOTP-based 2FA for ADMIN users.

**How users interact:**
1. ADMIN user navigates to Settings -> Security
2. "Activer 2FA" generates QR code with TOTP secret
3. User scans with authenticator app (Google Authenticator, Authy)
4. User enters 6-digit code to verify setup
5. On subsequent logins: after PIN, prompted for 6-digit TOTP code
6. "Se souvenir de cet appareil" checkbox (30-day cookie)

**Behind the scenes:**
- TOTP secret stored encrypted in users.totp_secret (AES-256-GCM with server key)
- `totp_enabled` BOOLEAN DEFAULT FALSE on users table
- If totp_enabled: login returns `{requires_2fa: true}` after PIN validation
- 2FA verification: POST `/api/auth/verify-2fa` with `{code: "123456", remember_device: false}`
- Remember device cookie: `sofem_2fa_device` (HttpOnly, Secure, 30 days, cryptographically signed)
- JWT only issued after both PIN and 2FA verified

#### 5.29.6 Security Headers & Cookie Hardening
**All authentication cookies:**
- HttpOnly: true (no JavaScript access)
- Secure: true (in production, NODE_ENV=production)
- SameSite: Strict (no cross-site requests)
- Path: /
- Max-Age: TOKEN_EXPIRE_HOURS * 3600

**API security headers (all responses):**
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=31536000 (production only)
- Content-Security-Policy: default-src 'self' (frontend HTML pages)

**CSRF Protection:**
- CSRF token generated on /api/auth/me, stored in cookie `sofem_csrf`
- All mutating requests (POST/PUT/DELETE/PATCH) must include X-CSRF-Token header
- Token value matches cookie value (Double Submit Cookie pattern)
- Exempted: GET, HEAD, OPTIONS
- Frontend: reads cookie, sets header via api() wrapper

---

## 6. CANONICAL ENUM DICTIONARY

> **Critical rule:** ALL status, role, type, and priority values stored in the database are in **ENGLISH** (uppercase, snake_case). The French labels shown in the UI are display translations ONLY. The API and database NEVER store French values. All frontend-backend mapping uses this dictionary as the single source of truth.

### 6.1 OF Status (ordres_fabrication.statut)
| DB Value | French UI Label | Description | Color |
|----------|----------------|-------------|-------|
| `DRAFT` | Brouillon | Created, editable | muted |
| `APPROVED` | Approuve | Validated, ready for production | blue |
| `IN_PROGRESS` | En cours | Production started | red |
| `COMPLETED` | Termine | All operations done | green |
| `CANCELLED` | Annule | Cancelled with reason | red (strikethrough) |

### 6.2 OF Priority (ordres_fabrication.priorite)
| DB Value | French UI Label | Description | Color |
|----------|----------------|-------------|-------|
| `URGENT` | URGENT | Highest priority | red |
| `HIGH` | HAUTE | High priority | orange |
| `NORMAL` | NORMAL | Standard priority | blue |
| `LOW` | BASSE | Low priority | muted |

### 6.3 User Roles (users.role)
| DB Value | French UI Label | Dashboard | Can Manage Users |
|----------|----------------|-----------|-----------------|
| `ADMIN` | Administrateur | Admin full access | Yes |
| `MANAGER` | Responsable | Admin limited (no users/settings) | No |
| `OPERATOR` | Operateur | Operator dashboard only | No |

### 6.4 Operator Roles (operateurs.role)
| DB Value | French UI Label | Description |
|----------|----------------|-------------|
| `OPERATEUR` | Operateur | Production worker |
| `CHEF_ATELIER` | Chef d'atelier | Workshop supervisor |
| `RESPONSABLE` | Responsable | Department head |
| `TECHNICIEN` | Technicien | Maintenance technician |

### 6.5 Operator Pay Types (operateurs.type_taux)
| DB Value | French UI Label | Description |
|----------|----------------|-------------|
| `HORAIRE` | Horaire | Hourly rate |
| `PIECE` | A la piece | Per-piece rate |
| `BOTH` | Les deux | Both hourly and per-piece |

### 6.6 Machine Status (machines.statut)
| DB Value | French UI Label | Description | Color |
|----------|----------------|-------------|-------|
| `OPERATIONNELLE` | Operationnelle | Available for use | green |
| `EN_MAINTENANCE` | En maintenance | Scheduled maintenance | orange |
| `EN_PANNE` | En panne | Breakdown | red |
| `ARRETEE` | Arretee | Shut down | muted |

### 6.7 Operation Status (of_operations.statut)
| DB Value | French UI Label | Description | Visual |
|----------|----------------|-------------|--------|
| `PENDING` | En attente | Not started | red dim circle |
| `IN_PROGRESS` | En cours | Currently active | blinking orange circle |
| `COMPLETED` | Terminee | Finished | green circle |

### 6.8 Stock Movement Types (mouvements_stock.type)
| DB Value | French UI Label | Effect on Stock | Color |
|----------|----------------|-----------------|-------|
| `ENTREE` | Entree | stock_actuel += quantite | green |
| `SORTIE` | Sortie | stock_actuel -= quantite | red |
| `ADJUST` | Ajustement | stock_actuel = quantite | orange |

### 6.9 BL Status (bons_livraison.statut)
| DB Value | French UI Label | Description |
|----------|----------------|-------------|
| `EMIS` | Emis | Created with OF, not delivered |
| `LIVRE` | Livre | Delivered to recipient |
| `CANCELLED` | Annule | Cancelled with OF |

### 6.10 DA Status (demandes_achat.statut)
| DB Value | French UI Label | Description | Color |
|----------|----------------|-------------|-------|
| `PENDING` | En attente | Awaiting approval | muted |
| `APPROVED` | Approuvee | Approved by manager | green |
| `REJECTED` | Rejetee | Rejected | red |
| `ORDERED` | Commandee | BC created for this DA | blue |
| `RECEIVED` | Recue | BR confirmed, stock updated | green |
| `CANCELLED` | Annulee | Cancelled | red |

### 6.11 DA Urgence (demandes_achat.urgence)
| DB Value | French UI Label | Description |
|----------|----------------|-------------|
| `NORMAL` | Normal | Standard urgency |
| `URGENT` | Urgent | Urgent request |

### 6.12 BC Status (bons_commande.statut)
| DB Value | French UI Label | Description | Color |
|----------|----------------|-------------|-------|
| `DRAFT` | Brouillon | Draft, not sent | muted |
| `ENVOYE` | Envoye | Sent to supplier | blue |
| `RECU` | Recu | Fully received | green |
| `ANNULE` | Annule | Cancelled | red |
| `RECU_PARTIEL` | Recu partiel | Partially received | red-glow |

### 6.13 BR Status (bons_reception.statut)
| DB Value | French UI Label | Description | Color |
|----------|----------------|-------------|-------|
| `EN_ATTENTE` | En attente | Pending confirmation | muted |
| `COMPLET` | Complet | Fully received | green |
| `PARTIEL` | Partiel | Partially received | red-glow |
| `ANNULE` | Annule | Cancelled | red |

### 6.14 Quality Control Status (controle_qualite.statut)
| DB Value | French UI Label | Description | Color |
|----------|----------------|-------------|-------|
| `EN_ATTENTE` | En attente | Awaiting inspection | orange |
| `CONFORME` | Conforme | Passed inspection | green |
| `NON_CONFORME` | Non conforme | Failed inspection | red |
| `EN_COURS` | En cours | Inspection in progress | blue |

### 6.15 Quality Control Type (controle_qualite.type_controle)
| DB Value | French UI Label | Description |
|----------|----------------|-------------|
| `FINAL` | Final | Final inspection |
| `INTERMEDIAIRE` | Intermediaire | Mid-process inspection |
| `RECEPTION` | Reception | Goods receipt inspection |

### 6.16 NC Status (non_conformites.statut)
| DB Value | French UI Label | Description | Color |
|----------|----------------|-------------|-------|
| `OUVERTE` | Ouverte | Open non-conformity | red |
| `EN_COURS` | En cours | Being addressed | orange |
| `CLOTUREE` | Cloturee | Closed/resolved | green |

### 6.17 NC Gravity (non_conformites.gravite)
| DB Value | French UI Label | Description | Emoji |
|----------|----------------|-------------|-------|
| `MINEURE` | Mineure | Minor defect | ⚠️ |
| `MAJEURE` | Majeure | Major defect | 🔴 |
| `CRITIQUE` | Critique | Critical defect | 🚨 |

### 6.18 Maintenance Status (maintenance_orders.statut)
| DB Value | French UI Label | Description | Color |
|----------|----------------|-------------|-------|
| `PLANIFIE` | Planifie | Scheduled | muted |
| `EN_COURS` | En cours | In progress | orange |
| `TERMINE` | Termine | Completed | green |
| `ANNULE` | Annule | Cancelled | red |

### 6.19 Maintenance Type (maintenance_orders.type_maintenance)
| DB Value | French UI Label | Description | Icon |
|----------|----------------|-------------|------|
| `PREVENTIVE` | Preventif | Scheduled preventive | 🛡️ |
| `CORRECTIVE` | Correctif | Fix known issue | 🔧 |
| `URGENCE` | Urgence | Emergency repair | 🚨 |

### 6.20 Maintenance Priority (maintenance_orders.priorite)
| DB Value | French UI Label | Description |
|----------|----------------|-------------|
| `BASSE` | Basse | Low priority |
| `NORMAL` | Normal | Standard priority |
| `HAUTE` | Haute | High priority |
| `URGENTE` | Urgente | Emergency |

### 6.21 Supplier Status (fournisseurs.statut)
| DB Value | French UI Label | Description |
|----------|----------------|-------------|
| `ACTIF` | Actif | Active supplier |
| `INACTIF` | Inactif | Inactive |
| `BLACKLISTE` | Blackliste | Blocked from new orders |

### 6.22 Settings Groups (settings.groupe)
| DB Value | French UI Label | Description |
|----------|----------------|-------------|
| `societe` | Societe | Company information |
| `finance` | Finance | Financial settings |
| `workflow` | Workflow | Production workflow flags |
| `alertes` | Alertes | Thresholds and alerts |
| `pdf` | Documents | PDF generation settings |
| `acces` | Acces | Access control |
| `securite` | Securite | Security settings (2FA, session, PIN) |

### 6.23 Settings Types (settings.type)
| DB Value | Parse Rule |
|----------|-----------|
| `string` | Return valeur as-is |
| `boolean` | TRUE if value IN ('true', '1', 'yes', 'oui'), else FALSE |
| `number` | parseInt or parseFloat, NaN → 0 |

### 6.24 Activity Actions (activity_log_v2.action)
| DB Value | French UI Label | Icon | Color |
|----------|----------------|------|-------|
| `CREATE` | Cree | + | green |
| `UPDATE` | Modifie | ✏️ | orange |
| `DELETE` | Supprime | ✖️ | red |
| `LOGIN` | Connexion | 🔑 | blue |
| `LOGOUT` | Deconnexion | 🚪 | muted |
| `APPROVE` | Approuve | ✔️ | green |
| `REJECT` | Rejete | ✖️ | red |
| `PRINT` | Imprime | 🖨️ | muted |
| `EXPORT` | Exporte | 📤 | blue |
| `CONFIRM` | Confirme | ✔️ | green |
| `CANCEL` | Annule | ✖️ | red |
| `DEACTIVATE` | Desactive | ⏻ | muted |
| `PIN_RESET` | PIN reinitialise | 🔑 | orange |
| `LOGIN_FAILED` | Echec connexion | ⚠️ | red |

> **Rule:** Frontend MUST use DB values in all API calls. French labels are for display ONLY. No API endpoint accepts or returns French status values.

---

## 7. RBAC MATRIX — RESOURCE-BY-ACTION PERMISSIONS

> **Critical rule:** Every API endpoint enforces access control via middleware. The table below defines the MINIMUM role required for each action. "—*" means the user must own the resource (e.g., operator can update their own profile, but not others').

### 7.1 Authentication & Users
| Endpoint | ADMIN | MANAGER | OPERATOR | Notes |
|----------|-------|---------|----------|-------|
| POST `/api/auth/login` | — | — | — | Public |
| POST `/api/auth/verify-2fa` | — | — | — | Public (post-login) |
| POST `/api/auth/logout` | — | — | — | Public |
| GET `/api/auth/me` | —* | —* | —* | Own profile only |
| PUT `/api/auth/me/pin` | —* | —* | —* | Own PIN change |
| GET `/api/auth/sessions` | —* | —* | —* | Own sessions; ADMIN sees all |
| POST `/api/auth/sessions/:sid/revoke` | —* | —* | —* | Own sessions; ADMIN can revoke any |
| POST `/api/auth/users/:uid/reset-pin` | Yes | MANAGER only for OPERATOR | No | MANAGER cannot reset ADMIN/MANAGER PIN |
| GET `/api/auth/users` | Yes | No | No | Admin only |
| POST `/api/auth/users` | Yes | No | No | Admin only |
| PUT `/api/auth/users/:uid` | Yes | No | No | Admin only |
| DELETE `/api/auth/users/:uid` | Yes | No | No | Admin only |

### 7.2 Dashboard
| Endpoint | ADMIN | MANAGER | OPERATOR | Notes |
|----------|-------|---------|----------|-------|
| GET `/api/dashboard` | Yes | Yes | No | Manager stats |
| GET `/api/dashboard/operator/:operateur_id` | — | — | —* | Own stats only |

### 7.3 Production Orders (OF)
| Endpoint | ADMIN | MANAGER | OPERATOR | Notes |
|----------|-------|---------|----------|-------|
| GET `/api/of` | Yes | Yes | Yes | Read-only for operator |
| GET `/api/of/:of_id` | Yes | Yes | Yes | Read-only for operator |
| GET `/api/of/:of_id/fiche` | Yes | Yes | Yes | PDF generation |
| GET `/api/of/:of_id/dossier` | Yes | Yes | Yes | Full dossier |
| POST `/api/of` | No | Yes | No | Manager+ only |
| PUT `/api/of/:of_id` | Yes | Yes | Yes | Status advance only (DRAFT→APPROVED→IN_PROGRESS→COMPLETED) |
| PUT `/api/of/:of_id/full` | No | Yes | No | Full edit (manager+ only) |
| POST `/api/of/:of_id/duplicate` | No | Yes | No | Manager+ only |
| PUT `/api/of/:of_id/cancel` | Yes | Yes | Yes | Any authenticated user (ISO 9001: whoever discovers issue can cancel) |
| DELETE `/api/of/:of_id` | No | Yes | No | Manager+ only (hard delete) |
| GET `/api/of/:of_id/operations` | Yes | Yes | Yes | Read |
| POST `/api/of/:of_id/operations` | No | Yes | No | Manager+ only |
| PUT `/api/of/:of_id/operations/:op_id` | Yes | Yes | Yes | Status update (operation advance) |
| DELETE `/api/of/:of_id/operations/:op_id` | No | Yes | No | Manager+ only |
| GET `/api/of/:of_id/bom` | Yes | Yes | Yes | Read |
| PUT `/api/of/:of_id/bom` | No | Yes | No | Manager+ only |

### 7.4 Materials
| Endpoint | ADMIN | MANAGER | OPERATOR | Notes |
|----------|-------|---------|----------|-------|
| GET `/api/materiaux` | Yes | Yes | Yes | Read |
| POST `/api/materiaux` | No | Yes | No | Manager+ only |
| PUT `/api/materiaux/:mat_id` | No | Yes | No | Manager+ only |
| PUT `/api/materiaux/:mat_id/prix` | No | Yes | No | Manager+ only |
| GET `/api/materiaux/:mat_id/prix-historique` | Yes | Yes | Yes | Read |
| DELETE `/api/materiaux/:mat_id` | No | Yes | No | Manager+ only |
| POST `/api/materiaux/mouvement` | Yes | Yes | Yes | Any user can record movement |
| GET `/api/materiaux/mouvements` | Yes | Yes | Yes | Read |

### 7.5 Products
| Endpoint | ADMIN | MANAGER | OPERATOR | Notes |
|----------|-------|---------|----------|-------|
| GET `/api/produits` | Yes | Yes | Yes | Read |
| GET `/api/produits/:pid` | Yes | Yes | Yes | Read |
| POST `/api/produits` | No | Yes | No | Manager+ only |
| PUT `/api/produits/:pid` | No | Yes | No | Manager+ only |
| DELETE `/api/produits/:pid` | No | Yes | No | Manager+ only |
| PUT `/api/produits/:pid/prix` | No | Yes | No | Manager+ only |
| GET `/api/produits/:pid/prix-historique` | Yes | Yes | Yes | Read |
| GET `/api/produits/:pid/bom` | Yes | Yes | Yes | Read |
| POST `/api/produits/:pid/bom` | No | Yes | No | Manager+ only |
| PUT `/api/produits/:pid/bom` | No | Yes | No | Manager+ only |
| DELETE `/api/produits/:pid/bom/:mid` | No | Yes | No | Manager+ only |

### 7.6 Purchasing (DA, BC, BR, FA)
| Endpoint | ADMIN | MANAGER | OPERATOR | Notes |
|----------|-------|---------|----------|-------|
| GET `/api/achats/da` | Yes | Yes | Yes | Read |
| POST `/api/achats/da` | Yes | Yes | Yes | Any user can create DA |
| PUT `/api/achats/da/:da_id` | Yes | Yes | No | Approve/reject (manager+) |
| DELETE `/api/achats/da/:da_id` | No | Yes | No | Manager+ only |
| GET `/api/achats/da/:da_id/ba` | Yes | Yes | Yes | PDF |
| GET `/api/achats/bc` | Yes | Yes | Yes | Read |
| POST `/api/achats/bc` | No | Yes | No | Manager+ only |
| PUT `/api/achats/bc/:bc_id` | No | Yes | No | Manager+ only |
| DELETE `/api/achats/bc/:bc_id` | No | Yes | No | Manager+ only |
| GET `/api/achats/bc/:bc_id/pdf` | Yes | Yes | Yes | PDF |
| GET `/api/achats/br` | Yes | Yes | Yes | Read |
| POST `/api/achats/br` | No | Yes | No | Manager+ only |
| PUT `/api/achats/br/:br_id/confirmer` | No | Yes | No | Manager+ only (stock impact) |
| GET `/api/achats/br/:br_id/pdf` | Yes | Yes | Yes | PDF |
| GET `/api/achats/fa` | Yes | Yes | Yes | Read |
| POST `/api/achats/fa` | No | Yes | No | Manager+ only |
| PUT `/api/achats/fa/:fa_id` | No | Yes | No | Manager+ only |
| GET `/api/achats/fa/:fa_id/pdf` | Yes | Yes | Yes | PDF |

### 7.7 Delivery Notes (BL)
| Endpoint | ADMIN | MANAGER | OPERATOR | Notes |
|----------|-------|---------|----------|-------|
| GET `/api/bl` | Yes | Yes | Yes | Read |
| PUT `/api/bl/:bl_id/livrer` | No | Yes | No | Manager+ only (requires OF COMPLETED) |
| PUT `/api/bl/:bl_id` | No | Yes | No | Manager+ only |
| GET `/api/bl/:bl_id/pdf` | Yes | Yes | Yes | PDF |

### 7.8 Quality & Non-Conformities
| Endpoint | ADMIN | MANAGER | OPERATOR | Notes |
|----------|-------|---------|----------|-------|
| GET `/api/qualite/controles` | Yes | Yes | Yes | Read |
| POST `/api/qualite/controles` | Yes | Yes | Yes | Any user can create QC |
| PUT `/api/qualite/controles/:cq_id` | No | Yes | No | Manager+ only |
| GET `/api/qualite/nc` | Yes | Yes | Yes | Read |
| POST `/api/qualite/nc` | Yes | Yes | Yes | Any user can report NC |
| PUT `/api/qualite/nc/:nc_id` | No | Yes | No | Manager+ only (status change) |

### 7.9 Machines, Maintenance, Planning
| Endpoint | ADMIN | MANAGER | OPERATOR | Notes |
|----------|-------|---------|----------|-------|
| GET `/api/machines` | Yes | Yes | Yes | Read |
| POST `/api/machines` | No | Yes | No | Manager+ only |
| PUT `/api/machines/:mach_id` | No | Yes | No | Manager+ only |
| DELETE `/api/machines/:mach_id` | No | Yes | No | Manager+ only |
| GET `/api/maintenance` | Yes | Yes | Yes | Read |
| POST `/api/maintenance` | No | Yes | No | Manager+ only |
| PUT `/api/maintenance/:om_id` | No | Yes | No | Manager+ only |
| DELETE `/api/maintenance/:om_id` | No | Yes | No | Manager+ only |
| GET `/api/planning` | Yes | Yes | Yes | Read |
| POST `/api/planning` | No | Yes | No | Manager+ only |
| DELETE `/api/planning/:slot_id` | No | Yes | No | Manager+ only |
| GET `/api/planning/gantt` | No | Yes | No | Manager+ only |

### 7.10 Settings, Analytics, Reports
| Endpoint | ADMIN | MANAGER | OPERATOR | Notes |
|----------|-------|---------|----------|-------|
| GET `/api/settings` | Yes | Yes | Yes | Read |
| PUT `/api/settings/bulk` | Yes | No | No | Admin only |
| GET `/api/analytics/*` | Yes | Yes | Yes | All analytics read-only |
| GET `/api/rapports/*` | Yes | Yes | Yes | All reports read-only |
| GET `/api/notifications` | —* | —* | —* | Own notifications |
| GET `/api/notifications/activity` | Yes | Yes | No | Activity log (no operator) |

### 7.11 Operation Types, Clients, Operators, Suppliers
| Endpoint | ADMIN | MANAGER | OPERATOR | Notes |
|----------|-------|---------|----------|-------|
| GET `/api/operation-types` | Yes | Yes | Yes | Read |
| POST/PUT/DELETE `/api/operation-types/*` | No | Yes | No | Manager+ only |
| GET `/api/clients` | Yes | Yes | Yes | Read |
| POST/PUT/DELETE `/api/clients/*` | No | Yes | No | Manager+ only |
| GET `/api/operateurs` | Yes | Yes | Yes | Read |
| POST/PUT/DELETE `/api/operateurs/*` | No | Yes | No | Manager+ only |
| GET `/api/fournisseurs` | Yes | Yes | Yes | Read |
| POST/PUT/DELETE `/api/fournisseurs/*` | No | Yes | No | Manager+ only |

### 7.12 Health
| Endpoint | ADMIN | MANAGER | OPERATOR | Notes |
|----------|-------|---------|----------|-------|
| GET `/api/health` | — | — | — | Public |

---

## 8. ALL API ENDPOINTS

### Authentication
| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| POST | `/api/auth/login` | none | `{pin}` | `{role, nom, prenom, operateur_id, requires_2fa?, locked?, retry_after_seconds?}` + cookie |
| POST | `/api/auth/verify-2fa` | none | `{code, remember_device?}` | JWT cookie issued |
| POST | `/api/auth/logout` | none | - | `{message}` |
| GET | `/api/auth/me` | cookie | - | `{userId, role, nom, prenom, operateur_id, pin_must_change?}` |
| PUT | `/api/auth/me/pin` | user | `{old_pin?, new_pin}` | `{message}` |
| GET | `/api/auth/sessions` | user | - | `[{id, user_id, user_nom, created_at, last_activity, ip_address, user_agent, is_current}]` |
| POST | `/api/auth/sessions/:sid/revoke` | user | - | `{message}` |
| POST | `/api/auth/users/:uid/reset-pin` | admin/manager | `{new_pin, force_change?}` | `{message}` |
| GET | `/api/auth/users` | admin | - | `{data, total}` |
| POST | `/api/auth/users` | admin | `{nom, prenom, role, pin, operateur_id?, actif?}` | `{id, message}` |
| PUT | `/api/auth/users/:uid` | admin | `{nom?, prenom?, role?, pin?, actif?}` | `{message}` |
| DELETE | `/api/auth/users/:uid` | admin | - | `{message}` |

### Dashboard
| Method | Path | Response |
|--------|------|----------|
| GET | `/api/dashboard` | `{ordres_actifs, urgents, taux_completion, alertes_stock, en_retard, graphique}` |
| GET | `/api/dashboard/operator/:operateur_id` | `{mes_ofs_actifs, ofs_termines, performance}` |

### OFs
| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| GET | `/api/of` | any | query: limit, statut, priorite | `[OF objects]` |
| GET | `/api/of/:of_id` | any | - | `{OF object}` |
| POST | `/api/of` | manager+ | `OFCreate` | `{numero, bl_numero, das_crees}` |
| PUT | `/api/of/:of_id` | any | `OFUpdate` | - |
| PUT | `/api/of/:of_id/full` | manager+ | `OFCreate` (full) | - |
| POST | `/api/of/:of_id/duplicate` | manager+ | `{quantite, priorite, date_echeance, ...}` | `{numero}` |
| PUT | `/api/of/:of_id/cancel` | user | `{reason}` | `{message, warnings?, suggest_nc?}` |
| DELETE | `/api/of/:of_id` | user | `{reason?}` | - |
| GET | `/api/of/:of_id/fiche` | pdf-user | - | PDF blob |
| GET | `/api/of/:of_id/dossier` | any | - | Full dossier object |

### OF Operations
| Method | Path | Auth | Request |
|--------|------|------|---------|
| GET | `/api/of/:of_id/operations` | any | - |
| POST | `/api/of/:of_id/operations` | manager+ | `OperationCreate` |
| PUT | `/api/of/:of_id/operations/:op_id` | any | `OperationUpdate` |
| DELETE | `/api/of/:of_id/operations/:op_id` | manager+ | - |

### OF BOM
| Method | Path | Auth | Request |
|--------|------|------|---------|
| GET | `/api/of/:of_id/bom` | any | - |
| PUT | `/api/of/:of_id/bom` | manager+ | `BOMOverride[]` |

### Materials
| Method | Path | Auth | Request |
|--------|------|------|---------|
| GET | `/api/materiaux` | any | - |
| POST | `/api/materiaux` | manager+ | `MateriauCreate` |
| PUT | `/api/materiaux/:mat_id` | manager+ | `MateriauUpdate` |
| PUT | `/api/materiaux/:mat_id/prix` | manager+ | - |
| GET | `/api/materiaux/:mat_id/prix-historique` | any | - |
| DELETE | `/api/materiaux/:mat_id` | manager+ | `{reason?}` |
| POST | `/api/materiaux/mouvement` | any | `MouvementCreate` |
| GET | `/api/materiaux/mouvements` | any | query: limit |

### Products
| Method | Path | Auth | Request |
|--------|------|------|---------|
| GET | `/api/produits` | any | - |
| GET | `/api/produits/:pid` | any | - |
| POST | `/api/produits` | manager+ | `ProduitCreate` |
| PUT | `/api/produits/:pid` | manager+ | `ProduitUpdate` |
| DELETE | `/api/produits/:pid` | manager+ | - |
| PUT | `/api/produits/:pid/prix` | manager+ | - |
| GET | `/api/produits/:pid/prix-historique` | any | - |
| GET | `/api/produits/:pid/bom` | any | - |
| POST | `/api/produits/:pid/bom` | manager+ | `BOMLine` |
| PUT | `/api/produits/:pid/bom` | manager+ | `BOMLine[]` |
| DELETE | `/api/produits/:pid/bom/:mid` | manager+ | - |

### Operators, Clients, Suppliers, Operation Types, Machines, Maintenance, Planning, Quality, NCs, DA, BC, BR, FA, BL, Invoices, Notifications, Analytics, Reports, Settings - all follow same patterns as documented in features section above.

### Health
| Method | Path | Response |
|--------|------|----------|
| GET | `/api/health` | `{status: "ok"\|"degraded", dbConnected: bool}` |

### 8.1 API Design Standards

#### 8.1.1 Standardized Error Response Format
All API errors MUST return the following JSON structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Le champ 'quantite' est requis",
    "details": [
      { "field": "quantite", "issue": "required" }
    ],
    "request_id": "req_abc123"
  }
}
```

**Error codes:** `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`.
**HTTP status mapping:** 400 (validation), 401 (unauthorized), 403 (forbidden), 404 (not found), 409 (conflict), 429 (rate limited), 500 (internal), 503 (degraded).

#### 8.1.2 Pagination (ALL list endpoints)
All list endpoints support cursor/offset pagination via query parameters:

```
GET /api/of?limit=50&offset=0&sort=created_at&order=DESC
GET /api/materiaux?limit=100&offset=0&sort=nom&order=ASC
```

**Response envelope for list endpoints:**
```json
{
  "data": [...],
  "pagination": {
    "total": 1234,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

**Default pagination:** limit=50 (max 500). Offset-based for simplicity; cursor-based pagination can be added later for very large datasets.

#### 8.1.3 Server-Side Filtering & Sorting
Filters and sorting are applied server-side, NOT client-side:

**Query parameters:**
- `sort` — field name to sort by (e.g., `created_at`, `nom`, `date_echeance`)
- `order` — `ASC` or `DESC`
- `search` — full-text search across relevant fields (OF number, product name, client name)
- Filters per resource (examples):
  - `/api/of?statut=IN_PROGRESS&priorite=URGENT&date_from=2026-01-01`
  - `/api/materiaux?stock_below_minimum=true&fournisseur=SOFEM`
  - `/api/achats/da?statut=PENDING&urgence=URGENT`

**Search implementation:** Use `ILIKE '%search%'` across multiple columns with `OR`, or use PostgreSQL full-text search (`tsvector`) for better performance on large datasets.

#### 8.1.4 ETag / Caching Headers
All GET responses include caching headers:

```
ETag: "abc123def456"
Cache-Control: no-cache (for dynamic data)
Last-Modified: Sun, 12 Apr 2026 10:30:00 GMT
```

**Conditional requests:** Client sends `If-None-Match: "abc123def456"`. Server returns `304 Not Modified` if data unchanged.
**Implementation:** ETag is MD5 hash of JSON response body. Computed on every GET, compared against `If-None-Match` header.

#### 8.1.5 Rate Limiting
- **Login endpoint:** 5 attempts per 5 minutes per IP (see section 5.29.2)
- **API general:** 100 requests per minute per authenticated user
- **PDF generation:** 10 requests per minute per user
- **Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`
- **Implementation:** Sliding window counter stored in memory (or Redis if available)

#### 8.1.6 Request ID Tracking
Every request gets a unique `X-Request-ID` header (UUID v4). If client sends one, use it. This ID is logged in activity_log_v2 and structured logs for debugging.

#### 8.1.7 Security Headers on All Responses
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000 (production only)
Content-Security-Policy: default-src 'self' (frontend HTML pages)
X-Request-ID: <uuid>
```

---

## 9. DATABASE - COMPLETE SCHEMA

### 9.1 Numbering System

The `document_sequences` table provides auto-incrementing document numbers per year:

```sql
CREATE TABLE document_sequences (
  prefix VARCHAR(20) NOT NULL,
  year SMALLINT NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (prefix, year)
);
```

Prefixes used: OF, DA, BC, BR, BL, CLT, FOURN, MCH, SOFEM, CQ, NC, OM.
Number format: `{PREFIX}-{YEAR}-{sequence padded}` (e.g., `OF-2026-0001`).
The `nextSeq()` function: `INSERT ... ON CONFLICT DO UPDATE SET last_seq = last_seq + 1 RETURNING last_seq`.
The `finalizeNumber()` function: gets next sequence, formats number, UPDATEs the row.
The `nextCode()` function: same as nextSeq but returns the formatted code string.

> **Simplification note:** Consider a unified document numbering scheme (`DOC-YYYY-TYPE-NNNN` where TYPE=OF/DA/BC/etc.) for easier cross-document referencing. Current multi-prefix approach is retained for backward compatibility but future versions should evaluate consolidation.

### 7.2 users

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  nom VARCHAR NOT NULL,
  prenom VARCHAR NOT NULL,
  role VARCHAR NOT NULL,  -- 'ADMIN', 'MANAGER', 'OPERATOR'
  pin_hash VARCHAR NOT NULL,  -- bcrypt (migrated from SHA-256)
  operateur_id INT REFERENCES operateurs(id),  -- nullable
  actif BOOLEAN DEFAULT TRUE,
  pin_must_change BOOLEAN DEFAULT FALSE,
  totp_secret VARCHAR,  -- encrypted TOTP secret for 2FA
  totp_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

> **PIN length note:** The default PIN length is 4 digits for backward compatibility, but the system supports configurable PIN length via the `pin_min_length` setting (recommended minimum: 4, maximum: 8). New installations should default to 6 digits.

**Indexes:** None explicitly defined (PK on id is implicit).
**Relationships:** operateur_id -> operateurs.id (nullable, one-to-many from operateurs side).
**Auth flow:** PIN login iterates all active users, compares with bcrypt (or legacy SHA-256), auto-migrates legacy hashes on first successful login.

### 7.3 clients

```sql
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  code VARCHAR UNIQUE,  -- auto: CLT-YYYY-N
  nom VARCHAR NOT NULL,
  matricule_fiscal VARCHAR,  -- nullable
  telephone VARCHAR,
  email VARCHAR,
  adresse VARCHAR,
  ville VARCHAR,
  notes TEXT,
  actif BOOLEAN DEFAULT TRUE,
  deactivated_by INT REFERENCES users(id),  -- nullable
  deactivated_at TIMESTAMP,
  deactivation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on code, PK on id.
**Relationships:** Referenced by ordres_fabrication.client_id (one-to-many).
**Soft delete:** actif=FALSE with tracking (deactivated_by, deactivated_at, deactivation_reason).
**Deactivation guard:** cannot deactivate if client has active OFs (statut NOT IN ('COMPLETED','CANCELLED')).

### 7.4 operateurs

```sql
CREATE TABLE operateurs (
  id SERIAL PRIMARY KEY,
  nom VARCHAR NOT NULL,
  prenom VARCHAR NOT NULL,
  specialite VARCHAR NOT NULL,
  role VARCHAR DEFAULT 'OPERATEUR',  -- 'OPERATEUR', 'CHEF_ATELIER', 'RESPONSABLE', 'TECHNICIEN'
  telephone VARCHAR,
  email VARCHAR,
  taux_horaire DECIMAL(8,2) DEFAULT 0,
  taux_piece DECIMAL(8,2) DEFAULT 0,
  type_taux VARCHAR DEFAULT 'HORAIRE',  -- 'HORAIRE', 'PIECE', 'BOTH'
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** PK on id. No explicit unique constraints (duplicate names allowed).
**Relationships:** Referenced by users.operateur_id, ordres_fabrication.chef_projet_id, of_operations (via op_operateurs join table), controle_qualite.operateur_id, non_conformites.responsable_id, planning_slots.operateur_id, maintenance_orders.technicien_id, demandes_achat.demandeur_id.
**Soft delete:** actif=FALSE.

### 7.5 produits

```sql
CREATE TABLE produits (
  id SERIAL PRIMARY KEY,
  code VARCHAR UNIQUE,  -- auto: SOFEM-YYYY-N
  nom VARCHAR NOT NULL,
  description TEXT,
  unite VARCHAR DEFAULT 'pcs',
  prix_vente_ht DECIMAL(10,2) DEFAULT 0,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on code, PK on id.
**Relationships:** Referenced by ordres_fabrication.produit_id (one-to-many), bom.produit_id (one-to-many).
**Soft delete:** actif=FALSE.
> **Cascade note:** When a product is soft-deleted, its BOM lines remain in the `bom` table (no CASCADE delete). However, any new OF referencing a soft-deleted product should be blocked by application-level validation. Existing OFs with soft-deleted products remain accessible for historical/audit purposes.

### 9.6 bom (Product Bill of Materials)

```sql
CREATE TABLE bom (
  produit_id INT NOT NULL REFERENCES produits(id),
  materiau_id INT NOT NULL REFERENCES materiaux(id),
  quantite_par_unite DECIMAL(8,3) NOT NULL,
  PRIMARY KEY (produit_id, materiau_id)
);
```

**Indexes:** Composite PK (produit_id, materiau_id), implicit indexes on both FK columns.
**Relationships:** produit_id -> produits.id, materiau_id -> materiaux.id. Many-to-many between produits and materiaux.
**Operations:** INSERT ON CONFLICT DO UPDATE (upsert) for individual lines. DELETE + batch INSERT for full replace.

### 7.7 materiaux

```sql
CREATE TABLE materiaux (
  id SERIAL PRIMARY KEY,
  code VARCHAR UNIQUE,  -- auto: MAT-YYYY-N
  nom VARCHAR NOT NULL,
  unite VARCHAR NOT NULL,
  stock_actuel DECIMAL(10,2) DEFAULT 0,
  stock_minimum DECIMAL(10,2) DEFAULT 0,
  fournisseur VARCHAR,  -- supplier name (free text)
  prix_unitaire DECIMAL(10,2) DEFAULT 0,
  actif BOOLEAN DEFAULT TRUE,
  deactivated_by INT REFERENCES users(id),
  deactivated_at TIMESTAMP,
  deactivation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on code, PK on id.
**Relationships:** Referenced by bom.materiau_id, of_bom.materiau_id, mouvements_stock.materiau_id, demandes_achat.materiau_id, bc_lignes.materiau_id (via JSONB).
**Computed fields (in queries):** alerte = (stock_actuel < stock_minimum), pct_stock = CASE WHEN stock_minimum > 0 THEN stock_actuel/stock_minimum*100 ELSE 100 END.
**Soft delete:** actif=FALSE.

### 9.8 mouvements_stock (single movement table)

> **Simplification note:** Only ONE movement table exists (`mouvements_stock`). The alias `materiaux_mouvements` is NOT a separate table — it was a naming inconsistency in earlier drafts. All stock movements use this single table.

```sql
CREATE TABLE mouvements_stock (
  id BIGSERIAL PRIMARY KEY,
  materiau_id INT NOT NULL REFERENCES materiaux(id),
  of_id INT REFERENCES ordres_fabrication(id),  -- nullable
  type VARCHAR NOT NULL,  -- 'ENTREE', 'SORTIE', 'ADJUST'
  quantite DECIMAL(10,2) NOT NULL,
  stock_avant DECIMAL(10,2) NOT NULL,
  stock_apres DECIMAL(10,2) NOT NULL,
  motif TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** PK on id, implicit indexes on materiau_id and of_id FKs.
**Relationships:** materiau_id -> materiaux.id, of_id -> ordres_fabrication.id (nullable).
**Trigger-like behavior:** Created automatically when BR is confirmed (ENTREE type) or when stock movement is manually recorded. Stock_actuel on materiaux is updated in the same transaction.

### 9.9 ordres_fabrication (OFs)

```sql
CREATE TABLE ordres_fabrication (
  id SERIAL PRIMARY KEY,
  numero VARCHAR UNIQUE,  -- auto: OF-YYYY-N
  produit_id INT NOT NULL REFERENCES produits(id),
  quantite INT NOT NULL,
  priorite VARCHAR DEFAULT 'NORMAL',  -- 'URGENT', 'HIGH', 'NORMAL', 'LOW'
  statut VARCHAR DEFAULT 'DRAFT',  -- 'DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
  client_id INT REFERENCES clients(id),  -- nullable
  chef_projet_id INT REFERENCES operateurs(id),  -- nullable
  atelier VARCHAR DEFAULT 'Atelier A',
  date_echeance DATE NOT NULL,
  plan_numero VARCHAR,
  notes TEXT,
  cout_matieres DECIMAL(12,2) DEFAULT 0,
  cout_main_oeuvre DECIMAL(12,2) DEFAULT 0,
  cout_revient DECIMAL(12,2) DEFAULT 0,
  cancel_reason TEXT,
  cancelled_by INT REFERENCES users(id),
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on numero, PK on id, implicit indexes on produit_id, client_id, chef_projet_id.
**Relationships:** produit_id -> produits.id, client_id -> clients.id, chef_projet_id -> operateurs.id. Referenced by of_operations.of_id (one-to-many), of_bom.of_id, bons_livraison.of_id, demandes_achat.of_id, planning_slots.of_id, controle_qualite.of_id, non_conformites.of_id.
**Soft cancel:** statut='CANCELLED' with cancel_reason, cancelled_by, cancelled_at tracking.
**Auto-status sync:** When operations change, syncOfStatus() recalculates: all COMPLETED -> OF=COMPLETED; any IN_PROGRESS or any COMPLETED -> OF=IN_PROGRESS; else OF=APPROVED.

### 7.10 of_operations

```sql
CREATE TABLE of_operations (
  id SERIAL PRIMARY KEY,
  of_id INT NOT NULL REFERENCES ordres_fabrication(id),
  operation_nom VARCHAR NOT NULL,
  machine_id INT REFERENCES machines(id),  -- nullable (join to machines for current name)
  ordre INT,  -- sequence order
  statut VARCHAR DEFAULT 'PENDING',  -- 'PENDING', 'IN_PROGRESS', 'COMPLETED'
  duree_prevue INT,  -- nullable, minutes
  duree_reelle INT,  -- nullable, minutes
  debut TIMESTAMP,
  fin TIMESTAMP,
  notes TEXT
);
```

**Indexes:** PK on id, implicit index on of_id FK and machine_id FK.
**Relationships:** of_id -> ordres_fabrication.id (one-to-many), machine_id -> machines.id (nullable).
**Join table:** op_operateurs (operation_id, operateur_id) links operations to operators.
**Ordering constraints:** Cannot start operation N until operations 0..N-1 are COMPLETED. Only ONE operation IN_PROGRESS at a time.
**Auto-timestamps:** When statut changes to IN_PROGRESS: debut = COALESCE(debut, NOW()), fin = NULL. When COMPLETED: debut = COALESCE(debut, NOW()), fin = NOW(). When PENDING: debut = NULL, fin = NULL.

### 9.11 op_operateurs (Operation-Operator assignment join table)

```sql
CREATE TABLE op_operateurs (
  operation_id INT NOT NULL REFERENCES of_operations(id),
  operateur_id INT NOT NULL REFERENCES operateurs(id),
  PRIMARY KEY (operation_id, operateur_id)
);
```

**Indexes:** Composite PK on (operation_id, operateur_id).
**Relationships:** Many-to-many between of_operations and operateurs.
**Query pattern:** STRING_AGG(DISTINCT CONCAT(prenom, ' ', nom), ', ') to get operator names per operation.

### 9.12 of_bom (OF BOM overrides)

```sql
CREATE TABLE of_bom (
  of_id INT NOT NULL REFERENCES ordres_fabrication(id),
  materiau_id INT NOT NULL REFERENCES materiaux(id),
  quantite_requise DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (of_id, materiau_id)
);
```

**Indexes:** Composite PK (of_id, materiau_id).
**Relationships:** of_id -> ordres_fabrication.id, materiau_id -> materiaux.id.
**Purpose:** Override default BOM quantities from product for specific OFs. When empty, uses product's bom table.

### 7.13 bons_livraison

```sql
CREATE TABLE bons_livraison (
  id SERIAL PRIMARY KEY,
  numero VARCHAR UNIQUE,  -- auto: BL-YYYY-N
  of_id INT NOT NULL REFERENCES ordres_fabrication(id),
  statut VARCHAR DEFAULT 'EMIS',  -- 'EMIS', 'LIVRE', 'CANCELLED'
  destinataire VARCHAR DEFAULT 'SOFEM',
  adresse VARCHAR DEFAULT 'Route Sidi Salem 2.5KM, Sfax',
  date_livraison DATE,
  date_livraison_reelle DATE,
  notes TEXT,
  cancel_reason TEXT,
  cancelled_by INT REFERENCES users(id),
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on numero, PK on id, implicit index on of_id FK.
**Relationships:** of_id -> ordres_fabrication.id (one-to-one, one BL per OF).
**Auto-creation:** When OF created with bl_auto_creation=true.
**Delivery gate:** Can only deliver when OF statut = 'COMPLETED'.

### 7.14 demandes_achat

```sql
CREATE TABLE demandes_achat (
  id SERIAL PRIMARY KEY,
  da_numero VARCHAR UNIQUE,  -- auto: DA-YYYY-N
  description TEXT NOT NULL,
  materiau_id INT REFERENCES materiaux(id),  -- nullable
  of_id INT REFERENCES ordres_fabrication(id),  -- nullable
  objet VARCHAR,
  quantite DECIMAL(10,2) NOT NULL,
  unite VARCHAR DEFAULT 'pcs',
  urgence VARCHAR DEFAULT 'NORMAL',  -- 'NORMAL', 'URGENT'
  demandeur_id INT REFERENCES operateurs(id),  -- nullable
  statut VARCHAR DEFAULT 'PENDING',  -- 'PENDING', 'APPROVED', 'REJECTED', 'ORDERED', 'RECEIVED', 'CANCELLED'
  valideur_id INT REFERENCES users(id),  -- nullable
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on da_numero, PK on id, implicit indexes on materiau_id, of_id, demandeur_id, valideur_id.
**Relationships:** materiau_id -> materiaux.id, of_id -> ordres_fabrication.id, demandeur_id -> operateurs.id, valideur_id -> users.id. Referenced by bons_commande.da_id.
**Auto-creation:** When OF created with insufficient stock and stock_deduction_auto=true.
**Auto-approval:** When amount below da_auto_approve_seuil setting.

### 7.15 bons_commande

```sql
CREATE TABLE bons_commande (
  id SERIAL PRIMARY KEY,
  bc_numero VARCHAR UNIQUE,  -- auto: BC-YYYY-N
  fournisseur VARCHAR NOT NULL,
  da_id INT REFERENCES demandes_achat(id),  -- nullable
  statut VARCHAR DEFAULT 'DRAFT',  -- 'DRAFT', 'ENVOYE', 'RECU', 'ANNULE', 'RECU_PARTIEL'
  notes TEXT,
  montant_ht DECIMAL(12,2) DEFAULT 0,
  montant_ttc DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on bc_numero, PK on id, implicit index on da_id FK.
**Relationships:** da_id -> demandes_achat.id (nullable). fournisseur is free text (matched by ILIKE in queries). Referenced by bons_reception.bc_id, factures_achat.bc_id.
**Line items:** Stored in `bc_lignes` table (see section 9.16). The old `lignes JSONB` column has been **removed** to eliminate dual source of truth. `bc_lignes` is the single source of truth for BC line items.

> **Resolution note:** The original spec had BOTH `lignes JSONB` on bons_commande AND a separate `bc_lignes` table. This created drift risk. The JSONB column is removed; `bc_lignes` is the authoritative source. If JSONB is needed for PDF generation or API responses, it is computed on-read via `json_agg` from `bc_lignes`, never stored.

### 9.16 bc_lignes (BC line items)

```sql
CREATE TABLE bc_lignes (
  id SERIAL PRIMARY KEY,
  bc_id INT NOT NULL REFERENCES bons_commande(id),
  materiau_id INT REFERENCES materiaux(id),
  description TEXT,
  quantite DECIMAL(10,2) NOT NULL,
  unite VARCHAR DEFAULT 'pcs',
  prix_unitaire DECIMAL(10,2) DEFAULT 0
);
```

**Indexes:** PK on id, implicit indexes on bc_id and materiau_id.
**Relationships:** bc_id -> bons_commande.id, materiau_id -> materiaux.id. Referenced by br_lignes.bc_ligne_id.

### 7.17 bons_reception

```sql
CREATE TABLE bons_reception (
  id SERIAL PRIMARY KEY,
  br_numero VARCHAR UNIQUE,  -- auto: BR-YYYY-N
  bc_id INT NOT NULL REFERENCES bons_commande(id),
  statut VARCHAR DEFAULT 'EN_ATTENTE',  -- 'EN_ATTENTE', 'COMPLET', 'PARTIEL', 'ANNULE'
  date_reception DATE NOT NULL,
  notes TEXT,
  quantite_recue DECIMAL(10,2),
  quantite_commandee DECIMAL(10,2),
  unite VARCHAR,
  montant_total DECIMAL(12,2),
  fournisseur VARCHAR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on br_numero, PK on id, implicit index on bc_id FK.
**Relationships:** bc_id -> bons_commande.id. Referenced by br_lignes.bc_ligne_id (via join).
**Stock trigger on confirmation:** Updates materiaux.stock_actuel += quantite_recue, creates ENTREE movement.

### 9.18 br_lignes (BR line items)

```sql
CREATE TABLE br_lignes (
  id SERIAL PRIMARY KEY,
  bc_ligne_id INT NOT NULL REFERENCES bc_lignes(id),
  quantite_recue DECIMAL(10,2) NOT NULL,
  prix_unitaire DECIMAL(10,2) DEFAULT 0
);
```

**Indexes:** PK on id, implicit index on bc_ligne_id FK.
**Relationships:** bc_ligne_id -> bc_lignes.id.

### 7.19 factures_achat

```sql
CREATE TABLE factures_achat (
  id SERIAL PRIMARY KEY,
  fa_numero VARCHAR UNIQUE,  -- auto: FA-YYYY-N
  bc_id INT REFERENCES bons_commande(id),  -- nullable
  of_id INT REFERENCES ordres_fabrication(id),  -- nullable
  fournisseur VARCHAR,
  date_facture DATE NOT NULL,
  montant_ht DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on fa_numero, PK on id, implicit indexes on bc_id, of_id.

### 7.20 machines

```sql
CREATE TABLE machines (
  id SERIAL PRIMARY KEY,
  code VARCHAR UNIQUE,  -- auto: MCH-YYYY-N
  nom VARCHAR NOT NULL,
  type VARCHAR,
  atelier VARCHAR DEFAULT 'Atelier A',
  marque VARCHAR,
  modele VARCHAR,
  numero_serie VARCHAR,
  statut VARCHAR DEFAULT 'OPERATIONNELLE',  -- 'OPERATIONNELLE', 'EN_MAINTENANCE', 'EN_PANNE', 'ARRETEE'
  date_acquisition DATE,
  notes TEXT,
  actif BOOLEAN DEFAULT TRUE,
  deactivated_by INT REFERENCES users(id),
  deactivated_at TIMESTAMP,
  deactivation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on code, PK on id.
**Relationships:** Referenced by of_operations.machine_id, planning_slots.machine_id, maintenance_orders.machine_id.
**Soft delete:** actif=FALSE.

### 7.21 maintenance_orders

```sql
CREATE TABLE maintenance_orders (
  id SERIAL PRIMARY KEY,
  om_numero VARCHAR UNIQUE,  -- auto: OM-YYYY-N
  titre VARCHAR NOT NULL,
  machine_id INT NOT NULL REFERENCES machines(id),
  type_maintenance VARCHAR DEFAULT 'CORRECTIVE',  -- 'PREVENTIVE', 'CORRECTIVE', 'URGENCE'
  priorite VARCHAR DEFAULT 'NORMAL',
  statut VARCHAR DEFAULT 'PLANIFIE',  -- 'PLANIFIE', 'EN_COURS', 'TERMINE', 'ANNULE'
  technicien_id INT REFERENCES operateurs(id),  -- nullable
  date_planifiee DATE,
  date_debut TIMESTAMP,
  date_fin TIMESTAMP,
  duree_estimee INT DEFAULT 0,
  cout_estime DECIMAL(10,2) DEFAULT 0,
  cout_reel DECIMAL(10,2) DEFAULT 0,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on om_numero, PK on id, implicit indexes on machine_id, technicien_id.
**Relationships:** machine_id -> machines.id, technicien_id -> operateurs.id.

### 7.22 planning_slots

```sql
CREATE TABLE planning_slots (
  id SERIAL PRIMARY KEY,
  of_id INT NOT NULL REFERENCES ordres_fabrication(id),
  machine_id INT REFERENCES machines(id),  -- nullable
  operateur_id INT REFERENCES operateurs(id),  -- nullable
  date_debut TIMESTAMP NOT NULL,
  date_fin TIMESTAMP NOT NULL,
  statut VARCHAR DEFAULT 'PLANIFIE',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** PK on id, implicit indexes on of_id, machine_id, operateur_id.
**Relationships:** of_id -> ordres_fabrication.id, machine_id -> machines.id, operateur_id -> operateurs.id.

### 7.23 controle_qualite

```sql
CREATE TABLE controle_qualite (
  id SERIAL PRIMARY KEY,
  cq_numero VARCHAR UNIQUE,  -- auto: CQ-YYYY-N
  of_id INT REFERENCES ordres_fabrication(id),  -- nullable
  type_controle VARCHAR DEFAULT 'FINAL',
  operateur_id INT REFERENCES operateurs(id),  -- nullable
  date_controle DATE NOT NULL,
  statut VARCHAR DEFAULT 'EN_ATTENTE',  -- 'EN_ATTENTE', 'CONFORME', 'NON_CONFORME', 'EN_COURS'
  quantite_controlee DECIMAL(10,2) DEFAULT 0,
  quantite_conforme DECIMAL(10,2) DEFAULT 0,
  quantite_rebut DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on cq_numero, PK on id, implicit indexes on of_id, operateur_id.
**Relationships:** of_id -> ordres_fabrication.id, operateur_id -> operateurs.id. Referenced by non_conformites.cq_id.
**Auto-derivation:** statut derived from quantities on save: rebut>0 OR conforme<controlee -> NON_CONFORME; conforme==controlee AND total>0 -> CONFORME; else EN_ATTENTE.

### 7.24 non_conformites

```sql
CREATE TABLE non_conformites (
  id SERIAL PRIMARY KEY,
  nc_numero VARCHAR UNIQUE,  -- auto: NC-YYYY-N
  cq_id INT REFERENCES controle_qualite(id),  -- nullable
  of_id INT REFERENCES ordres_fabrication(id),  -- nullable
  type_defaut VARCHAR NOT NULL,
  description TEXT,
  gravite VARCHAR DEFAULT 'MINEURE',  -- 'MINEURE', 'MAJEURE', 'CRITIQUE'
  statut VARCHAR DEFAULT 'OUVERTE',  -- 'OUVERTE', 'EN_COURS', 'CLOTUREE'
  action_corrective TEXT,
  responsable_id INT REFERENCES operateurs(id),  -- nullable
  date_cloture DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on nc_numero, PK on id, implicit indexes on cq_id, of_id, responsable_id.
**Relationships:** cq_id -> controle_qualite.id (nullable), of_id -> ordres_fabrication.id (nullable), responsable_id -> operateurs.id (nullable).

### 7.25 fournisseurs

```sql
CREATE TABLE fournisseurs (
  id SERIAL PRIMARY KEY,
  code VARCHAR UNIQUE,  -- auto: FOURN-YYYY-N
  nom VARCHAR NOT NULL,
  contact VARCHAR,
  telephone VARCHAR,
  email VARCHAR,
  adresse TEXT,
  ville VARCHAR,
  pays VARCHAR DEFAULT 'Tunisie',
  matricule_fiscal VARCHAR,
  statut VARCHAR DEFAULT 'ACTIF',  -- 'ACTIF', 'INACTIF', 'BLACKLISTE'
  notes TEXT,
  actif BOOLEAN DEFAULT TRUE,
  deactivated_by INT REFERENCES users(id),
  deactivated_at TIMESTAMP,
  deactivation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on code, PK on id.
**Soft delete:** actif=FALSE with tracking.
**Join table:** materiau_fournisseurs (fournisseur_id, materiau_id, prix_unitaire, delai_jours, principal).

### 7.26 operation_types

```sql
CREATE TABLE operation_types (
  id SERIAL PRIMARY KEY,
  nom VARCHAR NOT NULL UNIQUE,
  description TEXT,
  ordre INT DEFAULT 0,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on nom, PK on id.
**Soft delete:** actif=FALSE when used in OFs, hard DELETE when not used.

### 7.27 settings

```sql
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  groupe VARCHAR NOT NULL,
  cle VARCHAR NOT NULL UNIQUE,
  valeur TEXT,
  type VARCHAR DEFAULT 'string',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:** UNIQUE on cle, PK on id, implicit index on groupe.
**Groups:** societe, finance, workflow, alertes, pdf, acces.
**Value types:** string (default), boolean (parsed: true/1/yes), number (parsed: parseInt/parseFloat).
**Storage:** TEXT column, parsed to appropriate type at read time.

### 7.28 activity_log_v2

```sql
CREATE TABLE activity_log_v2 (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id INT,
  user_nom VARCHAR(100),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT,
  entity_numero VARCHAR(50),
  old_value JSONB,
  new_value JSONB,
  reason VARCHAR(500),
  ip_address VARCHAR(45),
  session_token VARCHAR(20),
  detail TEXT
);
```

**Indexes:**
- idx_activity_v2_entity ON activity_log_v2 (entity_type, entity_id)
- idx_activity_v2_user ON activity_log_v2 (user_id)
- idx_activity_v2_action ON activity_log_v2 (action)
- idx_activity_v2_created ON activity_log_v2 (created_at)
- idx_activity_v2_numero ON activity_log_v2 (entity_numero)

**Actions:** CREATE, UPDATE, DELETE, LOGIN, LOGOUT, APPROVE, REJECT, PRINT, EXPORT, CONFIRM, CANCEL, DEACTIVATE.
**Serialization:** Dates converted to ISO strings, arrays and objects recursively serialized before JSONB insert.

### 9.29 Additional Tables (inferred from queries)

**materiau_fournisseurs** (supplier-material relationship):
```sql
CREATE TABLE materiau_fournisseurs (
  fournisseur_id INT REFERENCES fournisseurs(id),
  materiau_id INT REFERENCES materiaux(id),
  prix_unitaire DECIMAL(10,2),
  delai_jours INT,
  principal BOOLEAN,
  PRIMARY KEY (fournisseur_id, materiau_id)
);
```

### 9.30 Database Design Enhancements

#### 7.30.1 Explicit Foreign Key Indexes
All foreign keys that are currently marked as "implicit indexes" in the spec above **MUST have explicit indexes created**. PostgreSQL does NOT automatically create indexes on FK columns (only on PK and UNIQUE constraints). Missing FK indexes cause sequential scans on every JOIN.

```sql
-- Required FK indexes (add for EVERY foreign key column)
CREATE INDEX idx_of_produit_id ON ordres_fabrication(produit_id);
CREATE INDEX idx_of_client_id ON ordres_fabrication(client_id);
CREATE INDEX idx_of_chef_projet_id ON ordres_fabrication(chef_projet_id);
CREATE INDEX idx_of_operations_of_id ON of_operations(of_id);
CREATE INDEX idx_of_operations_machine_id ON of_operations(machine_id);
CREATE INDEX idx_op_operateurs_operation_id ON op_operateurs(operation_id);
CREATE INDEX idx_op_operateurs_operateur_id ON op_operateurs(operateur_id);
CREATE INDEX idx_of_bom_of_id ON of_bom(of_id);
CREATE INDEX idx_of_bom_materiau_id ON of_bom(materiau_id);
CREATE INDEX idx_bom_produit_id ON bom(produit_id);
CREATE INDEX idx_bom_materiau_id ON bom(materiau_id);
CREATE INDEX idx_bl_of_id ON bons_livraison(of_id);
CREATE INDEX idx_da_materiau_id ON demandes_achat(materiau_id);
CREATE INDEX idx_da_of_id ON demandes_achat(of_id);
CREATE INDEX idx_da_demandeur_id ON demandes_achat(demandeur_id);
CREATE INDEX idx_da_valideur_id ON demandes_achat(valideur_id);
CREATE INDEX idx_bc_da_id ON bons_commande(da_id);
CREATE INDEX idx_bc_lignes_bc_id ON bc_lignes(bc_id);
CREATE INDEX idx_bc_lignes_materiau_id ON bc_lignes(materiau_id);
CREATE INDEX idx_br_bc_id ON bons_reception(bc_id);
CREATE INDEX idx_br_lignes_bc_ligne_id ON br_lignes(bc_ligne_id);
CREATE INDEX idx_fa_bc_id ON factures_achat(bc_id);
CREATE INDEX idx_fa_of_id ON factures_achat(of_id);
CREATE INDEX idx_maintenance_machine_id ON maintenance_orders(machine_id);
CREATE INDEX idx_maintenance_technicien_id ON maintenance_orders(technicien_id);
CREATE INDEX idx_planning_of_id ON planning_slots(of_id);
CREATE INDEX idx_planning_machine_id ON planning_slots(machine_id);
CREATE INDEX idx_planning_operateur_id ON planning_slots(operateur_id);
CREATE INDEX idx_cq_of_id ON controle_qualite(of_id);
CREATE INDEX idx_cq_operateur_id ON controle_qualite(operateur_id);
CREATE INDEX idx_nc_cq_id ON non_conformites(cq_id);
CREATE INDEX idx_nc_of_id ON non_conformites(of_id);
CREATE INDEX idx_nc_responsable_id ON non_conformites(responsable_id);
CREATE INDEX idx_mouvements_materiau_id ON mouvements_stock(materiau_id);
CREATE INDEX idx_mouvements_of_id ON mouvements_stock(of_id);
CREATE INDEX idx_users_operateur_id ON users(operateur_id);
CREATE INDEX idx_clients_deactivated_by ON clients(deactivated_by);
CREATE INDEX idx_materiaux_deactivated_by ON materiaux(deactivated_by);
CREATE INDEX idx_machines_deactivated_by ON machines(deactivated_by);
CREATE INDEX idx_fournisseurs_deactivated_by ON fournisseurs(deactivated_by);
CREATE INDEX idx_of_cancelled_by ON ordres_fabrication(cancelled_by);
CREATE INDEX idx_fa_bc_id ON factures_achat(bc_id);
CREATE INDEX idx_materiau_fournisseurs_fournisseur_id ON materiau_fournisseurs(fournisseur_id);
CREATE INDEX idx_materiau_fournisseurs_materiau_id ON materiau_fournisseurs(materiau_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_failed_logins_ip ON failed_logins(ip_address);
```

#### 7.30.2 Composite Indexes for Common Query Patterns
```sql
-- OF filtering and sorting
CREATE INDEX idx_of_statut_date_echeance ON ordres_fabrication(statut, date_echeance);
CREATE INDEX idx_of_statut_priorite ON ordres_fabrication(statut, priorite);
CREATE INDEX idx_of_statut_created ON ordres_fabrication(statut, created_at DESC);

-- Operations by OF and order
CREATE INDEX idx_of_operations_of_ordre ON of_operations(of_id, ordre);

-- Stock alerts
CREATE INDEX idx_materiaux_stock_alert ON materiaux(stock_actuel, stock_minimum) WHERE stock_actuel < stock_minimum;

-- Activity log queries
CREATE INDEX idx_activity_entity_type_id ON activity_log_v2(entity_type, entity_id);
CREATE INDEX idx_activity_user_created ON activity_log_v2(user_id, created_at DESC);
CREATE INDEX idx_activity_created_desc ON activity_log_v2(created_at DESC);

-- Movement history
CREATE INDEX idx_mouvements_materiau_created ON mouvements_stock(materiau_id, created_at DESC);

-- Planning queries
CREATE INDEX idx_planning_machine_dates ON planning_slots(machine_id, date_debut, date_fin);
CREATE INDEX idx_planning_of_dates ON planning_slots(of_id, date_debut);

-- Document number lookups
CREATE INDEX idx_da_statut_created ON demandes_achat(statut, created_at DESC);
CREATE INDEX idx_bc_statut_created ON bons_commande(statut, created_at DESC);
```

#### 7.30.3 CHECK Constraints for Enum-Like Columns
```sql
-- OF status and priority
ALTER TABLE ordres_fabrication ADD CHECK (statut IN ('DRAFT','APPROVED','IN_PROGRESS','COMPLETED','CANCELLED'));
ALTER TABLE ordres_fabrication ADD CHECK (priorite IN ('URGENT','HIGH','NORMAL','LOW'));

-- User roles
ALTER TABLE users ADD CHECK (role IN ('ADMIN','MANAGER','OPERATOR'));

-- Operator roles
ALTER TABLE operateurs ADD CHECK (role IN ('OPERATEUR','CHEF_ATELIER','RESPONSABLE','TECHNICIEN'));
ALTER TABLE operateurs ADD CHECK (type_taux IN ('HORAIRE','PIECE','BOTH'));

-- Machine status
ALTER TABLE machines ADD CHECK (statut IN ('OPERATIONNELLE','EN_MAINTENANCE','EN_PANNE','ARRETEE'));

-- Operation status
ALTER TABLE of_operations ADD CHECK (statut IN ('PENDING','IN_PROGRESS','COMPLETED'));

-- Stock movement types
ALTER TABLE mouvements_stock ADD CHECK (type IN ('ENTREE','SORTIE','ADJUST'));

-- BL status
ALTER TABLE bons_livraison ADD CHECK (statut IN ('EMIS','LIVRE','CANCELLED'));

-- DA status
ALTER TABLE demandes_achat ADD CHECK (statut IN ('PENDING','APPROVED','REJECTED','ORDERED','RECEIVED','CANCELLED'));
ALTER TABLE demandes_achat ADD CHECK (urgence IN ('NORMAL','URGENT'));

-- BC status
ALTER TABLE bons_commande ADD CHECK (statut IN ('DRAFT','ENVOYE','RECU','ANNULE','RECU_PARTIEL'));

-- BR status
ALTER TABLE bons_reception ADD CHECK (statut IN ('EN_ATTENTE','COMPLET','PARTIEL','ANNULE'));

-- Quality control
ALTER TABLE controle_qualite ADD CHECK (statut IN ('EN_ATTENTE','CONFORME','NON_CONFORME','EN_COURS'));
ALTER TABLE controle_qualite ADD CHECK (type_controle IN ('FINAL','INTERMEDIAIRE','RECEPTION'));

-- Non-conformities
ALTER TABLE non_conformites ADD CHECK (statut IN ('OUVERTE','EN_COURS','CLOTUREE'));
ALTER TABLE non_conformites ADD CHECK (gravite IN ('MINEURE','MAJEURE','CRITIQUE'));

-- Maintenance
ALTER TABLE maintenance_orders ADD CHECK (statut IN ('PLANIFIE','EN_COURS','TERMINE','ANNULE'));
ALTER TABLE maintenance_orders ADD CHECK (type_maintenance IN ('PREVENTIVE','CORRECTIVE','URGENCE'));
ALTER TABLE maintenance_orders ADD CHECK (priorite IN ('BASSE','NORMAL','HAUTE','URGENTE'));

-- Suppliers
ALTER TABLE fournisseurs ADD CHECK (statut IN ('ACTIF','INACTIF','BLACKLISTE'));

-- Settings
ALTER TABLE settings ADD CHECK (type IN ('string','boolean','number'));
ALTER TABLE settings ADD CHECK (groupe IN ('societe','finance','workflow','alertes','pdf','acces','securite'));
```

#### 7.30.4 Triggers for `updated_at`
Every table with `updated_at` column gets an auto-update trigger:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_operateurs_updated_at BEFORE UPDATE ON operateurs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_produits_updated_at BEFORE UPDATE ON produits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_materiaux_updated_at BEFORE UPDATE ON materiaux FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_machines_updated_at BEFORE UPDATE ON machines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_ordres_fabrication_updated_at BEFORE UPDATE ON ordres_fabrication FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_bons_livraison_updated_at BEFORE UPDATE ON bons_livraison FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_demandes_achat_updated_at BEFORE UPDATE ON demandes_achat FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_bons_commande_updated_at BEFORE UPDATE ON bons_commande FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_bons_reception_updated_at BEFORE UPDATE ON bons_reception FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_factures_achat_updated_at BEFORE UPDATE ON factures_achat FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_maintenance_orders_updated_at BEFORE UPDATE ON maintenance_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_planning_slots_updated_at BEFORE UPDATE ON planning_slots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_controle_qualite_updated_at BEFORE UPDATE ON controle_qualite FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_non_conformites_updated_at BEFORE UPDATE ON non_conformites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fournisseurs_updated_at BEFORE UPDATE ON fournisseurs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_operation_types_updated_at BEFORE UPDATE ON operation_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_document_sequences_updated_at BEFORE UPDATE ON document_sequences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 7.30.5 Data Type Guidelines
- **Financial values** (prix, montant, cout): `DECIMAL(12,2)` — supports up to 9,999,999,999.99
- **Quantities** (stock, quantite): `DECIMAL(10,2)` — supports up to 99,999,999.99
- **BOM quantities** (quantite_par_unite): `DECIMAL(8,3)` — supports fractional quantities like 0.125
- **Pay rates** (taux): `DECIMAL(8,2)` — supports up to 999,999.99 TND
- **Integers** (ordre, duree, counts): `INT`
- **Large IDs** (activity log, movements): `BIGSERIAL`
- **Dates/times**: `DATE` for dates-only, `TIMESTAMP` for datetime
- **Text**: `VARCHAR(n)` for bounded strings, `TEXT` for unbounded (notes, descriptions)
- **NEVER use `DOUBLE PRECISION`** for financial, stock, or quantity values (floating point errors)

---

## 10. BUSINESS LOGIC & WORKFLOWS

### 8.1 OF Lifecycle
1. **DRAFT**: Created, can be edited, BL auto-created with OF
2. **APPROVED**: Validated, ready for production. Stock checked. If insufficient, auto-DAs created.
3. **IN_PROGRESS**: Production started. Operations advance sequentially.
4. **COMPLETED**: All operations done. Can generate invoices, fiches, BL delivery.
5. **CANCELLED**: Soft-cancelled with mandatory reason. Cascades to BL, DAs, BCs.

State transitions: DRAFT -> APPROVED -> IN_PROGRESS -> COMPLETED. From any non-completed/non-cancelled state -> CANCELLED (with reason).

### 8.2 Operation Sequencing
- Operations must be completed in order (ordre field)
- Cannot start operation N until all operations 0..N-1 are COMPLETED
- Only ONE operation can be IN_PROGRESS at a time
- When IN_PROGRESS operation completed: backend checks all previous are COMPLETED, finds next PENDING, if no other IN_PROGRESS -> auto-sets next to IN_PROGRESS
- Validation: 409 errors for ordering violations

### 8.3 BOM Stock Checking & Auto-DA Creation
1. Calculate required: bom.quantite_par_unite * OF.quantite
2. Compare with materiaux.stock_actuel
3. If stock < required: shortfall detected
4. If stock_deduction_auto enabled: auto-create DA(s) for shortfall materials
5. Return shortfalls list and auto-created DA numbers in response
6. 409 Conflict if insufficient stock with pending DAs

### 8.4 BL Auto-Creation
When bl_auto_creation=true, creating an OF also creates a BL with statut='EMIS'. BL number returned in OF creation response. BL can only be delivered when OF is COMPLETED.

### 8.5 BR Confirmation Updates Stock
1. stock_actuel += quantite_recue
2. ENTREE movement record created
3. BC status may be updated
4. DA status updated to RECEIVED

### 8.6 Quality Control Auto-Derivation
- rebut > 0 OR conforme < controlee -> NON_CONFORME
- conforme == controlee AND total > 0 -> CONFORME
- Otherwise: EN_ATTENTE

### 8.7 Cancel Cascade
1. OF -> CANCELLED, cancel_reason set
2. Associated BL -> CANCELLED
3. Associated DAs -> CANCELLED
4. Associated BCs -> CANCELLED (cascades to BRs)
5. Stock adjustments if materials were deducted
6. If operations started: suggests NC (ISO 9001 Clause 10.2), suggest_nc=true in response

### 8.8 Settings Effects
- bl_auto_creation: creates BL with OF
- stock_deduction_auto: auto-DAs for stock shortfalls
- cq_avant_completed: require CONFORME QC before OF COMPLETED
- cq_auto_creation: auto-create QC ticket when OF COMPLETED
- da_auto_approve_seuil: auto-approve DA below threshold (0=disabled)
- urgent_auto_jours: auto-set URGENT if retard > X days
- retard_alerte_jours: notification X days before deadline

### 8.9 Theme & Sidebar Persistence
- localStorage `sofem_display`: {theme, accent_color, date_format, number_format, currency_position, dash_of_count, auto_refresh_sec, default_page, toast_duration, show_bl_col, show_chef_col, show_client_col, compact_table}
- localStorage `sofem_sidebar_collapsed`: 'true'/'false'
- localStorage `SOFEM_API_URL`: explicit API override

### 8.10 Custom Events
- `sofem:modals-ready`: dispatched after modal HTML partials loaded
- `sofem:of-ready`: dispatched after OF modules loaded
- `invokeWhenReady()`: waits for events with 5-second timeout

### 8.11 Page Loader System
Each page registers loader in `window.pageLoaders`. When navigating via hash, corresponding loader is called if registered.

### 8.12 Hash-Based Routing
URL hash for navigation: #dashboard, #orders, etc. On page load: reads hash, navigates or defaults to 'dashboard'.

### 8.13 Performance Best Practices

#### 8.13.1 Database Connection Pooling
- Pool size: `DB_POOL_SIZE=20` (default)
- Timeout: `DB_POOL_TIMEOUT=15` seconds
- Max waiting: `DB_POOL_MAX_WAITING=200` requests
- **Retry logic:** On `ECONNREFUSED` or `ECONNRESET`, retry up to 3 times with exponential backoff (100ms, 500ms, 1000ms)
- **Health check:** `SELECT 1` every 30 seconds to keep connections alive
- **Idle timeout:** Release connections after 10 seconds of inactivity (keep minimum 2 connections)

#### 8.13.2 N+1 Query Prevention
**Problem:** Loading 100 OFs, then querying operations for each OF separately = 101 queries.

**Solution:** Use JOINs or batch queries:
```typescript
// BAD: N+1
const ofs = await query('SELECT * FROM ordres_fabrication LIMIT 100');
for (const of of ofs) {
  const ops = await query('SELECT * FROM of_operations WHERE of_id = $1', [of.id]);
}

// GOOD: Single JOIN query
const ofs = await query(`
  SELECT of.*, json_agg(json_build_object(
    'id', op.id, 'nom', op.operation_nom, 'statut', op.statut, 'ordre', op.ordre
  )) FILTER (WHERE op.id IS NOT NULL) as operations
  FROM ordres_fabrication of
  LEFT JOIN of_operations op ON op.of_id = of.id
  GROUP BY of.id
  ORDER BY of.created_at DESC
  LIMIT 100
`);
```

**Rules:**
- Always batch-load related data with JOINs or `WHERE id IN (...)`
- Use `json_agg` or `json_build_object` for nested JSON responses
- For very large datasets: use DataLoader pattern (batch + cache per request)

#### 8.13.3 Caching Strategy
| Data | Cache Duration | Storage | Invalidation |
|------|---------------|---------|-------------|
| Settings (system) | 5 minutes | In-memory Map | On bulk save |
| Operation types | 10 minutes | In-memory Map | On create/update/delete |
| Dashboard KPIs | 30 seconds | In-memory Map | On OF status change |
| User profile | 1 minute | In-memory Map | On profile update |
| Materials list | 1 minute | In-memory Map | On movement/create/delete |
| PDF documents | 24 hours | Disk (temp) | Never (snapshot) |

**Redis (if available):** Use for cross-instance cache (multiple serverless functions), session blocklist, rate limiting counters.

#### 8.13.4 Background Jobs
Heavy operations should be offloaded to background processing:

| Job | Trigger | Method |
|-----|---------|--------|
| PDF generation | User request | Queue ( BullMQ / in-memory ) |
| Email notifications | Event (late OF, stock alert) | Queue |
| Auto-DA creation | OF creation | Inline (fast, DB-only) |
| Auto-QC creation | OF completed | Inline (fast, DB-only) |
| Monthly report generation | Scheduled (cron) | Queue |
| Activity log cleanup | Scheduled (daily) | Inline |

**For Vercel serverless:** Use Vercel Cron (`/api/cron/*`) or external scheduler (Upstash QStash, Inngest). Max function duration: 30s (Hobby), 60s (Pro), 900s (Enterprise).

#### 8.13.5 Query Optimization
- Use `EXPLAIN ANALYZE` on slow queries (>100ms)
- Avoid `SELECT *` — specify columns needed
- Use `LIMIT` on all list queries
- Use covering indexes where possible (index includes all queried columns)
- For full-text search: use `tsvector` + GIN index instead of multiple `ILIKE`

#### 8.13.6 Concurrency Protection (Race Condition Prevention)

Business rules enforced in application code are insufficient under concurrent access. Database-level locking is required for state transitions.

**Critical operations requiring `SELECT ... FOR UPDATE`:**

```typescript
// BAD: Race condition — two users can both advance the same operation
const op = await query('SELECT * FROM of_operations WHERE id = $1', [opId]);
if (op.statut === 'PENDING') {
  await query('UPDATE of_operations SET statut = $1 WHERE id = $2', ['IN_PROGRESS', opId]);
}

// GOOD: Row-level lock prevents concurrent modification
await query('BEGIN');
const op = await query('SELECT * FROM of_operations WHERE id = $1 FOR UPDATE', [opId]);
if (op.statut !== 'PENDING') {
  await query('ROLLBACK');
  throw new ConflictError('Operation is not pending');
}
await query('UPDATE of_operations SET statut = $1, debut = COALESCE(debut, NOW()) WHERE id = $2', ['IN_PROGRESS', opId]);
await query('COMMIT');
```

**Operations requiring row-level locking:**
1. **Operation status advance** — lock `of_operations` row before changing statut
2. **OF status sync** — lock `ordres_fabrication` row when recalculating from operations
3. **Stock movement** — lock `materiaux` row before reading stock_actuel, computing new value, and writing
4. **BR confirmation** — lock `bons_reception` + all affected `materiaux` rows in same transaction
5. **OF cancel** — lock `ordres_fabrication` row before cascading to BL, DAs, BCs
6. **DA approve/reject** — lock `demandes_achat` row before changing statut
7. **Document number generation** — lock `document_sequences` row (handled by INSERT ... ON CONFLICT)

**Transaction isolation level:** Use `READ COMMITTED` (PostgreSQL default) for most operations. Use `REPEATABLE READ` for operations that read multiple related rows and must see a consistent snapshot (e.g., OF full edit with operations + BOM).

**Advisory locks for global operations:** For operations that span multiple rows or tables, use PostgreSQL advisory locks:
```sql
-- Lock by OF ID when doing full OF update (operations + BOM + cost)
SELECT pg_advisory_xact_lock(hashtext('of_full_update_' || $1::text));
-- Lock by materiau_id when doing stock adjustments
SELECT pg_advisory_xact_lock(hashtext('stock_adjust_' || $1::text));
```

**Retry on serialization failure:** Wrap critical transactions in retry logic:
```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.code === '40001' && i < maxRetries - 1) {
        // Serialization failure — retry with backoff
        await sleep(100 * Math.pow(2, i));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 8.14 Developer Experience

#### 8.14.1 Database Migrations
Never run raw SQL manually. All schema changes go through versioned migrations:

```
backend-ts/migrations/
├── 001_create_users.up.sql
├── 001_create_users.down.sql
├── 002_create_clients.up.sql
├── 002_create_clients.down.sql
├── 003_create_ordres_fabrication.up.sql
├── 003_create_ordres_fabrication.down.sql
├── ...
└── 030_add_sessions_table.up.sql
└── 030_add_sessions_table.down.sql
```

**Tool:** `node-pg-migrate` or custom migration runner.
**Rules:**
- Each migration is a pair: `.up.sql` (apply) and `.down.sql` (rollback)
- Migrations are numbered sequentially (never skip numbers)
- Migrations are immutable once applied (create new migration for changes)
- `migrations` table tracks applied migrations with timestamp
- CI blocks merge if migration has no corresponding `.down.sql`

#### 8.14.2 Seed Data
Every installation ships with seed data for testing:

```
backend-ts/seed/
├── 01_users.ts          — 1 admin, 1 manager, 3 operators
├── 02_clients.ts        — 10 sample clients
├── 03_produits.ts       — 5 sample products with BOM
├── 04_materiaux.ts      — 15 sample materials
├── 05_machines.ts       — 6 sample machines (4 operational, 2 maintenance)
├── 06_operation_types.ts — 8 operation types
├── 07_ofs.ts            — 20 sample OFs (various statuses, dates)
├── 08_suppliers.ts      — 5 sample suppliers
└── 09_settings.ts       — default system settings
```

**Commands:**
- `npm run db:seed` — populate with sample data
- `npm run db:reset` — drop all tables + re-seed (destructive!)
- `npm run db:seed:production` — seed ONLY settings, no sample data

#### 8.14.3 OpenAPI / Swagger Specification
Backend exposes API documentation:

- **Design-first:** `backend-ts/openapi.yaml` (OpenAPI 3.1 spec)
- **Auto-generated docs:** Swagger UI at `GET /api/docs` (development only)
- **Validation:** Request/response validation against spec in CI
- **Codegen:** TypeScript types generated from OpenAPI spec (`openapi-typescript`)
- **Frontend client:** API client generated from spec (type-safe, no manual typing)

#### 8.14.4 Docker Compose for Local Development
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: sofem_mes
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:  # optional
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend-ts
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/sofem_mes
      SECRET_KEY: dev-secret-key-change-in-production
      NODE_ENV: development
    volumes:
      - ./backend-ts/src:/app/src
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/src
    depends_on:
      - backend

volumes:
  pgdata:
```

**Developer setup:** `docker compose up -d` then `npm run db:migrate && npm run db:seed`

#### 8.14.5 Structured Logging
All backend logs are JSON-structured for log aggregation:

```json
{"level":"info","timestamp":"2026-04-12T10:30:00.000Z","request_id":"req_abc123","method":"POST","path":"/api/of","status":201,"duration_ms":45,"user_id":3,"message":"OF created: OF-2026-0042"}
{"level":"error","timestamp":"2026-04-12T10:30:01.000Z","request_id":"req_def456","error":"ECONNREFUSED","message":"Database connection failed","retry_count":1}
```

**Log levels:** `debug` (dev only), `info` (normal operations), `warn` (degraded but functional), `error` (request failed), `fatal` (system down).

**Log destinations:**
- Development: `console` (human-readable with colors)
- Production: `console` as JSON (Vercel captures stdout)
- Audit logs: Also written to `activity_log_v2` table

**No `console.log`** in production code. Use logger: `logger.info()`, `logger.error()`, `logger.warn()`, `logger.debug()`.

---

## 11. RESPONSIVE BREAKPOINTS

| Breakpoint | Admin Changes |
|------------|--------------|
| max-width: 1100px | KPI grid: 3 columns |
| max-width: 900px | Grid2 -> 1 column, sidebar 160px, table font 12px |
| max-width: 768px | Table font 11px, modal width 97vw |

| Breakpoint | Operator Changes |
|------------|-----------------|
| max-width: 600px | KPIs 2 columns, stages horizontal scroll, padding 1rem |

Mobile: sidebar collapses, tables scroll horizontally, modals 95vw max.

---

## 12. ANIMATIONS

| Name | Purpose | Keyframes |
|------|---------|-----------|
| spin | Loading spinner | rotate 360deg |
| shake | Login error | translateX +/-6px |
| ring | Active stage pulse | box-shadow 0->5px |
| blink | In-progress dot | opacity 1->0.35 |
| blink-yellow | Yellow variant | opacity + background shift |
| fadeUp | Page transition | opacity 0->1, translateY 6px->0 |

Key transitions: buttons 0.15s linear, sidebar 0.3s ease, bar fill 0.6s linear, toast 0.25s linear, settings toggle 0.2s linear.

---

## 13. LOCAL STORAGE KEYS

| Key | Content |
|-----|---------|
| `sofem_display` | Theme, accent, date/number format, dashboard preferences, column toggles |
| `sofem_sidebar_collapsed` | 'true' or 'false' |
| `SOFEM_API_URL` | Explicit API base URL override |

---

## 14. ERROR HANDLING

- Toast errors: 3.5s duration, red border for errors, green for success
- 401 redirect: sets `window._loggingOut = true`, redirects to `/`
- Silent API (`apiSilent`): on error returns null, no UI feedback (used for polling)
- Activity logging: `.catch(() => {})` -- silent fail
- Validation rules: PIN 4 digits, cancel reason min 5 chars, required fields on all forms

---

## 15. EXPORT & PRINT

- CSV export: semi-colon separated, UTF-8 BOM, downloads as `{filename}_YYYY-MM-DD.csv`
- PDFs: backend-generated, opened in new tabs, cookie-based auth (browser sends HttpOnly session cookie automatically when opening in new tab via window.open)
- Dossier print: new window with HTML content and print-friendly CSS
- Grouped invoice: POST selected OF IDs, receives PDF blob

---

## 16. ENVIRONMENT VARIABLES

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | - | JWT signing key (required) |
| `NEON_DATABASE_URL` | - | Neon DB connection (takes precedence) |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `PGHOST` | localhost | DB host |
| `PGPORT` | 5432 | DB port |
| `PGUSER` | postgres | DB user |
| `PGPASSWORD` | - | DB password |
| `PGDATABASE` | sofem_mes | DB name |
| `PGSSLMODE` | disable | SSL mode |
| `DB_POOL_SIZE` | 20 | Max connections |
| `DB_POOL_TIMEOUT` | 15 | Pool timeout (seconds) |
| `DB_POOL_MAX_WAITING` | 200 | Max waiting requests |
| `PORT` | 8000 | Server port |
| `ALLOWED_ORIGINS` | localhost:3000,5173,sofem.vercel.app | CORS origins |
| `TOKEN_EXPIRE_HOURS` | 12 | JWT expiry |
| `NODE_ENV` | - | 'production' = secure cookies |

---

## 17. DEPLOYMENT

### Vercel
- Install: `npm ci && npm --prefix backend-ts ci`
- Build: `npm run build:frontend`
- Function max duration: 30s
- Rewrites: `/api/(.+/.+)` -> `/api/bridge?path=$1`, static pages -> HTML files

### API Bridge
Serverless function `api/[...path].ts` routes `/api/*` to Express backend via `path` query parameter from Vercel rewrite rule.

---

*END OF SPECIFICATION*
