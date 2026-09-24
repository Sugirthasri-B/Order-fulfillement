# Order Fulfilment Application

A single project containing the frontend, backend, and database components for the Order Fulfilment system.

## Structure

```
order-fulfilment/
├── frontend/   # React + TypeScript client
├── backend/    # Node.js + Express + TypeScript API
├── database/   # Microsoft SQL Server scripts (run via SSMS)
└── README.md
```

## Tech Stack

| Layer    | Technology                          |
|----------|--------------------------------------|
| Frontend | React, TypeScript                    |
| Backend  | Node.js, Express, TypeScript         |
| Database | Microsoft SQL Server (SSMS scripts)  |

## Getting Started

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Database

The app uses an existing database, **`MOBDB_DEV`** — every script starting from
`02_create_tables.sql` begins with `USE MOBDB_DEV;`. Make sure `backend/.env` has
`DB_NAME=MOBDB_DEV` (see `.env.example`).

Every object this app creates is prefixed **`Ordful`**, so it stays clearly identifiable
and unlikely to collide with anything else already in `MOBDB_DEV`:

| Object            | Name                          |
|--------------------|-------------------------------|
| Tables             | `OrdfulCustomers`, `OrdfulInventory`, `OrdfulOrders`, `OrdfulFulfilmentResults`, `OrdfulInventoryAllocations` |
| Primary keys       | `PK_OrdfulCustomers`, `PK_OrdfulInventory`, …             |
| Foreign keys       | `FK_OrdfulOrders_OrdfulCustomers`, `FK_OrdfulInventoryAllocations_OrdfulInventory`, … |
| Check constraints  | `CK_OrdfulInventory_WarehouseId`, `CK_OrdfulOrders_OrderStatus`, …    |
| Indexes            | `IX_OrdfulOrders_CustomerId`, `IX_OrdfulInventory_WarehouseId`, …     |

Run the scripts in `database/` in order using SQL Server Management Studio (SSMS):

1. ~~`01_create_database.sql`~~ — **skip this one**, it only creates a brand-new database,
   which you don't need since `MOBDB_DEV` already exists.
2. `02_create_tables.sql`
3. `03_constraints.sql`
4. `04_seed_data.sql`
5. `05_alter_inventory_add_earliest_dispatch_date.sql` — **only** if your `Inventory` table
   was created before Phase 5 and is missing `EarliestDispatchDate`. Skip on a fresh database,
   since `02_create_tables.sql` already includes that column.
6. `06_alter_inventory_allow_zero_quantity.sql` — **only** if your database was created
   before Phase 6. Relaxes `Inventory.AvailableQuantity` to allow `0` (a warehouse can be
   fully depleted by order fulfilment). Skip on a fresh database.
7. `07_alter_orders_earliest_dispatch_date_nullable.sql` — **only** if your database was
   created before Phase 6. Makes `Orders.EarliestDispatchDate` nullable (a blocked order has
   no assigned warehouse/dispatch date). Skip on a fresh database.

## API Reference

### Orders

`POST /api/orders` always returns the narrow fulfilment-outcome shape (`orderId`, `status`,
`reason`, `releasedQuantity`, `backorderQuantity`, `allocation`) — this is unchanged since
Phase 6 and duplicate submissions of a completed `orderId` return this same shape.

`GET /api/orders/:orderId` returns a richer superset — everything above, plus the order's own
request details (`customerId`, `customerType`, `productId`, `quantity`,
`promisedDeliveryDate`) — for the frontend's Orders list and Fulfilment Details page. There is
no "list all orders" endpoint; the frontend only knows about orders it has created or looked
up in the current browser (see `useRecentOrders`).

### Inventory

