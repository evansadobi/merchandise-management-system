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
                │ Procurement       │────────────(Redis Stream)───────┐
                │ Service :3002     │                                 │
                │ Procurement DB    │                                 ▼
                └──────────────────┘                        ┌──────────────────┐
                                                             │ Inventory Service │  (REST :3003)
                                                             │ Inventory DB      │
                                                             └─────────┬─────────┘
                                                                       │ StockLow
                                                                       │ (Redis Stream)
                                                                       ▼
                                                              (Procurement)

- **Solid arrows** = synchronous REST (JSON over HTTP) — the caller waits for a reply.
- **Labelled arrows** = asynchronous domain events published to Redis Streams via a consumer-group pattern (supports replay and multiple consumers; messages are only acknowledged after successful processing, so a failed consumer can retry rather than silently drop work).
- Each service owns a **private Postgres database** — no service ever queries another's database directly, per the architectural mandate. Cross-service data needs are met either by a synchronous REST call (e.g. Procurement asking Vendor for approved suppliers) or an async event (e.g. Inventory reacting to `PurchaseOrderApproved`).

As Phase 2–4 modules (Receiving, Warehouse Operations, Retail Sales, Sales Audit, Financials) are built, this diagram will extend with their REST/event connections.

## 3. Module Directory

| Module               | Directory                        | Purpose                                                                                                         | Phase          | Status                                      |
| -------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------- |
| Vendor Management    | `services/vendor-service`        | Authoritative record of suppliers, their approved products/pricing, and payment terms                           | 1 (Foundation) | Complete                                    |
| Procurement          | `services/procurement-service`   | Purchase order lifecycle, approval workflow, cost/terms locking, publishes `PurchaseOrderApproved`              | 1 (Foundation) | Complete                                    |
| Inventory            | `services/inventory-service`     | Single source of truth for stock (On Hand / Allocated / On Order), valuation, reservation, publishes `StockLow` | 1 (Foundation) | Complete                                    |
| Receiving            | `services/receiving-service`     | Validates incoming goods against POs, generates GRNs, publishes `GoodsReceived`                                 | 2 (Warehouse)  | Not started                                 |
| Warehouse Operations | `services/warehouse-ops-service` | Bin assignment, putaway/picking direction, stock transfers                                                      | 2 (Warehouse)  | Not started                                 |
| Retail Sales (POS)   | `services/retail-sales-service`  | Checkout transactions, pricing, returns, publishes `ItemSold`                                                   | 3 (Retail)     | Not started                                 |
| Sales Audit          | `services/sales-audit-service`   | Cash drawer reconciliation, publishes `DayClosed`                                                               | 3 (Retail)     | Not started                                 |
| Financials           | `services/financials-service`    | Automated ledger, accounts payable, P&L reporting                                                               | 4 (Accounting) | Not started                                 |
| Frontend             | `services/frontend`              | Unified React dashboard shell — one view per completed module, "Coming Soon" for the rest                       | —              | Vendor/Procurement/Inventory views complete |

## 4. Repository Structure

This is an npm-workspaces monorepo. The root `package.json` declares each backend service as a workspace member:

Because of the workspaces setup, dependency installs and root-level test orchestration happen with `npm ci` / `npm run <script> --workspace=services/<name>` from the repo root; day-to-day development can still be done with plain `npm run dev` from inside a service's own folder.

## 5. Local Development Setup

### Prerequisites

- Docker & Docker Compose
- Node.js 20+

### Option A — run everything via Docker Compose

```bash
docker compose up -d
```

This starts all three databases, Redis, and all three backend services together, networked via the compose file's service names (e.g. `vendor-service` reaches Postgres at `vendor-db:5432`).

### Option B — run a service locally against its containerized database (typical for active development)

```bash
# from the repo root
docker compose up vendor-db procurement-db inventory-db redis -d

# then, in separate terminals:
cd services/vendor-service && npm run dev        # :3001
cd services/procurement-service && npm run dev   # :3002
cd services/inventory-service && npm run dev     # :3003
```

### Frontend

```bash
cd services/frontend
npm run dev
```

Opens on Vite's default port (typically `http://localhost:5173`). The dashboard talks directly to each backend's REST API (`localhost:3001`/`3002`/`3003`); all three backends have CORS enabled for this.

### First-time setup: migrations

Each service manages its own schema via Drizzle ORM. If a service's `drizzle/` folder is empty, generate and it will auto-apply on next start, or run explicitly:

```bash
cd services/<service-name>
npx drizzle-kit generate
```

## 6. Feature Flag Configuration

Each service reads a boolean feature flag from its environment to enable/disable its routes (and, for services with event listeners, its subscribers). This lets incomplete modules merge to `main` safely without being reachable.

