# Merchandise Management System (MMS)

## 1. Project Overview

Retail businesses that buy goods from suppliers, store them in a warehouse, and sell them in physical stores often run on spreadsheets, paper receipts, and manual data entry — leading to stale inventory counts, delayed payments, and no real-time visibility into profitability. Customers are told items are out of stock when they're sitting in a backroom, or items are oversold when they don't physically exist.

MMS replaces that manual chaos with a distributed, modular backend system that digitally mirrors the entire lifecycle of goods and money: from purchasing and receiving, through warehouse storage, retail sale, cash reconciliation, and automated accounting.

The system is built as a suite of small, independent backend services — not a monolith. Each service owns a single business domain and a private database, and communicates with the others only over the network, via REST (synchronous), gRPC (synchronous, high-throughput), or a Redis Streams event bus (asynchronous). A unified React shell (`services/frontend`) presents all completed modules side by side, with "Coming Soon" placeholders for modules not yet enabled.

The system is developed in phases, gated by feature flags:

- **Phase 1 (Foundation):** Vendor Management, Procurement, Inventory
- **Phase 2 (Warehouse):** Receiving, Warehouse Operations
- **Phase 3 (Retail):** Retail Sales (POS), Sales Audit
- **Phase 4 (Accounting):** Financials

---

## 2. Architecture

```
                    ┌──────────────────────┐
                    │   Vendor Service     │  REST :3001
                    │   vendor_db          │
                    └──────────┬───────────┘
                               │ REST: GET /sku/{sku}/suppliers
                               ▼
                    ┌──────────────────────┐   PurchaseOrderApproved
                    │  Procurement Service │───────────(redis)────────┐
                    │  procurement_db      │  REST :3002             │
                    └──────────┬───────────┘                         │
                               │                                     ▼
                               │                          ┌──────────────────────┐
                               │                          │  Inventory Service   │
                               │                          │  inventory_db        │
                               │                          │  REST :3003 gRPC :50051 │
                               │                          └──────────┬───────────┘
                               │                                     │ StockLow
                               │                                     ▼
                               │                              (Procurement)
                               │
                               ▼
                    ┌──────────────────────┐   PurchaseOrderApproved
                    │  Receiving Service   │◄──────────(redis)────────┘
                    │  receiving_db        │  REST :3004
                    └──────────┬───────────┘
                               │ REST: getPurchaseOrder, recordReceipt
                               │  GoodsReceived (redis)
                               ▼
                    ┌──────────────────────┐
                    │  Warehouse Service   │  REST :3005
                    │  warehouse_db        │
                    └──────────┬───────────┘
                               │ REST: getSkuAttributes (read)
                               │ REST: /api/inventory/transfer (write)
                               ▼
                          (Inventory)

  ─────────────  PHASE 3–4 EXTENSIONS  ─────────────

                    ┌──────────────────────┐   gRPC: CheckStock / ReserveStock
                    │  Retail Sales (POS)  │──────/ CommitSale ──────► Inventory
                    │  retail_sales_db     │  REST :3006
                    └──────────┬───────────┘
                               │ ItemSold (redis)
                               ▼
                    ┌──────────────────────┐
                    │   Sales Audit        │  REST :3007
                    │   sales_audit_db     │
                    └──────────┬───────────┘
                               │ DayClosed (redis)
                               ▼
                    ┌──────────────────────┐   consumes:
                    │   Financials         │   - receiving.events (GoodsReceived)
                    │   financials_db      │   - retail-sales.events (ItemSold)
                    │   REST :3008         │   - sales-audit.events (DayClosed)
                    └──────────────────────┘
```

