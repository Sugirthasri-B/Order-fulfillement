# Order Fulfilment Application — Handoff / Context Document

**Purpose of this file:** paste this into a new chat (along with "continue from this handoff")
so a fresh Claude Code session has full context on what's been built, why, and what's left.
This is a snapshot as of **2026-09-24**.

---

## 1. What this project is

An AI-native proficiency assessment: an Order Fulfilment system (React + Node.js/Express +
SQL Server) built incrementally across many phases, then extended with a Stage 2 business-rule
change ("CHANGE1"). The person I'm working with is not a professional developer — they need
plain, step-by-step guidance, exact values to type into forms, and clear explanations of *why*
something happened, not just *what* happened.

**Repo root:** `D:\claude ass\order-fulfilment\`
**Git:** already initialized, pushed to `https://github.com/Sugirthasri-B/Order-fulfillement.git`,
branch `master`, tracking `origin/master`. Two commits so far: `Order requirement first changes`
(Stage 1) and `STAGE 2 CHANGES` (CHANGE1). Working tree was clean as of this snapshot.

**Structure:**
```
order-fulfilment/
├── frontend/   React + TypeScript (Vite)
├── backend/    Node.js + Express + TypeScript
├── database/   SQL Server scripts, numbered, run via SSMS
└── README.md   Living documentation — READ THIS FIRST, it has API reference,
                testing instructions, and the Stage 2/CHANGE1 section.
```

## 2. Database — real, shared, external

- **Not a local/sandbox database.** Real SQL Server at `172.16.1.23`, database `MOBDB_DEV`,
  reached from this sandbox over the network (confirmed working).
- Credentials live in `backend/.env` (gitignored, **not** in the repo). If starting fresh and
  `.env` is missing, ask the user for `DB_SERVER`, `DB_USER`, `DB_PASSWORD` again — do not
  guess or fabricate them, and never print them back into chat verbatim beyond what's needed.
- **Every single database object is prefixed `Ordful`** (tables, PKs, FKs, checks, indexes) —
  this was an explicit, deliberate user request, done consistently across all scripts and all
  backend SQL. Verified with a full grep audit (see conversation) — do not create a new object
  without the prefix.
- Tables: `OrdfulCustomers`, `OrdfulInventory`, `OrdfulOrders`, `OrdfulFulfilmentResults`,
  `OrdfulInventoryAllocations`, `OrdfulBackorders`.
- Scripts run in order: `01` (skip — DB already exists), `02_create_tables.sql`,
  `03_constraints.sql`, `04_seed_data.sql`, then `05`–`08` are **additive migrations** for a DB
  that predates a given phase (each is idempotent / safe to re-run; check the header comment in
  each file — some should be skipped on a fresh install because `02`/`03` already include that
  change). `08_stage2_change1_priority_partial_release.sql` is the most recent and important one.
- **Gotcha already hit and fixed:** SQL Server will not let you `ALTER TABLE ADD <col>` and then
  reference that column in the *same batch* (batches are compiled as a whole before execution).
  Every migration script must put a `GO` between adding a column and using it. This bit us once
  in `08_...sql` — already fixed there, but remember it for any future migration.
- Migrations are applied to the real `MOBDB_DEV` by running the `.sql` file's batches (split on
  `GO`) via a throwaway `ts-node` script using `backend/src/config/db.ts`'s `getPool()`. There is
  no migration runner tool set up — this has been done manually/one-off each time. If asked to
  run a new migration, use this same pattern (write a scratch `.ts` file in `backend/`, run it,
  delete it — see git history / prior conversation for the exact script shape).

## 3. Backend architecture (Node/Express/TypeScript)

Layering, strictly followed and previously audited with a full grep sweep (no violations found):
```
Routes → Controllers → Services → Methods → SQL Server
```
- `routes/*.routes.ts` — no logic, just wiring + validation middleware.
- `controllers/*.controller.ts` — HTTP request/response only, wrapped in `asyncHandler`.
- `services/*.service.ts` — business logic. `order.service.ts` is the fulfilment engine.
- `methods/*.methods.ts` — the only place with raw SQL, always parameterized
  (`request.input(...)`), never string-concatenated.
- `methods/db.methods.ts` — `executeQuery` (pool-based) and `withTransaction` (transaction-scoped
  executor + commit/rollback), plus `isDuplicateKeyError` for idempotency handling.
- Centralized error handling via `middleware/errorHandler.ts` + `AppError` class; 404 via
  `middleware/notFound.ts`.