| Module            | Env Var                     | Default                                      |
| ----------------- | --------------------------- | -------------------------------------------- |
| Vendor Management | `FEATURE_VENDOR_MANAGEMENT` | `true` (enabled unless explicitly `"false"`) |
| Procurement       | `FEATURE_PROCUREMENT`       | `true`                                       |
| Inventory         | `FEATURE_INVENTORY`         | `true`                                       |

Set the relevant variable in the service's `.env` file, or in `docker-compose.yml`'s `environment:` block. When a module's flag is disabled, its API routes respond with `503 Service Unavailable`, and the frontend shows a "Coming Soon" screen for that module's tab.

## 7. Testing Instructions

Each service has its own unit and integration test suites.

### Run a single service's tests (from inside the service folder)

```bash
cd services/vendor-service      # or procurement-service / inventory-service
npm test                        # unit tests — mocked repositories, no DB required
npm run test:integration        # integration tests — real Postgres, real HTTP requests through the Express app
npm run test:all                # both, in sequence
```

### Run from the repo root (workspace-aware — same commands CI uses)

```bash
npm test --workspace=services/vendor-service
npm run test:integration --workspace=services/vendor-service
```

### What's covered

- **Unit tests** mock the repository layer and verify business logic in isolation: status-transition rules, validation, the "lock cost at PO creation" rule, reservation/allocation math, and — critically — every race-condition guard (e.g. two concurrent approvals of the same PO, over-allocating stock beyond what's on hand) is exercised with both a "clean" and a "blocked by the atomic DB guard" test case.
- **Integration tests** spin up a dedicated `_test` Postgres database per service, apply real migrations, truncate tables between tests, and issue real HTTP requests through the service's Express app (via `supertest`) — so a bug that only shows up at the SQL level (as one genuinely did during development — see below) gets caught automatically rather than requiring manual `curl` testing.

Integration tests require the relevant Postgres container (and Redis, for Procurement/Inventory) to be running first:

```bash
docker compose up vendor-db procurement-db inventory-db redis -d
```

CI runs both suites automatically on every push/PR that touches a given service's directory — see `.github/workflows/`.

## 8. API Documentation

### OpenAPI (REST)

Canonical specs live in [`contracts/openapi/`](./contracts/openapi/), one file per service. Each service also serves its own Swagger UI at runtime from a synced copy of its spec:

| Module            | Spec                                         | Swagger UI (when running)    |
| ----------------- | -------------------------------------------- | ---------------------------- |
| Vendor Management | `contracts/openapi/vendor-service.yaml`      | `http://localhost:3001/docs` |
| Procurement       | `contracts/openapi/procurement-service.yaml` | `http://localhost:3002/docs` |
| Inventory         | `contracts/openapi/inventory-service.yaml`   | `http://localhost:3003/docs` |

> **Note:** each service keeps a runtime copy of its spec inside its own folder (e.g. `services/vendor-service/openapi.yaml`) so its Docker build doesn't need to read outside its own build context. **After editing a spec in `contracts/openapi/`, re-sync the runtime copy:**
>
> ```bash
> cp contracts/openapi/<service>.yaml services/<service>/openapi.yaml
> ```

### Events (Redis Streams)

No `.proto`/gRPC contracts exist yet — all current inter-service communication is REST (sync) or Redis Streams (async). Event payloads are documented inline in each publisher/subscriber:

| Event                   | Publisher   | Consumer(s)                                             | Stream               |
| ----------------------- | ----------- | ------------------------------------------------------- | -------------------- |
| `PurchaseOrderApproved` | Procurement | Inventory (updates Quantity On Order)                   | `procurement.events` |
| `StockLow`              | Inventory   | _(none yet — planned: Procurement reorder suggestions)_ | `inventory.events`   |

Both publishers use a documented, deliberate simplification: a failed publish is logged and dropped rather than retried via an outbox pattern — see the `KNOWN LIMITATION` comment in each service's `eventPublisher.ts`.

## 9. Known Limitations

- **Event delivery is at-most-once on the publisher side.** If Redis is unreachable at the moment a `PurchaseOrderApproved` or `StockLow` event would be published, the event is logged and lost — the triggering write (e.g. the PO's `APPROVED` status) is still correctly persisted, but downstream consumers never hear about it. A production-grade fix would use a transactional outbox table with a retrying background publisher; deferred here due to project time constraints.
- **The consumer side is more resilient**: Inventory's event subscriber uses Redis Streams consumer groups and only acknowledges a message after successfully processing it, so a transient failure (e.g. the target SKU not yet existing in Inventory) leaves the message pending for retry rather than silently dropping it. A genuinely malformed message is acknowledged immediately (a "poison message" that would never succeed on retry).
- Phase 2–4 modules are not yet built; their event contracts (`GoodsReceived`, `ItemSold`, `DayClosed`) are specified in this project's brief but have no implementation yet.