- **Solid arrows** = synchronous REST (JSON over HTTP) — the caller waits for a reply.
- **`(redis)` arrows** = asynchronous domain events published to Redis Streams via a consumer-group pattern (supports replay and multiple consumers; messages are only acknowledged after successful processing, so a failed consumer can retry rather than silently drop work).
- **gRPC (`:50051`)** = the POS → Inventory stock check is the one interaction the spec explicitly names for gRPC, because checkout is a live, latency-sensitive transaction.
- Each service owns a **private Postgres database** — no service ever queries another's database directly, per the architectural mandate.
- **Fan-out on a single stream.** `receiving.events` is consumed by two independent consumer groups (`inventory-service-group` and `warehouse-service-group`). Receiving publishes each `GoodsReceived` event once; both downstream services react at their own pace, unaware of each other. If Warehouse Ops is down, its group lags behind while Inventory keeps consuming; when Warehouse Ops comes back, it catches up.

---

## 3. Module Directory

| Module               | Directory                       | Purpose                                                                                                                    | Phase | Status                   |
| -------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------ |
| Vendor Management    | `services/vendor-service`       | Authoritative record of suppliers, approved products/pricing, payment terms                                                | 1     | Complete                 |
| Procurement          | `services/procurement-service`  | Purchase order lifecycle, approval workflow, cost/terms locking, publishes `PurchaseOrderApproved`                         | 1     | Complete                 |
| Inventory            | `services/inventory-service`    | Single source of truth for stock (On Hand / Allocated / On Order), valuation, reservations over gRPC, publishes `StockLow` | 1     | Complete                 |
| Receiving            | `services/receiving-service`    | Validates incoming goods against POs, generates GRNs, publishes `GoodsReceived`                                            | 2     | Complete                 |
| Warehouse Operations | `services/warehouse-service`    | Bin hierarchy, velocity-based slotting, putaway/picking tasks, stock transfers                                             | 2     | Complete                 |
| Retail Sales (POS)   | `services/retail-sales-service` | Checkout transactions over gRPC to Inventory, pricing, returns, publishes `ItemSold`                                       | 3     | Complete                 |
| Sales Audit          | `services/sales-audit-service`  | Cash drawer reconciliation, sign-off workflow, publishes `DayClosed`                                                       | 3     | Complete                 |
| Financials           | `services/financials-service`   | Automated ledger, journal entries, accounts payable, P&L, consumes `GoodsReceived` / `ItemSold` / `DayClosed`              | 4     | Complete                 |
| Frontend             | `services/frontend`             | Unified React dashboard shell — one view per module, "Coming Soon" for disabled flags                                      | —     | All 8 module views built |

---

## 4. Repository Structure

This is an npm-workspaces monorepo. The root `package.json` declares each backend service as a workspace member:

```json
"workspaces": [
  "services/vendor-service",
  "services/procurement-service",
  "services/inventory-service",
  "services/receiving-service",
  "services/warehouse-service",
  "services/retail-sales-service",
  "services/sales-audit-service",
  "services/financials-service"
]
```

Because of the workspaces setup, dependency installs and root-level test orchestration happen with `npm ci` / `npm run <script> --workspace=services/<name>` from the repo root; day-to-day development can still be done with plain `npm run dev` from inside a service's own folder.

### Top-level layout

```
mms-platform/
├── contracts/
│   ├── openapi/          # canonical OpenAPI specs, one per service
│   └── proto/            # gRPC contracts (inventory.proto)
├── services/
│   ├── vendor-service/
│   ├── procurement-service/
│   ├── inventory-service/
│   ├── receiving-service/
│   ├── warehouse-service/
│   ├── retail-sales-service/
│   ├── sales-audit-service/
│   ├── financials-service/
│   └── frontend/         # unified React dashboard (Vite)
├── docs/
│   └── demo-scenarios.md # 5 end-to-end walkthroughs
├── .github/
│   └── workflows/        # one CI workflow per service
├── docker-compose.yml
└── README.md
```

---

## 5. Port Map