- `src/app.ts` exports a pure `createApp()`/`app` (no `listen()` call) so tests can drive it with
  `supertest` without binding a port; `src/server.ts` is the actual entry point that calls
  `app.listen()`. `npm run dev` runs `nodemon` against `server.ts`.
- **Gotcha already hit and fixed:** `nodemon` had no scoped watch config and was watching the
  entire project tree (`*.*`, including `node_modules`), causing intermittent crashes on
  startup (a stray file touch could trigger a restart that collided with the still-binding
  previous instance on the same port). Fixed with `backend/nodemon.json` (`"watch": ["src"]`)
  and simplified the `dev` script to just `nodemon`. If crashes reappear, check this first.
- Backend currently configured to run on **port 4000** (not the earlier default 5000 — the
  user's real `.env` sets `PORT=4000`). Frontend's `.env` must have
  `VITE_API_BASE_URL=http://localhost:4000` to match, or every API call will hit a stale
  process on the old port and return "Route not found" / "Unable to reach the server."
- **A stale backend process from early testing (PID 616) was left running on port 5000 for a
  long time** and caused repeated confusing "Route not found" errors whenever the frontend's env
  wasn't correctly pointed at 4000. If "Route not found" errors reappear, the first move is
  always: check what's actually listening on the expected port
  (`Get-NetTCPConnection -LocalPort <port>` in PowerShell) before assuming a code bug.

## 4. Frontend architecture (React + TypeScript, Vite)

```
frontend/src/
├── components/   Reusable primitives: Button, Input, Select, DatePicker, Table, Modal,
│                 StatusBadge, Loading, ErrorMessage, EmptyState, PageHeader, Toast,
│                 FulfilmentResultPanel, BarChart, DonutChart (plain inline SVG, no chart lib)
├── pages/        Dashboard, Customers, Inventory, CreateOrder, Orders, FulfilmentDetails
├── services/     Centralized API client (axios) — apiClient.ts + one service file per
│                 resource (customerService, inventoryService, orderService). Components
│                 NEVER call axios directly.
├── hooks/        useAsync (generic fetch+loading+error), useMutation (generic submit),
│                 useRecentOrders (localStorage — see limitation below), useKnownOrders
│                 (wraps useRecentOrders + fetch, shared by Dashboard and Orders page), useToast
├── routes/       React Router setup, path constants
├── layouts/      AppLayout (sidebar + content shell)
└── styles/       tokens.css (design tokens/CSS vars) + global.css (all component styles)
```
- **Design system:** light theme only (explicitly no dark mode — the user rejected it twice:
  first when it defaulted to near-black via `prefers-color-scheme`, forced light instead).
  Sidebar is a soft blue-tinted light background (not pure white, not dark) with a raised white
  pill for the active nav item. Logo is a clean inline-SVG package icon badge (not an emoji —
  the user found the emoji "not nice"). Status colors (`good`/`warning`/`critical`/`neutral`)
  come from the `dataviz` skill's validated palette, always paired with a visible text label
  (never color alone) via `StatusBadge`.
- **No "list all orders" backend endpoint exists** (`GET /api/orders/:orderId` only). The Orders
  page and Dashboard's order stats/charts are built from `useRecentOrders` — order IDs this
  *specific browser* has created or looked up, persisted in `localStorage`, each enriched with a
  live `GET` call. This is a known, deliberate, documented limitation — not a bug. If asked to
  make the Orders list "complete" or "show everyone's orders," that requires a new backend
  list endpoint (not built) — flag this rather than pretending the current list is authoritative.
- Response-shape coupling: `OrderDetailsPanel` and `FulfilmentResultPanel` render
  `allocations` as an array (0, 1, or many entries) and never show a fake allocation section for
  a blocked order. Both were rewritten for CHANGE1 (see §6).

## 5. Testing

- `backend/tests/unit/` — pure logic, no DB, always runnable: `decideWarehouse.test.ts`
  (Standard flow), `decidePriorityAllocation.test.ts` (Priority flow, CHANGE1), and
  `decideBackorderApplication.test.ts` (backorder top-up flow, CHANGE2). 21 tests.
- `backend/tests/integration/` — full HTTP tests via `supertest` against the real `MOBDB_DEV`
  (create/clean up their own uniquely-named fixtures, safe to run against seeded data):
  `orders.test.ts` (24 tests covering both Stage 1 Standard scenarios and Stage 2 Priority
  scenarios), `concurrency.test.ts` (oversell prevention via `UPDLOCK`), `transactions.test.ts`
  (rollback proof), `inventoryAvailability.test.ts` (7 tests, CHANGE2 — see §6c).
- **Current status: 52/52 passing**, verified live against the real database (not mocked) as of
  this snapshot. Run with `cd backend && npm test` (or `npm run test:unit` / `test:integration`
  separately). `test:unit` needs no DB; `test:integration` needs `backend/.env` configured.

## 6. Business rules — current state (Stage 1 + Stage 2/CHANGE1)

**Stage 1 (Standard customers — completely unchanged by CHANGE1):**
- Full requested quantity must come from **exactly one** warehouse — warehouses are **never**
  combined for a Standard customer.
- Warehouse priority: `WH-A` → `WH-B` → `WH-C`. First warehouse meeting both
  `availableQuantity >= quantity` AND `earliestDispatchDate <= promisedDeliveryDate` wins.
- Customer eligibility gates everything, checked before any inventory logic:
  - `eligible` → proceed.
  - `credit hold` → blocked, `reason: "credit hold"`.
  - `unknown` → blocked, `reason: "eligibility unknown"`.
  - customer doesn't exist at all → blocked, `reason: "customer not found"`, **and nothing is
    persisted to the DB** (there's no valid customer to satisfy the FK, so the order/result
    exist only in the HTTP response, never in `OrdfulOrders`).
- Inventory-blocked reasons: `"insufficient inventory"` (no warehouse has enough) or
  `"no inventory can meet promised delivery date"` (enough exists somewhere, but too late).
- Idempotency: resubmitting the same completed `orderId` returns the exact same result, never
  double-deducts inventory or double-inserts allocations. Implemented via a
  duplicate-key-catch-and-refetch pattern (`withIdempotentRetry` in `order.service.ts`), robust
  even under concurrent duplicate submissions (verified in `concurrency.test.ts`).
- Concurrency/oversell prevention: `lockInventoryForProduct` takes `UPDLOCK, ROWLOCK` on all of
  a product's warehouse rows inside a transaction, serializing concurrent orders on the same
  product so two simultaneous requests can never both succeed against the same limited stock.

**Stage 2 / CHANGE1 (Priority customers only — this is the newest, most complex layer):**
- A `Priority` customer (per the **request body's** `customerType` field — the branch is decided
  by what's submitted, not by re-reading the customer's own stored `CustomerType`) may combine
  inventory across `WH-A`, `WH-B`, `WH-C`, taken **in that order**, greedily, never allocating
  more than requested.
- If combined available stock covers the full quantity → `status: "Released"` (not "Partially
  Released" — full coverage is still just "Released").
- If less than full but **≥ 70%** (configurable) of requested quantity is available → release
  what's available, put the rest on an `Open` backorder, `status: "Partially Released"`.
  **Exactly 70% qualifies** (boundary is inclusive) — this is checked with integer arithmetic
  (`releasedQuantity * 100 >= quantity * thresholdPercent`) specifically to avoid a
  floating-point rounding bug at the exact boundary (JS `100 * 0.7 !== 70` in float math — this
  was deliberately engineered around, see `decidePriorityAllocation` in `order.service.ts`).
- If < 70% available → `status: "Blocked"`, `reason: "insufficient inventory"`,
  `releasedQuantity: 0`, `backorderedQuantity: <full quantity>`, `allocations: null`, and
  critically **no allocation and no backorder row are created at all**.
- A warehouse whose `earliestDispatchDate` is after `promisedDeliveryDate` is excluded from the
  "available" pool entirely for the combine (same dispatch-date discipline as Stage 1).
- Threshold is configurable via `PRIORITY_PARTIAL_RELEASE_THRESHOLD_PERCENT` in `backend/.env`
  (integer percent, default `70`).

**Breaking API contract change introduced by CHANGE1** (the assessment doc explicitly demanded
exact literal casing "so the solution can be verified consistently" — this was a deliberate,
required break from the earlier lowercase convention used in Phases 1–13):
| Field | Before | Now |
|---|---|---|
| `status` values | `"released"` / `"partially released"` / `"blocked"` | `"Released"` / `"Partially Released"` / `"Blocked"` |
| backorder field | `backorderQuantity` | `backorderedQuantity` |
| allocation field | `allocation` (single object or `null`) | `allocations` (**array**, or `null` only when Blocked) |

This touched **everything**: DB check constraints (had to normalize old lowercase rows already
in `MOBDB_DEV` via `UPDATE` in the migration), `order.types.ts` on both backend and frontend,
`order.methods.ts` (now does two round-trips per read — one for the order/result row, one for
the allocations array, via `fetchAllocationsForOrder`), all of `order.service.ts`, every backend
test, and the frontend's `StatusBadge` tone map, `OrderDetailsPanel`, `FulfilmentResultPanel`,
`OrdersTable`/`OrdersPage` filters, and `DashboardPage` chart buckets.

**Note on `POST` vs `GET` response shape:** `POST /api/orders` always returns the narrow shape
(`orderId, status, reason, releasedQuantity, backorderedQuantity, allocations`) — this exact
shape is locked in by the assessment's own JSON example and must not gain extra fields.
`GET /api/orders/:orderId` returns that same shape **plus** `customerId, customerType,
productId, quantity, promisedDeliveryDate` for the frontend's details view. These are backed by
two separate methods-layer functions (`findFulfilmentResultByOrderId` narrow vs
`findOrderDetailsByOrderId` enriched) specifically so a future change to the GET shape never
accidentally leaks into POST's response or into the idempotent-duplicate-return path.

## 6c. Business rules — Stage 3 / CHANGE2 (implemented)

**Status: implemented, tested, migration `09_stage3_change2_inventory_availability.sql` applied
to the real `MOBDB_DEV`.** Stage 1 and Stage 2/CHANGE1 behaviour (§6) are untouched — this is
purely additive and only ever mutates a backorder row Stage 2 already created.

**API convention:** unchanged from CHANGE1 (see §6) — this adds a new endpoint, it doesn't alter
existing ones. The backorder outcome returned by this endpoint (`backorderStatus`) is exactly one
of three literal values: `"Open"`, `"Closed"`, or `"NoOpenBackorder"` (the last means the
submission was recorded but there was no open backorder for that product to apply it to). The
underlying `OrdfulBackorders.Status` DB column itself only ever holds `"Open"` or `"Closed"`.

**Business need:** Operations wants to use newly-arrived inventory to fulfil an existing open
backorder — `POST /api/inventory-availability` records the new stock and automatically applies it
to the appropriate backorder.

**How it works** (`inventoryAvailability.service.ts` → `recordInventoryAvailability`):
- `POST /api/inventory-availability` body: `{ productId, warehouseId, availableQuantity }`. 404 if
  that product/warehouse pair doesn't already exist in `OrdfulInventory` (create it via
  `POST /api/inventory` first); 400 if `availableQuantity` isn't a positive integer or
  `warehouseId` isn't `WH-A`/`WH-B`/`WH-C`.
- The reported quantity is added to that warehouse's `OrdfulInventory.AvailableQuantity`
  immediately (it's real stock either way, applied or not).
- Finds the **single oldest Open backorder** for `productId` — `ORDER BY CreatedAt ASC, OrderId
  ASC` (OrderId is the tie-breaker on an exact `CreatedAt` tie; lower/earlier `OrderId` wins).
  Only ever touches that one backorder per submission.
- Pure decision logic lives in the exported `decideBackorderApplication(remainingBackorderedQty,
  availableQuantity)` (mirrors `decideWarehouse`/`decidePriorityAllocation`'s placement in
  `order.service.ts`) — `allocatedQuantity = min(remaining, available)`, **never more than the
  backorder's own remaining quantity**. Any surplus beyond that stays behind as regular on-hand
  `OrdfulInventory` stock (recorded but not consumed).
  - Full coverage → additional allocation, remaining quantity → 0, backorder → **Closed**, parent
    order's status flips to **Released**.
  - Partial coverage → additional allocation, remaining quantity reduced, backorder stays
    **Open**, parent order's status stays **Partially Released**.
  - No open backorder for the product → `backorderApplied: false`,
    `backorderStatus: "NoOpenBackorder"`, inventory still recorded.
- The additional allocation is **upserted**, not blindly inserted — `OrdfulInventoryAllocations`
  has a `UNIQUE (OrderId, ProductId, WarehouseId)` constraint, so a top-up from the same warehouse
  the order originally drew from increments that existing row (`upsertInventoryAllocation` in
  `order.methods.ts`); a top-up from a different warehouse gets its own new row.
- `OrdfulFulfilmentResults.ReleasedQuantity`/`BackorderedQuantity`/`Status` and
  `OrdfulOrders.OrderStatus` are updated together to stay in sync, exactly as the original
  order-creation flow always writes them together.
- **Explicitly out of scope, per spec:** duplicate-submission and concurrency/locking handling are
  **not implemented** for this endpoint (unlike order creation's `UPDLOCK` + idempotent-retry —
  see §3/§6). Submitting the same availability event twice will apply it twice.

**Files added:** `database/09_stage3_change2_inventory_availability.sql` (widens
`OrdfulBackorders`'s `Status` check to allow `'Closed'` and its `BackorderedQuantity` check to
allow `0`, adds an index on `(ProductId, Status, CreatedAt)`),
`utils/inventoryAvailability.types.ts`, `services/inventoryAvailability.service.ts`,
`controllers/inventoryAvailability.controller.ts`, `middleware/validateInventoryAvailability.ts`,
`routes/inventoryAvailability.routes.ts` (registered in `routes/index.ts`), new methods in
`order.methods.ts` (`findOldestOpenBackorderForProduct`, `updateBackorderAfterApplication`,
`upsertInventoryAllocation`, `increaseInventoryQuantity`, `applyBackorderReleaseToOrder`).
**Tests added:** `tests/unit/decideBackorderApplication.test.ts` (4 tests),
`tests/integration/inventoryAvailability.test.ts` (7 tests, real DB) — full coverage, surplus
never over-allocated, partial coverage, no-open-backorder case, CreatedAt-tie/OrderId-tie-break,
404 on unknown inventory, 400 on invalid quantity. Full suite: **52/52 passing**.

## 7. Common mistakes seen while testing with the user (not code bugs)

The user repeatedly typed **`PRD-100`/`PRD100`** instead of **`PROD-100`** in the Product ID
field and got confused why every order blocked with "insufficient inventory" (the product
literally doesn't exist, so 0% is "available"). If a fresh session sees repeated unexplained
"Blocked"/"insufficient inventory" results, **check for ID typos first** — ask for the exact
values used, or better, tell the user to copy IDs straight from `GET /api/customers` /
`GET /api/inventory` responses rather than retyping them.

Real seed data available for testing (may have been mutated by live testing — verify with a
live `GET` before relying on exact numbers):
- Customers: `CUST-001` (Priority, eligible), `CUST-002` (Standard, eligible), `CUST-003`
  (Standard, credit hold), `CUST-004` (Priority, unknown).
- Products: `PROD-100` (WH-A, WH-B), `PROD-200` (WH-A, WH-C), `PROD-300` (WH-B only),
  `PROD-400` (WH-A=40, WH-B=35 — built specifically to demonstrate the CHANGE1 spec's own
  75%-partial-release example).

## 8. What's NOT done / open items

- **Frontend Customer/Inventory forms don't yet expose Priority-partial-release-specific UI**
  beyond what already existed (Create Order form already has a `customerType` select that
  drives Priority vs Standard — no further UI changes were requested for CHANGE1 beyond
  correctly rendering multi-warehouse `allocations`).
- **No authentication** — `JWT_SECRET` exists in `.env` (user provided it) but nothing in the
  codebase reads or validates it. No auth phase has ever been requested. Don't assume auth
  exists.
- **No "list all orders" endpoint** — see §4. If a future ask implies needing this, it requires
  new backend work (a `GET /api/orders` with pagination/filtering), not just a frontend change.
- Git: already initialized and pushed by the user themselves (not by me) — two commits exist.
  I have not yet been asked to make further commits since Stage 2; if asked, follow the
  attribution convention already established in this environment
  (`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`).
- A `TLS ServerName is an IP address` deprecation warning appears on every backend start
  (Node/tedious complaining about connecting to `172.16.1.23` by IP rather than hostname) — 
  harmless today, cosmetic, not something to "fix" unless asked.

## 9. How to run everything (for a fresh session)

```bash
# Backend
cd backend
npm install
npm run dev              # http://localhost:4000, needs backend/.env with real DB creds

# Frontend (separate terminal)
cd frontend
npm install
npm run dev              # http://localhost:3000, needs frontend/.env with VITE_API_BASE_URL=http://localhost:4000

# Tests (separate terminal, backend running not required for tests themselves)
cd backend
npm run test:unit        # no DB needed
npm run test:integration # needs backend/.env
```

If `backend/.env` or `frontend/.env` are missing (they're gitignored, not in the repo), ask the
user for the real DB credentials again rather than guessing — see §2.

---
*End of handoff. Read `README.md` next for the living API reference and phase-by-phase detail
this document summarizes.*
