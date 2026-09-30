# Merchandise Management System (MMS)

## 1. Project Overview

Retail businesses that buy goods from suppliers, store them in a warehouse, and sell them in physical stores often run on spreadsheets, paper receipts, and manual data entry — leading to stale inventory counts, delayed payments, and no real-time visibility into profitability. Customers are told items are out of stock when they're sitting in a backroom, or items are oversold when they don't physically exist.

MMS replaces that manual chaos with a distributed, modular backend system that digitally mirrors the entire lifecycle of goods and money: from purchasing and receiving, through warehouse storage, retail sale, cash reconciliation, and automated accounting.

The system is built as a suite of small, independent backend services — not a monolith. Each service owns a single business domain and a private database, and communicates with the others only over the network, via REST (synchronous) or a Redis Streams event bus (asynchronous). Each service also ships its own frontend dashboard, and a unified React shell (`services/frontend`) presents all completed modules side by side, with "Coming Soon" placeholders for modules not yet built.

## 2. Architecture

                ┌──────────────────┐
                │  Vendor Service   │  (REST :3001)
                │  Vendor DB        │
                └─────────┬─────────┘
                          │ REST: GET /sku/{sku}/suppliers
                          │ (approved-vendor lookup)
                          ▼
                ┌──────────────────┐        PurchaseOrderApproved
                │  Procurement      │────────────(Redis Stream)───────┐
                │  Service :3002    │                                 │
                │  Procurement DB   │                                 ▼
                └─────────┬─────────┘                        ┌──────────────────┐
                          │                                  │ Inventory Service │  (REST :3003)
                          │                                  │ Inventory DB      │
                          │                                  └─────────┬─────────┘
                          │                                            │ StockLow
                          │                                            │ (Redis Stream)
                          │                                            ▼
                          │                                    (Procurement)
                          │
                          ▼
                ┌──────────────────┐        PurchaseOrderApproved
                │  Receiving        │◄───────────(Redis Stream)───────┘
                │  Service :3004    │
                │  Receiving DB     │
                └─────────┬─────────┘
                          │ REST: getPurchaseOrder, recordReceipt
                          ▼
                    (Procurement)
                          │
                          │ GoodsReceived
                          │ (Redis Stream)
                          ▼
                ┌──────────────────┐
                │  Warehouse Ops    │
                │  Service :3005    │
                │  Warehouse DB     │
                └─────────┬─────────┘
                          │ REST: getSkuAttributes (read)
                          │ REST: /api/inventory/transfer (write)
                          ▼
                    (Inventory)

- **Solid arrows** = synchronous REST (JSON over HTTP) — the caller waits for a reply.
- **Labelled arrows** = asynchronous domain events published to Redis Streams via a consumer-group pattern (supports replay and multiple consumers; messages are only acknowledged after successful processing, so a failed consumer can retry rather than silently drop work).
- Each service owns a **private Postgres database** — no service ever queries another's database directly, per the architectural mandate. Cross-service data needs are met either by a synchronous REST call (e.g. Procurement asking Vendor for approved suppliers) or an async event (e.g. Inventory reacting to `PurchaseOrderApproved`).
- **Fan-out on a single stream.** `receiving.events` is consumed by two independent consumer groups (`inventory-service-group` and `warehouse-service-group`). Receiving publishes each `GoodsReceived` event once; both downstream services react at their own pace, unaware of each other. If Warehouse Ops is down, its group lags behind while Inventory keeps consuming; when Warehouse Ops comes back, it catches up.

As Phase 3–4 modules (Retail Sales, Sales Audit, Financials) are built, this diagram will extend with their REST/event connections.

## 3. Module Directory

