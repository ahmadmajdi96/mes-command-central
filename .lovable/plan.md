# OMS Spec Coverage — Phased Plan

Goal: cover all 56 features in the implementation spec and the 26 benchmark features. Built in 5 rounds; you review after each.

## Already covered (will be polished, not rebuilt)
Order capture/creation, modification, cancellation, search/view, customers, shipments, returns/refunds/re-order, production orders and batches, requests, notifications, audit log, dashboard charts, users/roles.

## Phase 1 — Inventory and availability (features 1–9)
- Locations (warehouses/plants) page.
- Inventory by product and location: on hand, reserved, available, status, last updated; filters by product, location, status.
- Stock movements (receipt, adjustment, transfer, issue) that update inventory.
- Incoming supply: production orders and expected receipts with dates.
- Reservations per order line (create, release, auto-expire, no double booking).
- Allocations per order line to a location (allocate, deallocate, reallocate).
- Availability check and ATP shown on new-order form and order lines.
- Supply vs demand view per product (demand, reserved, on hand, incoming, net position).

## Phase 2 — Orchestration, rules and sourcing (10–22)
- Controlled order status transitions (only legal moves allowed) with milestone history.
- Business rules screen: condition, action, priority, effective dates, history.
- Workflow settings: states and allowed transitions, editable.
- Sourcing: pick the location for each line by rules, with fallback locations and multi-location split.
- Orchestration monitor: stuck or failed steps per order.

## Phase 3 — Fulfillment (23–31)
- Fulfillments table linked to orders, lines, location; shipments linked to fulfillments.
- Partial and split fulfillment, backorders with remaining quantity tracking.
- Fulfillment status rules and tracking timeline; fulfillment monitor page.

## Phase 4 — Exceptions, returns and visibility (32–50)
- Exceptions: type, severity, owner, status, resolution, comments; monitor with aging; escalation after time limits.
- Alert rules feeding the existing notifications.
- Returns: receiving, inspection, disposition (restock/repair/quarantine/dispose), return destination routing, return shipment tracking.
- Single order view: order, lines, fulfillments, shipments, exceptions, returns, milestones in one page.
- Order and fulfillment monitoring queues (delayed, held, failed); KPI page with targets and CSV export.

## Phase 5 — Integrations (51–56)
- Endpoints for ERP, WMS, fulfillment systems and sales channels (orders in, confirmations/shipments in, instructions out).
- Message log with direction, status, retries, duplicate protection by message ID, signature check.
- Integration monitor page with retry button.

## Technical notes
- New tables: locations, inventory, inventory_movements, supply, reservations, allocations, business_rules, workflow_states/transitions, order_milestones, fulfillments, exceptions, alert_rules, integration_messages (all with RLS + permissions resources).
- Reserve/allocate via database functions with row locks for concurrency.
- Endpoints under the public API path, signed with a shared secret.
- Each new page gets its permission resource in roles.
