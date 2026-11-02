# Align OMS with APS + Command Access Hub

Based on the uploaded mapping report. This app = "MES Command Central" (system key `mes-command-central` in the Hub).

## 1. Access from the Command Access Hub (Hub only)
- Sign-in stays here (email + password), but **what each person may do comes only from the Hub**, same pattern APS uses.
- On sign-in and every few minutes, a server step asks the Hub (`/api/public/v1/access?email=…`, with this system's Hub key) for the person's roles and view/create/edit/delete rights per page.
- Those rights are copied into this app's permission tables (marked "from Hub"), so the existing database protections keep enforcing them. Settings → Roles / Users become read-only views with a "Managed in Command Access Hub" note; local role editing is switched off.
- **Fail closed:** Hub not set up, unreachable, or rejects the key → everyone can view only, a banner explains why. Person inactive / no role in Hub → no access to change anything.
- Account creation and password resets: still done here by admins (Hub can't create logins in this app), but rights come from the Hub.
- Needs two secrets from you: Hub address and the API key the Hub shows for "MES Command Central".
- The Hub currently lists only 7 generic pages for this system. I'll give you the exact list of this app's pages (orders, customers, products, inventory, fulfillments, exceptions, KPIs, integrations, quality…) to add in the Hub project; unknown pages map to nothing (no access).

## 2. Send orders to the APS planning app and receive plans back
- New connection "APS" on the Integration Monitor. When a production order is released, an outbound message goes to APS (`/api/public/integrations/oms`, format APS already accepts: po_number, sku, quantity, due_date, priority, status). Cancellations/quantity changes resend. Uses existing outbox, retries, log.
- New inbound message type `schedule.approved` from APS: approved schedule version, planned start/end, machine, sequence per production order.
- Production order gets separate states as the report recommends: release status (owned here) vs planning status: released → planned → dispatched → in progress → complete. APS can only set "planned"; it never edits quantity or order status.
- Production order page shows a "Plan from APS" panel: version, planned window, machine, and a "stale plan" warning if the order changed after approval.
- Needs: APS address and APS integration key (secrets). APS currently has no outbound sender — its team (or I, in that project) must add one; I'll document the exact payload.

## 3. Shared message format
- Every integration message gets: event_id, correlation_id, source_system, entity_id, entity_revision, occurred_at, received_at, schema_version, idempotency_key, outcome.
- Outbound messages include these; inbound accepts and stores them; duplicates rejected by idempotency_key (already deduped, extended).
- Integration Monitor: filter/search by correlation ID to follow one order across systems.
- Documentation chapter "Interface contracts & system ownership" with the ownership matrix and payload schemas.

## 4. Quality holds, nonconformance and CAPA
- **Quality holds** on batches/lots: hold, release (reason required), linked to product and order. Held batches block completing the production order and are excluded from available stock.
- **Nonconformance reports (NCR)**: from a batch, return line or QC result; severity, description, disposition (use as is / rework / scrap / return to supplier), owner, status.
- **CAPA**: root cause, corrective + preventive actions with owners and due dates, effectiveness check, close only with verification. Linked to one or more NCRs.
- Inbound QC message `qc.disposition` creates/updates holds and NCRs.
- New "Quality" sidebar section: Holds, Nonconformance, CAPA pages with cards, tables, CSV export; overdue CAPA feeds the priority queue and alerts.
- Permissions resources: quality_holds, ncr, capa (also added to Hub list).

## Technical notes
- New server module `src/lib/access-hub.server.ts` + `access-hub.functions.ts` (sync on sign-in, cached 5 min); writes `user_app_roles`/`app_role_permissions` with a `source='hub'` flag via admin client after verifying the caller's identity; `usePermissions` unchanged in shape.
- Migrations: integration_messages envelope columns; production_orders planning columns + aps_plans table; quality_holds, ncrs, capas, capa_actions with RLS via app_can_any, numbering, notify triggers, realtime; sweep_exceptions extended for overdue CAPA.
- Outbound to APS sends `x-api-key` header (APS's contract) instead of HMAC.
- Tests: Hub permission mapping (fail-closed cases), APS payload mapping, CAPA close rule.
- AGENTS.md updated with Hub-authority and envelope rules.

## What I need from you before going live
Hub address + Hub key for MES Command Central; APS address + APS integration key. I'll build everything first and ask for these at the end.