| Service              | HTTP | gRPC      | DB (host) | Container                  |
| -------------------- | ---- | --------- | --------- | -------------------------- |
| Vendor Management    | 3001 | —         | 5435      | `mms_vendor_service`       |
| Procurement          | 3002 | —         | 5433      | `mms_procurement_service`  |
| Inventory            | 3003 | **50051** | 5434      | `mms_inventory_service`    |
| Receiving            | 3004 | —         | 5436      | `mms_receiving_service`    |
| Warehouse Operations | 3005 | —         | 5437      | `mms_warehouse_service`    |
| Retail Sales         | 3006 | —         | 5438      | `mms_retail_sales_service` |
| Sales Audit          | 3007 | —         | 5439      | `mms_sales_audit_service`  |
| Financials           | 3008 | —         | 5440      | `mms_financials_service`   |
| Frontend (Vite)      | 5173 | —         | —         | (host dev server)          |
| Redis broker         | 6379 | —         | —         | `mms_redis_broker`         |

---

## 6. Local Development Setup

### Prerequisites

- Docker & Docker Compose
- Node.js 20+

### Option A — run everything via Docker Compose

```bash
docker compose up -d --build
```

This starts all eight databases, Redis, and all eight backend services together, networked via the compose file's service names (e.g. `vendor-service` reaches Postgres at `vendor-db:5432`).

Check status:

```bash
docker compose ps
docker compose logs -f retail-sales-service
```

### Option B — run a service locally against its containerized database (typical for active development)

```bash
# from the repo root
docker compose up \
  vendor-db procurement-db inventory-db receiving-db warehouse-db \
  retail-sales-db sales-audit-db financials-db \
  redis -d

# then, in separate terminals:
cd services/vendor-service && npm run dev             # :3001
cd services/procurement-service && npm run dev        # :3002
cd services/inventory-service && npm run dev          # :3003 + gRPC :50051
cd services/receiving-service && npm run dev          # :3004
cd services/warehouse-service && npm run dev          # :3005
cd services/retail-sales-service && npm run dev       # :3006
cd services/sales-audit-service && npm run dev        # :3007
cd services/financials-service && npm run dev         # :3008
```

### Frontend

```bash
cd services/frontend
npm run dev
```

Opens on Vite's default port (typically `http://localhost:5173` or `http://localhost:5174`). The dashboard talks directly to each backend's REST API; all backends have CORS enabled.

### First-time setup: migrations

Each service manages its own schema via Drizzle ORM. Generate and apply per service:

```bash
cd services/<service-name>
npx drizzle-kit generate     # creates drizzle/000X_*.sql
npx drizzle-kit migrate      # applies to the running DB
```

If `drizzle/` already contains committed migrations, only the `migrate` step is needed.

### Seed data (optional, for demo)

Insert the six standard ledger accounts in Financials:

```bash
docker compose exec financials-db psql -U postgres -d financials_db -c "
INSERT INTO financial_ledgers (ledger_id, name, type, currency, balance) VALUES
  ('SALES_REVENUE',    'Sales Revenue',       'REVENUE',   'KES', 0),
  ('COGS',             'Cost of Goods Sold',  'EXPENSE',   'KES', 0),
  ('INVENTORY_ASSET',  'Inventory Asset',     'ASSET',     'KES', 0),
  ('ACCOUNTS_PAYABLE', 'Accounts Payable',    'LIABILITY', 'KES', 0),
  ('CASH',             'Cash on Hand',        'ASSET',     'KES', 0),
  ('CASH_OVER_SHORT',  'Cash Over / Short',   'EXPENSE',   'KES', 0);
"
```

Seed a test inventory row for POS testing:

```bash
docker compose exec inventory-db psql -U postgres -d inventory_db -c "
INSERT INTO inventory_items (product_name, sku, location_id, quantity_on_hand, quantity_allocated, unit_value, reorder_level) VALUES
  ('Premium Coffee', 'SKU-100', 'MAIN_WAREHOUSE', 100, 0, '320.00', 10),
  ('Energy Drink',   'SKU-230', 'MAIN_WAREHOUSE', 150, 0, '240.00', 10),
  ('Fresh Bread',    'SKU-410', 'MAIN_WAREHOUSE', 80,  0, '180.00', 10),
  ('Rice 2kg',       'SKU-520', 'MAIN_WAREHOUSE', 60,  0, '440.00', 10),
  ('Toilet Soap',    'SKU-700', 'MAIN_WAREHOUSE', 200, 0, '120.00', 10);
"
```