| Module               | Directory                       | Purpose                                                                                                         | Phase          | Status                                                                                                     |
| -------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------- |
| Vendor Management    | `services/vendor-service`       | Authoritative record of suppliers, their approved products/pricing, and payment terms                           | 1 (Foundation) | Complete                                                                                                   |
| Procurement          | `services/procurement-service`  | Purchase order lifecycle, approval workflow, cost/terms locking, publishes `PurchaseOrderApproved`              | 1 (Foundation) | Complete                                                                                                   |
| Inventory            | `services/inventory-service`    | Single source of truth for stock (On Hand / Allocated / On Order), valuation, reservation, publishes `StockLow` | 1 (Foundation) | Complete                                                                                                   |
| Receiving            | `services/receiving-service`    | Validates incoming goods against POs, generates GRNs, publishes `GoodsReceived`                                 | 2 (Warehouse)  | Complete                                                                                                   |
| Warehouse Operations | `services/warehouse-service`    | Bin hierarchy, velocity-based slotting, putaway/picking tasks, stock transfers                                  | 2 (Warehouse)  | Complete                                                                                                   |
| Retail Sales (POS)   | `services/retail-sales-service` | Checkout transactions, pricing, returns, publishes `ItemSold`                                                   | 3 (Retail)     | Complete                                                                                                   |
| Sales Audit          | `services/sales-audit-service`  | Cash drawer reconciliation, publishes `DayClosed`                                                               | 3 (Retail)     | Complete                                                                                                   |
| Financials           | `services/financials-service`   | Automated ledger, journal entries, and running balance reconciliation for sales and close-out events            | 4 (Accounting) | Complete                                                                                                   |
| Frontend             | `services/frontend`             | Unified React dashboard shell — one view per completed module, "Coming Soon" for the rest                       | —              | Vendor, Procurement, Inventory, Receiving, Warehouse, Retail Sales, Sales Audit, Financials views complete |

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

## 5. Local Development Setup

### Prerequisites

- Docker & Docker Compose
- Node.js 20+

### Option A — run everything via Docker Compose

```bash
docker compose up -d
```

This starts all seven databases, Redis, and all seven backend services together, networked via the compose file's service names (e.g. `vendor-service` reaches Postgres at `vendor-db:5432`).

### Option B — run a service locally against its containerized database (typical for active development)

```bash
# from the repo root
docker compose up \
  vendor-db procurement-db inventory-db receiving-db warehouse-db \
  retail-sales-db sales-audit-db redis -d

# then, in separate terminals:
cd services/vendor-service && npm run dev             # :3001
cd services/procurement-service && npm run dev      # :3002
cd services/inventory-service && npm run dev          # :3003
cd services/receiving-service && npm run dev          # :3004
cd services/warehouse-service && npm run dev          # :3005
cd services/retail-sales-service && npm run dev       # :3006
cd services/sales-audit-service && npm run dev        # :3007
cd services/financials-service && npm run dev        # :3008
```

### Frontend

```bash
cd services/frontend
npm run dev
```

Opens on Vite's default port (typically `http://localhost:5173`). The dashboard talks directly to each backend's REST API; all backends have CORS enabled for this.

### First-time setup: migrations

Each service manages its own schema via Drizzle ORM. If a service's `drizzle/` folder is empty, generate and it will auto-apply on next start, or run explicitly:

```bash
cd services/<service-name>
npx drizzle-kit generate
npx drizzle-kit migrate
```

## 6. Feature Flag Configuration

Each service reads a boolean feature flag from its environment to enable/disable its routes (and, for services with event listeners, its subscribers). This lets incomplete modules merge to `main` safely without being reachable.

| Module               | Env Var                     | Default                                      |
| -------------------- | --------------------------- | -------------------------------------------- |
| Vendor Management    | `FEATURE_VENDOR_MANAGEMENT` | `true` (enabled unless explicitly `"false"`) |
| Procurement          | `FEATURE_PROCUREMENT`       | `true`                                       |
| Inventory            | `FEATURE_INVENTORY`         | `true`                                       |
| Receiving            | `FEATURE_RECEIVING`         | `true`                                       |
| Warehouse Operations | `FEATURE_WAREHOUSE`         | `true`                                       |

Set the relevant variable in the service's `.env` file, or in `docker-compose.yml`'s `environment:` block. Flags follow the pattern `process.env.FEATURE_X !== "false"` — enabled unless explicitly set to the string `"false"`. When a module's flag is disabled, its API routes respond with `503 Service Unavailable`, its event subscriber does not start, and the frontend shows a "Coming Soon" screen for that module's tab.