`Inventory`'s real primary key is the pair `(productId, warehouseId)` — there's no single
`inventoryId` column in the database. To support `PUT /api/inventory/:inventoryId` with a
single path segment, the API represents each inventory line with a synthetic, opaque
`inventoryId` string shaped `"<productId>::<warehouseId>"` (e.g. `"PROD-100::WH-A"`), returned
on every inventory response. Always use that value as-is (don't construct it yourself) when
calling the update endpoint.

| Method | Path                                  | Notes                                              |
|--------|----------------------------------------|-----------------------------------------------------|
| POST   | `/api/inventory`                       | Create a line (`productId`, `warehouseId`, `availableQuantity`, `earliestDispatchDate`) |
| GET    | `/api/inventory`                       | List everything                                    |
| GET    | `/api/inventory/product/:productId`    | All warehouses for a product (optional `?warehouseId=`) |
| GET    | `/api/inventory/warehouse/:warehouseId`| All products at a warehouse                        |
| PUT    | `/api/inventory/:inventoryId`          | Update `availableQuantity`/`earliestDispatchDate` only — product/warehouse are fixed |

### Customers

| Method | Path                          | Notes                                                        |
|--------|--------------------------------|---------------------------------------------------------------|
| POST   | `/api/customers`               | Create (`customerId`, `customerName`, `customerType`, `eligibilityStatus`) |
| GET    | `/api/customers`               | List everything                                               |
| GET    | `/api/customers/:customerId`   | One customer                                                  |
| PUT    | `/api/customers/:customerId`   | Update `customerName`/`customerType`/`eligibilityStatus`      |

## Backend Testing

The backend test suite lives in `backend/tests/`:

- `tests/unit/` — pure business-logic tests (warehouse selection/priority, dispatch-date rule).
  No database required; these always run.
- `tests/integration/` — full HTTP tests against the Express app (`supertest`) plus direct
  transaction-rollback checks. These need a real SQL Server connection, so make sure
  `backend/.env` points at your database before running them.

```bash
cd backend
npm install
npm test              # everything
npm run test:unit     # no database needed
npm run test:integration
```

Integration tests create and clean up their own uniquely-named customers/inventory/orders,
so they're safe to run against a database that already has seed data.

### Full-Integration Scenario Coverage

Every scenario below exercises the complete path: `React → REST API → Controller → Service →
Methods → SQL Server` (there is no separate "Fulfilment Service" module — `order.service.ts`
*is* the fulfilment service; it's the same layer, just named for what it does).

| # | Scenario                                              | Covered by |
|---|--------------------------------------------------------|------------|
| 1 | Eligible customer, WH-A has full quantity, valid dispatch date → released, WH-A, reason null | `orders.test.ts` — "releases the order from WH-A when WH-A alone has enough stock" |
| 2 | Credit-hold customer → blocked, reason "credit hold", no allocation | `orders.test.ts` — "blocks the order with reason \"credit hold\"..." |
| 3 | Unknown-eligibility customer → blocked, reason "eligibility unknown", no allocation | `orders.test.ts` — "blocks the order with reason \"eligibility unknown\"..." |
| 4 | WH-A=30, WH-B=30, order=50 → blocked (never combine warehouses) | `orders.test.ts` — "blocks the order when no single warehouse has enough stock..." + `decideWarehouse.test.ts` — "blocks with \"insufficient inventory\"..." |
| 5 | WH-A=50, order=50, valid dispatch date → released, WH-A (exact-quantity boundary) | `orders.test.ts` — "releases the order when WH-A stock exactly equals the requested quantity" + `decideWarehouse.test.ts` equivalent |
| 6 | WH-A=50, dispatch date after promised delivery date → blocked | `orders.test.ts` — "blocks the order when the only sufficient warehouse cannot meet the promised delivery date" |
| 7 | WH-A and WH-B both qualify → WH-A selected (priority) | `orders.test.ts` — "selects WH-A over WH-B when both can fulfil the order" |
| 8 | Same completed `orderId` submitted twice → same result, one allocation, inventory deducted once | `orders.test.ts` — "returns the existing result for a duplicate orderId..." |

Concurrency (two simultaneous orders can't oversell the same warehouse) is covered separately
in `concurrency.test.ts`, and transaction rollback is covered directly in `transactions.test.ts`.

To run these against your real `MOBDB_DEV` database:

```bash
cd backend
npm install
npm run test:integration
```