---

## 7. Feature Flag Configuration

Each service reads a boolean feature flag from its environment to enable/disable its routes (and, for services with event listeners, its subscribers). This lets incomplete modules merge to `main` safely without being reachable.

| Module               | Env Var                     | Default |
| -------------------- | --------------------------- | ------- |
| Vendor Management    | `FEATURE_VENDOR_MANAGEMENT` | `true`  |
| Procurement          | `FEATURE_PROCUREMENT`       | `true`  |
| Inventory            | `FEATURE_INVENTORY`         | `true`  |
| Receiving            | `FEATURE_RECEIVING`         | `true`  |
| Warehouse Operations | `FEATURE_WAREHOUSE`         | `true`  |
| Retail Sales (POS)   | `FEATURE_RETAIL_SALES`      | `true`  |
| Sales Audit          | `FEATURE_SALES_AUDIT`       | `true`  |
| Financials           | `FEATURE_FINANCIALS`        | `true`  |

Flags follow the pattern `process.env.FEATURE_X !== "false"` — enabled unless explicitly set to the string `"false"`. Set the variable in the service's `.env` file or in `docker-compose.yml`'s `environment:` block.

When a module's flag is disabled:

- Its HTTP routes respond with `503 Service Unavailable`.
- Its event subscriber does not start.
- The frontend shows a "Coming Soon" screen for that module's tab.

---

## 8. Testing Instructions

Each service has its own unit and integration test suites.

### Run a single service's tests (from inside the service folder)

```bash
cd services/warehouse-service      # or any other service
npm test                            # unit tests — mocked repositories, no DB required
npm run test:integration            # integration tests — real Postgres, real HTTP requests
npm run test:all                    # both, in sequence (where the script exists)
```

### Run from the repo root (workspace-aware)

```bash
npm test --workspace=services/warehouse-service
npm run test:integration --workspace=services/warehouse-service
```

### Run everything with one command

```bash
bash docs/run-all-tests.sh
```

This loops through every service, runs unit + integration, and prints a PASS/FAIL summary.

### What's covered