## 7. Testing Instructions

Each service has its own unit and integration test suites.

### Run a single service's tests (from inside the service folder)

```bash
cd services/warehouse-service      # or any other service
npm test                            # unit tests — mocked repositories, no DB required
npm run test:integration            # integration tests — real Postgres, real HTTP requests
npm run test:all                    # both, in sequence (where the script exists)
```

### Run from the repo root (workspace-aware — same commands CI uses)

```bash
npm test --workspace=services/warehouse-service
npm run test:integration --workspace=services/warehouse-service
```

### What's covered

- **Unit tests** mock the repository layer and verify business logic in isolation: status-transition rules, validation, the "lock cost at PO creation" rule, reservation/allocation math, velocity-to-zone mapping, and — critically — every race-condition guard (e.g. two concurrent approvals of the same PO, over-allocating stock beyond what's on hand, completing an already-completed putaway task) is exercised with both a "clean" and a "blocked by the atomic DB guard" test case.
- **Integration tests** spin up a dedicated `_test` Postgres database per service, apply real migrations, truncate tables between tests, and issue real HTTP requests through the service's Express app (via `supertest`) — so a bug that only shows up at the SQL level gets caught automatically rather than requiring manual `curl` testing. Warehouse Ops integration tests also verify the DB-level invariant `bins.current_utilization == SUM(stock_placements.quantity)` after every task completion.

Integration tests require the relevant Postgres container (and Redis, for Procurement / Inventory / Receiving / Warehouse) to be running first:

```bash
docker compose up \
  vendor-db procurement-db inventory-db receiving-db warehouse-db redis -d
```

CI runs both suites automatically on every push/PR that touches a given service's directory — see `.github/workflows/`.

## 8. API Documentation

### OpenAPI (REST)

Canonical specs live in [`contracts/openapi/`](./contracts/openapi/), one file per service. Each service also serves its own Swagger UI at runtime from a synced copy of its spec:

| Module               | Spec                                         | Swagger UI (when running)    |
| -------------------- | -------------------------------------------- | ---------------------------- |
| Vendor Management    | `contracts/openapi/vendor-service.yaml`      | `http://localhost:3001/docs` |
| Procurement          | `contracts/openapi/procurement-service.yaml` | `http://localhost:3002/docs` |
| Inventory            | `contracts/openapi/inventory-service.yaml`   | `http://localhost:3003/docs` |
| Receiving            | `contracts/openapi/receiving-service.yaml`   | `http://localhost:3004/docs` |
| Warehouse Operations | `contracts/openapi/warehouse-service.yaml`   | `http://localhost:3005/docs` |

> **Note:** each service keeps a runtime copy of its spec inside its own folder (e.g. `services/vendor-service/openapi.yaml`) so its Docker build doesn't need to read outside its own build context. **After editing a spec in `contracts/openapi/`, re-sync the runtime copy:**
>
> ```bash
> cp contracts/openapi/<service>.yaml services/<service>/openapi.yaml
> ```

### Events (Redis Streams)

No `.proto`/gRPC contracts exist yet — all current inter-service communication is REST (sync) or Redis Streams (async). Event payloads are documented inline in each publisher/subscriber:

| Event                   | Publisher   | Consumer(s)                                                                | Stream               |
| ----------------------- | ----------- | -------------------------------------------------------------------------- | -------------------- |
| `PurchaseOrderApproved` | Procurement | Inventory (updates Quantity On Order); Receiving (knows what to expect)    | `procurement.events` |
| `GoodsReceived`         | Receiving   | Inventory (moves on-order → on-hand); Warehouse Ops (creates putaway task) | `receiving.events`   |
| `StockLow`              | Inventory   | (none yet — planned: Procurement reorder suggestions)                      | `inventory.events`   |
| `PutawayTaskCreated`    | Warehouse   | (none yet — hook for notifications or dashboards)                          | `warehouse.events`   |
| `StockPlaced`           | Warehouse   | (none yet — planned: Inventory bin-level location record)                  | `warehouse.events`   |

Each publisher uses a documented, deliberate simplification: a failed publish is logged and dropped rather than retried via an outbox pattern — see the `KNOWN LIMITATION` comment in each service's `eventPublisher.ts`.

## 9. Known Limitations

- **Event delivery is at-most-once on the publisher side.** If Redis is unreachable at the moment an event would be published, the event is logged and lost — the triggering write is still correctly persisted, but downstream consumers never hear about it. A production-grade fix would use a transactional outbox table with a retrying background publisher; deferred here due to project time constraints.
- **The consumer side is more resilient**: all subscribers use Redis Streams consumer groups and only acknowledge a message after successfully processing it, so a transient failure leaves the message pending for retry rather than silently dropping it. A genuinely malformed message is acknowledged immediately (a "poison message" that would never succeed on retry).
- **Warehouse Ops slotting is deterministic first-fit, not fully optimized.** Given a target zone, the service picks the first bin (ordered by `binCode`) with enough free capacity. Velocity affects which zone is chosen, but not which bin within that zone. A production slotting algorithm would also account for pick-path optimization, bin affinity (grouping related SKUs), and cooldown periods; deferred here.
- **Warehouse Ops falls back across zones on capacity exhaustion.** If the target zone is full, the service picks any zone with room — ordered alphabetically, so a HIGH-velocity SKU falling back from FAST may land in BULK rather than MID. This is deliberate degradation, not a bug; the API response includes a `reason` string explaining the choice.
- **Inventory's `locationId` is coarse-grained** (`"MAIN_WAREHOUSE"`, `"STORE_3_BACKROOM"`). Bin-level granularity lives entirely inside Warehouse Ops (`stock_placements` + `bins`), so Inventory does not know which bin a unit is sitting in. This is a deliberate domain boundary — Inventory answers "how much do we own?", Warehouse Ops answers "where in the building is it?".
- **Vendor `approvedBy` is captured at the UI but not persisted.** The frontend records who approved a new vendor in the success message, but the Vendor schema does not yet have an `approvedBy` column. Recording the approver identity for audit is a small future addition.
- The Phase 3–4 modules are implemented: Retail Sales publishes `ItemSold`, Sales Audit consumes it and emits `DayClosed`, and Financials consumes both streams to post accounting journal entries and maintain ledger balances.

## 10. Warehouse Operations — Design Notes

### Velocity-based slotting

The `warehouse-service` assigns each received SKU to a specific bin, choosing the zone based on the SKU's `salesVelocity` (read synchronously from Inventory):

| Velocity            | Zone | Physical meaning                 |
| ------------------- | ---- | -------------------------------- |
| HIGH                | FAST | Near shipping, minimal pick time |
| MEDIUM              | MID  | Mid-distance storage             |
| LOW                 | BULK | Deep storage, lowest priority    |
| null (unclassified) | MID  | Safe default                     |

Within the target zone, bins are selected by first-fit ordered by `binCode` — deterministic, so identical requests produce identical placements. If the target zone has no capacity, the service falls back to any zone with room; if nothing fits anywhere, the API returns `200` with `bin: null` and a `reason` string (not an error — a signal for manual intervention).

### Bin-level invariants

The database enforces that `bins.current_utilization == SUM(stock_placements.quantity)` for every bin. Both sides are updated in a single DB transaction when a putaway task completes (`completePutawayTask`), so the invariant cannot drift under concurrent completions. Integration tests verify this invariant after every task-completion scenario.

### Cross-service transfers

Moving stock between warehouses calls Inventory's atomic `POST /api/inventory/transfer` endpoint — the source decrement and destination increment happen in one transaction on Inventory's side. If any line fails, the transfer is marked `CANCELLED` and no further lines are attempted. This is the only place Warehouse Ops writes to Inventory's data, because stock movement changes the quantitative truth about who owns what — which is Inventory's domain.

### What this module does NOT do

- Does not track overall stock levels (that's Inventory).
- Does not order stock (that's Procurement).
- Does not process sales (that's POS).
- Its only truth is physical geography (zones, bins, shelves) and movement (tasks, transfers).