- **Unit tests** mock the repository layer and verify business logic in isolation: status-transition rules, validation, the "lock cost at PO creation" rule, reservation/allocation math, velocity-to-zone mapping, and every race-condition guard (e.g. two concurrent approvals of the same PO, over-allocating stock beyond what's on hand, completing an already-completed putaway task) — each exercised with both a "clean" and a "blocked by the atomic DB guard" test case.
- **Integration tests** spin up a dedicated `_test` Postgres database per service, apply real migrations, truncate tables between tests, and issue real HTTP requests through the service's Express app (via `supertest`) — so a bug that only shows up at the SQL level gets caught automatically. Warehouse Ops integration tests also verify the DB-level invariant `bins.current_utilization == SUM(stock_placements.quantity)` after every task completion. POS integration tests exercise the gRPC reserve → commit → `ItemSold` publish path end-to-end.

Integration tests require the relevant Postgres container (and Redis, for services that use events) to be running first:

```bash
docker compose up \
  vendor-db procurement-db inventory-db receiving-db warehouse-db \
  retail-sales-db sales-audit-db financials-db \
  redis -d
```

CI runs both suites automatically on every push/PR that touches a given service's directory — see `.github/workflows/`.

---

## 9. API Documentation

### OpenAPI (REST)

Canonical specs live in [`contracts/openapi/`](./contracts/openapi/), one file per service. Each service also serves its own Swagger UI at runtime from a synced copy of its spec:

| Module               | Spec                                          | Swagger UI                   |
| -------------------- | --------------------------------------------- | ---------------------------- |
| Vendor Management    | `contracts/openapi/vendor-service.yaml`       | `http://localhost:3001/docs` |
| Procurement          | `contracts/openapi/procurement-service.yaml`  | `http://localhost:3002/docs` |
| Inventory            | `contracts/openapi/inventory-service.yaml`    | `http://localhost:3003/docs` |
| Receiving            | `contracts/openapi/receiving-service.yaml`    | `http://localhost:3004/docs` |
| Warehouse Operations | `contracts/openapi/warehouse-service.yaml`    | `http://localhost:3005/docs` |
| Retail Sales (POS)   | `contracts/openapi/retail-sales-service.yaml` | `http://localhost:3006/docs` |
| Sales Audit          | `contracts/openapi/sales-audit-service.yaml`  | `http://localhost:3007/docs` |
| Financials           | `contracts/openapi/financials-service.yaml`   | `http://localhost:3008/docs` |

> **Note:** each service keeps a runtime copy of its spec inside its own folder (e.g. `services/vendor-service/openapi.yaml`) so its Docker build doesn't need to read outside its own build context. **After editing a spec in `contracts/openapi/`, re-sync the runtime copy:**
>
> ```bash
> cp contracts/openapi/<service>.yaml services/<service>/openapi.yaml
> ```

### Protobuf (gRPC)

The POS → Inventory stock check runs over gRPC — the one interaction the spec explicitly names for this protocol, because checkout is a live, latency-sensitive transaction.

- **Contract:** `contracts/proto/inventory.proto`
- **Package:** `mms.inventory.v1`
- **Service:** `InventoryService`
- **RPCs:** `CheckStock`, `BatchCheckStock`, `ReserveStock`, `ReleaseReservation`, `CommitSale`
- **Server:** `services/inventory-service/src/grpc/inventoryGrpcServer.ts` — listens on `:50051`
- **Client:** `services/retail-sales-service/src/grpc/InventoryGrpcClient.ts`

Smoke test:

```bash
grpcurl -plaintext localhost:50051 list
grpcurl -plaintext -d '{"sku":"SKU-100","locationId":"MAIN_WAREHOUSE","requestedQuantity":1}' \
  localhost:50051 mms.inventory.v1.InventoryService/CheckStock
```

### Events (Redis Streams)

Event payloads are documented inline in each publisher/subscriber. Each publisher uses a deliberate simplification — a failed publish is logged and dropped rather than retried via an outbox pattern (see §11 Known Limitations).

| Event                   | Publisher    | Consumer(s)                                                                                                   | Stream                |
| ----------------------- | ------------ | ------------------------------------------------------------------------------------------------------------- | --------------------- |
| `PurchaseOrderApproved` | Procurement  | Inventory (updates Quantity On Order); Receiving (knows what to expect)                                       | `procurement.events`  |
| `GoodsReceived`         | Receiving    | Inventory (moves on-order → on-hand); Warehouse Ops (creates putaway task); Financials (inventory asset + AP) | `receiving.events`    |
| `StockLow`              | Inventory    | (planned: Procurement reorder suggestions)                                                                    | `inventory.events`    |
| `PutawayTaskCreated`    | Warehouse    | (hook for notifications or dashboards)                                                                        | `warehouse.events`    |
| `StockPlaced`           | Warehouse    | (planned: Inventory bin-level location record)                                                                | `warehouse.events`    |
| `ItemSold`              | Retail Sales | Sales Audit (expected register totals); Financials (revenue + COGS + inventory asset decrease)                | `retail-sales.events` |
| `DayClosed`             | Sales Audit  | Financials (Cash Over/Short expense)                                                                          | `sales-audit.events`  |

Inspect any stream at runtime:

```bash
docker compose exec redis redis-cli XLEN procurement.events
docker compose exec redis redis-cli XRANGE procurement.events - +
docker compose exec redis redis-cli XLEN retail-sales.events
docker compose exec redis redis-cli XRANGE retail-sales.events - +
```

---

## 10. End-to-End Demo Scenarios

The system's five real-world business scenarios are documented with UI actions and curl/grpcurl commands in [`docs/demo-scenarios.md`](./docs/demo-scenarios.md):

1. **Place a Purchase Order** — Buyer selects a vendor and SKU; PO is created, approved, and `PurchaseOrderApproved` fires. Inventory increments On Order; Receiving records an expected delivery.
2. **Truck Arrives at the Dock** — Receiving validates the PO, records shortages/overages/damage, and generates a GRN. `GoodsReceived` fires. Inventory moves on-order to on-hand. Warehouse Ops creates a putaway task.
3. **Store the Goods** — Warehouse Ops suggests a bin based on the SKU's velocity and directs the worker. Placement is recorded; the bin-level invariant holds.
4. **A Customer Buys an Item** — POS calls Inventory over gRPC to reserve stock, completes the sale, publishes `ItemSold`. Sales Audit adds to expected register totals; Financials books Revenue + COGS + inventory decrement.
5. **Close the Store for the Night** — Store Manager enters the physical cash count; Sales Audit computes the variance and requires a reason if it isn't zero. `DayClosed` fires. Financials books Cash Over/Short.

A shell script (`docs/smoke-test.sh`) runs all five scenarios against the running stack and prints `ALL SCENARIOS PASSED` or a failure report.

---

## 11. Known Limitations

- **Event delivery is at-most-once on the publisher side.** If Redis is unreachable when an event would be published, the event is logged and lost — the triggering write is still correctly persisted, but downstream consumers never hear about it. A production-grade fix uses a transactional outbox table with a retrying background publisher; deferred here due to project time constraints.
- **The consumer side is more resilient.** All subscribers use Redis Streams consumer groups and only acknowledge a message after successfully processing it, so a transient failure leaves the message pending for retry. A genuinely malformed message is acknowledged immediately (a "poison message" that would never succeed on retry).
- **Warehouse Ops slotting is deterministic first-fit, not fully optimized.** Given a target zone, the service picks the first bin (ordered by `binCode`) with enough free capacity. Velocity affects which zone is chosen, but not which bin within that zone. A production slotting algorithm would also account for pick-path optimization, bin affinity, and cooldown periods; deferred here.
- **Warehouse Ops falls back across zones on capacity exhaustion.** If the target zone is full, the service picks any zone with room — ordered alphabetically, so a HIGH-velocity SKU falling back from FAST may land in BULK rather than MID. This is deliberate degradation, not a bug; the API response includes a `reason` string explaining the choice.
- **Inventory's `locationId` is coarse-grained** (`"MAIN_WAREHOUSE"`, `"STORE_3_BACKROOM"`). Bin-level granularity lives entirely inside Warehouse Ops (`stock_placements` + `bins`), so Inventory does not know which bin a unit is sitting in. This is a deliberate domain boundary — Inventory answers "how much do we own?", Warehouse Ops answers "where in the building is it?".
- **Vendor `approvedBy` is captured at the UI but not persisted.** The frontend records who approved a new vendor in the success message, but the Vendor schema does not yet have an `approvedBy` column. Recording the approver identity for audit is a small future addition.
- **Financials is single-currency.** All amounts assume KES; multi-currency conversion and FX rate tracking are out of scope for this build.

---

## 12. Design Notes

### Velocity-based slotting (Warehouse Ops)

The `warehouse-service` assigns each received SKU to a specific bin, choosing the zone based on the SKU's `salesVelocity` (read synchronously from Inventory):

| Velocity | Zone | Physical meaning                 |
| -------- | ---- | -------------------------------- |
| HIGH     | FAST | Near shipping, minimal pick time |
| MEDIUM   | MID  | Mid-distance storage             |
| LOW      | BULK | Deep storage, lowest priority    |
| null     | MID  | Safe default                     |

Within the target zone, bins are selected by first-fit ordered by `binCode` — deterministic, so identical requests produce identical placements. If the target zone has no capacity, the service falls back to any zone with room; if nothing fits anywhere, the API returns `200` with `bin: null` and a `reason` string (not an error — a signal for manual intervention).

### Bin-level invariants

The database enforces that `bins.current_utilization == SUM(stock_placements.quantity)` for every bin. Both sides are updated in a single DB transaction when a putaway task completes, so the invariant cannot drift under concurrent completions. Integration tests verify this invariant after every task-completion scenario.

### Cross-service transfers

Moving stock between warehouses calls Inventory's atomic `POST /api/inventory/transfer` endpoint — the source decrement and destination increment happen in one transaction on Inventory's side. If any line fails, the transfer is marked `CANCELLED` and no further lines are attempted. This is the only place Warehouse Ops writes to Inventory's data, because stock movement changes the quantitative truth about who owns what — which is Inventory's domain.

### Sale-aware reservations (POS ↔ Inventory)

The POS does not use the legacy quantity-based reservation endpoints. Instead, it calls `ReserveStock(saleId, sku, locationId, quantity)` over gRPC, which:

1. Is **idempotent** on `(saleId, sku, locationId)` — a retry after a network blip returns the existing reservation rather than double-allocating.
2. Records a row in `inventory_reservations` so the reservation is traceable back to the sale that created it.
3. On payment success, POS calls `CommitSale(saleId, ...)` — which atomically decrements On Hand and releases the allocation, in one transaction.

The `saleId` is what makes the flow crash-safe: if the cashier's terminal dies between reserve and commit, the `saleId` lets Inventory reconcile the abandoned reservation (release it) rather than leave stock permanently allocated.

### Domain boundaries — what each module does NOT do

- **Vendor** does not decide when to order; it records who can supply.
- **Procurement** does not handle physical arrival; it records what was ordered.
- **Receiving** does not store goods; it records what physically arrived.
- **Inventory** does not decide bin placement; it records how much is owned and where (coarse-grained).
- **Warehouse Ops** does not track overall quantity; it tracks physical geography and movement.
- **POS** does not reconcile the drawer; it records what was sold.
- **Sales Audit** does not process sales; it reconciles what the POS recorded against what was counted.
- **Financials** does not count inventory or sell; it translates physical events into double-entry accounting.

---

## 13. Development Workflow

Per the capstone spec:

- **Monorepo:** all services under `services/`, all contracts under `contracts/`.
- **Feature flags:** every module gated by `FEATURE_<MODULE>=true|false`.
- **Branches:** `feat/<name>`, `fix/<name>`, `docs/<name>`. No direct pushes to `main`.
- **PR scope:** one module or one significant feature per PR. Small commits.
- **Merge gate:** tests pass + API docs updated + feature flag configured + README updated.
- **Definition of Done:** source in the correct directory + feature flag implemented + PR opened + OpenAPI/`.proto` updated + unit AND integration tests pass in CI + README reflects status.

CI runs on GitHub Actions with one workflow per service under `.github/workflows/`.

---

## 14. Tech Stack

| Layer          | Choice                                        |
| -------------- | --------------------------------------------- |
| Runtime        | Node.js 20+                                   |
| Language       | TypeScript (ESM, NodeNext)                    |
| HTTP framework | Express 5                                     |
| ORM            | Drizzle ORM + `pg`                            |
| Migrations     | drizzle-kit                                   |
| Event bus      | Redis Streams (ioredis)                       |
| Sync RPC       | gRPC (`@grpc/grpc-js` + `@grpc/proto-loader`) |
| Validation     | Zod                                           |
| API docs       | OpenAPI 3 + `swagger-ui-express`              |
| Testing        | Vitest + supertest                            |
| Frontend       | Vite + React + TypeScript                     |
| Containers     | Docker Compose                                |
| CI             | GitHub Actions                                |
