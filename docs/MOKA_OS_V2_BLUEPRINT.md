# MÖKA OS v2 — Technical & Product Blueprint

**Status of this document**: Phase 0, read-only analysis. No code was modified, no Notion schema was touched, no data was written, nothing was deployed or committed to produce this document. All findings are grounded in direct inspection of the repository as of this session (git HEAD `5845f8f`, working tree with substantial uncommitted work described below).

---

## 1. Executive summary

MÖKA OS today is **not one application** — it is three loosely-related systems sharing a Notion workspace:

1. **The internal ops app** (`app/page.js`, 8,251 lines, one React component) — Ingredients, Stock, Supplier Orders/Receiving, Preps, Staff, Pointages, Settings, Reports, Scan Invoice, and now Recettes. PIN-gated client-side only; **zero server-side authorization**.
2. **The customer storefront** (`app/commander/**`) — online ordering, Stripe checkout, prize wheel, phone/SMS auth, served on the public `mokacafe.co` domain via a middleware allowlist.
3. **The importer subsystem** (`lib/importer/**`) — a well-architected, Zod-validated, idempotent pipeline for AddicTill/bank-statement/scan-z ingestion, entirely isolated from the other two, with the best test coverage and audit trail in the codebase.

Layered on top, three newer, well-tested service domains exist: **Stock safety** (`lib/stock/**` — idempotent receiving, no double-counting), **Architecture cleanup Phase 1** (`lib/ops/**` — canonical Supplier Orders/Ingredients/Staff/Suppliers writers), and the **Recipe Catalogue** (`lib/recipes/**` — Sold Products, Recipe Lines, theoretical consumption, now live and populated with 7 real recipes).

**The single most important fact for v2 planning**: none of MÖKA OS's operational API routes (stock, settings, supplier-orders, products, staff, recipes...) perform **any server-side authorization check**. The entire "admin mode" is a 4-digit PIN stored in `localStorage`, gating only the *client UI*. Any role-based system built on top of the current API layer would be **UI-only security** unless this is fixed first — which the user's own constraints explicitly forbid proposing.

The importer, stock-safety, and recipe layers already demonstrate the RIGHT pattern for v2 (thin route → canonical service → Zod/validation → idempotent Notion write, fully unit-tested against mocked Notion). v2's job is to extend that pattern to authorization, routines/tasks, and the remaining un-migrated CRUD (settings, preps, reports), **not** to invent a new pattern or a rewrite.

---

## 2. Current repository architecture

```
moka-os/
├── app/
│   ├── page.js                 8,251 lines — the entire internal ops app (one component)
│   ├── layout.js, globals.css
│   ├── _components/             ClientOrdersKDS.js, NewOrderAlert.js (used by page.js)
│   ├── api/                     53 route.js files (see §11)
│   ├── commander/                customer storefront (Next.js pages + _components + _lib, own Context providers)
│   ├── imports/                  staff-facing importer UI (Basic Auth gated)
│   ├── preview-commandes/        supplier restock dashboard (n8n-fed, misleadingly named)
│   └── roue/                     inert standalone prize-wheel preview page (dead code)
├── lib/
│   ├── importer/                 AddicTill/bank/scan-z pipeline — isolated, own Notion client, 18 test files
│   ├── stock/                    idempotent stock receiving/ledger — 7 test files
│   ├── ops/                      canonical Supplier Orders/Ingredients/Staff/Suppliers services — 4 test files
│   ├── recipes/                  Sold Products/Recipe Lines/consumption — 11 test files
│   └── auth/                     Basic Auth helper for /imports — 1 test file
├── scripts/                       CLI importer entry point + manual-migrations (quarantined one-off scripts)
├── migration-shopify/             historical, one-time Shopify→Notion catalogue migration tool (its own package.json)
├── docs/ARCHITECTURE.md           the living technical log of every PR/phase to date (French)
├── middleware.js                  hostname-based allowlist (mokacafe.co → /commander only)
└── moka-os/                       ⚠️ stray nested Next.js scaffold, dated ~July 4-8, untracked, unrelated to
                                      the real app — see §13 Technical Debt
```

Also present but outside the app itself: a **locked git worktree** at `.claude/worktrees/commander-fixes` (branch `fix/commander-zone2-independent-scroll`, commit `8b42cf3`) — leftover from a prior isolated agent session, never merged or cleaned up. Not touched by this audit.

**Git state**: `main` is 34 files ahead of what's committed — essentially the entire importer, stock-safety, ops-cleanup, and recipe-catalogue bodies of work described in this document exist **only in the uncommitted working tree**, not in git history. This is itself a process risk (see §13).

---

## 3. Existing modules and real implementation status

Classification key: **Production ready** (live, tested, used) · **Implemented but incomplete** (works, has known gaps) · **Foundation only** (code exists, not wired to real usage) · **Not implemented** · **Unclear** (requires live verification this phase couldn't perform).

| System | Status | Evidence |
|---|---|---|
| Document importer architecture (detect→extract→classify→validate→commit) | **Production ready** | `lib/importer/*.js`, 18 test files, `docs/ARCHITECTURE.md` PR1-PR4 |
| AddicTill importer foundations (daily summary + product ranking) | **Implemented but incomplete** | Parser/schema/tests complete (`pos-addictill.js`); **zero real AddicTill import has ever been committed** — none of the 5 importer Notion databases (Import Runs, Daily Operations, Payment Methods, Product Sales, Sales Categories) exist live in the workspace (confirmed by live search in a prior session) |
| Scan-Z importer (v3, signed preflight) | **Production ready** (code) / **Unclear** (adoption) | Full token/validation/audit-metadata pipeline, 16+ dedicated tests; gated behind `IMPORTS_SCANZ_ENABLED` (default false) — no evidence any real Z-ticket has been committed through it |
| Signed importer preflight (HMAC token) | **Production ready** | `lib/importer/notion/preflight-token.js`, dedicated test suite, documented non-single-use caveat |
| Import audit metadata | **Production ready** | `lib/importer/notion/audit-metadata.js`, bounded/truncated, tested against adversarial input |
| Blocked/failed import statuses | **Production ready** | Distinguished in `schemas.js` (`IMPORT_RUN_STATUSES`), used consistently across `commit-pipeline.js` |
| Importer isolation (never touches Stock/operational DBs) | **Production ready** | Verified structurally (own Notion client, own DB ids) and by explicit design docs |
| Supplier receiving idempotency | **Production ready** | `lib/stock/supplier-receiving.js` + `apply-addition.js`, verified live (duplicate/incompatible-unit rejection tested against real data) |
| Receipt ledger (`Applied_Receipts_Ledger`) | **Production ready** | Compact fingerprint-based, capacity-tested (bug found and fixed this project — see `docs/ARCHITECTURE.md` "Stock safety patch") |
| Receiving saga (order→lines, partial-failure-safe) | **Production ready** | `runSupplierReceivingSaga`, live-verified idempotent reruns |
| Duplicate protection (stock, recipes, sold products) | **Production ready** | Business-key + existence-check pattern, consistent across `lib/stock`, `lib/ops`, `lib/recipes` |
| Canonical business services (Supplier Orders/Ingredients/Staff/Suppliers) | **Production ready**, but **partially adopted** | `lib/ops/*.js` are the real writers for the routes the live UI actually calls; several dead/legacy routes (`/api/products/create`, `/api/settings` resource branches) still exist as delegating shims, not removed |
| Recipe Catalogue (Sold Products + Recipe Lines) | **Production ready**, **sparsely populated** | Live databases created and verified; only 7 of 95 known menu items have a Sold Product + recipe; 88 remain an explicit manual-review backlog |
| Ingredient Catalogue (`MOKA_Ingredients_Master`) | **Production ready** | Sole source of truth, 210 real ingredients, read-only from every consumer (Recipes, Stock, Purchasing) |
| Theoretical recipe consumption preview | **Production ready** | `lib/recipes/consumption-service.js`, pure/deterministic, live-verified; **never wired to any real POS sale** because Product Sales doesn't exist yet |
| Notion integrations (operational vs. importer) | **Production ready**, **architecturally split** | Two independent Notion clients (`app/api/_notion.js` vs. `lib/importer/notion/notion-client.js`) by design — never touch each other's databases |
| Staff and operational modules (Staff/Pointages/Preps) | **Implemented but incomplete** | Functional CRUD exists; zero automated tests; clock-hours logic duplicated 3× (`reports/route.js`, `reports/debug/route.js`, `clock-status/route.js`) |
| Financial and reporting foundations | **Implemented but incomplete** | `app/api/reports/route.js` aggregates Stock/Preps/Supplier-Orders/Staff/Pointages; **confirmed live bug**: stock KPI queries read Notion properties `"Quantité actuelle"`/`"Seuil minimum"`, which don't exist on the real schema (`Quantite_stock`/`Seuil_alerte`/`Seuil_critique`) — `stockCritique`/`stockAlerte` counts have likely always been empty |
| Role-based access / permission model | **Not implemented** | No file in the repository defines a role, permission, or scope concept beyond a single client-side `isAdmin` boolean |
| Routine/task engine (templates, instances, approvals) | **Not implemented** | No trace anywhere in the codebase |
| "Today" dashboard | **Not implemented** | `app/page.js`'s default view is a static KPI tile grid (Critiques/Alertes/Préparations/Commandes), not a guided next-action view |

---

## 4. Current UI and navigation structure

- **Entry point**: `app/page.js` renders the *entire* internal app — one `MokaOrderPad()` function component with ~250+ `useState` hooks and dozens of inline `useEffect`s. Navigation is a fixed bottom tab bar (`dashboard`, `products`/Produits, `inventory`, `orders`/Commandes, `clientOrders`/Clients, `reports`/Rapports, and `settings`/Paramètres — the last hidden on iPhone in favor of a small top-bar gear icon).
- **Paramètres is itself a mini-router**: a tile grid (Fournisseurs, Catégories, Sous-catégories, Unités, Zones, Staff, Sécurité, **Recettes**) opening a shared modal (`settingsPanel` state) — Recettes is deliberately a *separate*, self-contained modal (`showRecipesPanel`), not reusing the generic CRUD modal, since it needs a two-level product→lines view.
- **`app/commander/**`** is a fully separate Next.js route tree with its own Context providers (`CartContext`, `CustomerContext`, `LocationContext`) — the only place in the codebase already using React Context for shared state.
- **`app/imports/**`** is a third, separate UI surface (Basic-Auth gated), for the importer only.
- No shared layout, no shared nav component, no role concept anywhere — `isAdmin` is the only branch point, and it's binary (on/off), not role-differentiated.

---

## 5. Current authentication status

| Surface | Mechanism | Where |
|---|---|---|
| Internal ops app (`/`) admin mode | 4-digit PIN, compared client-side against `localStorage.mokaPinCode` (default `"3578"`) | `app/page.js` `unlockAdmin()` |
| `/imports` + `/api/imports/*` | HTTP Basic Auth, single shared username/password from env vars, fail-closed if unset | `lib/auth/imports-basic-auth.js`, enforced in `middleware.js` |
| `app/commander/**` (customer) | Phone number + SMS verification code (Twilio Verify), session cookie | `app/api/auth/*`, `_session.js`, `_clients.js` |
| Public domain routing | Hostname allowlist (`mokacafe.co`/`www.mokacafe.co` → `/commander` + its dependent APIs only; everything else only reachable via the `*.vercel.app` URL) | `middleware.js` |

None of these constitute **user identity** in the sense v2 needs: the admin PIN identifies "an admin," not *which* staff member; Basic Auth identifies "someone who knows the shared password," not a person; only the commander phone-auth path has a real per-user identity (`CLIENTS` records), and that's for customers, not staff.

## 6. Current authorization status

**There is no server-side authorization anywhere in the operational API surface.** Verified directly: `app/api/stock/update`, `app/api/settings/staff`, `app/api/supplier-orders`, `app/api/products/create`, and every other operational route accept and execute a request with no session/token/role check of any kind. The PIN only gates whether the *client UI renders the button* — a `curl -X DELETE .../api/settings/staff` from outside the app succeeds unconditionally (modulo the hostname allowlist, which only restricts by *domain*, not by *user*).

`middleware.js`'s allowlist is the only real access control on the non-`mokacafe.co` surface, and it's coarse: it lets through the entire `/api/*` internal surface on the `vercel.app` host, protected by nothing but obscurity of the URL.

**This is the single highest-priority gap for v2's role model to close** — see §17 and the Executive Summary.

---

## 7. Database and Notion dependency map

Two entirely separate Notion clients, by design, never sharing a database:

**Operational (`app/api/_notion.js`, hardcoded `DB` map, 15 databases):**
`STAFF`, `POINTAGES`, `INGREDIENTS`, `STOCK`, `PREPS`, `BESOINS`, `FOURNISSEURS`, `WEBSITE_PRODUCTS`, `CATEGORIES_WEBSITE`, `PROMOS`, `COMMANDES_CLIENTS`, `ROUE_CHANCE`, `CLIENTS`, `SPINS_ANONYMES`, `CARTES_ENREGISTREES` — plus 2 newer, env-var-configured additions: `NOTION_SOLD_PRODUCTS_DB_ID`, `NOTION_RECIPE_LINES_DB_ID` (`lib/recipes/config.js`, fail-closed `CONFIG_MISSING` if unset).

**Importer (`lib/importer/notion/notion-client.js`, env-var-configured, 5 databases):**
`NOTION_IMPORT_RUNS_DB_ID`, `NOTION_DAILY_OPERATIONS_DB_ID`, `NOTION_PAYMENT_METHODS_DB_ID`, `NOTION_PRODUCT_SALES_DB_ID`, `NOTION_SALES_CATEGORIES_DB_ID` — **none of these are configured in this environment**, and a prior live workspace search found no matching databases at all. The importer, as designed, is not yet receiving real production data.

**Referentiels** (categories/subcategories/units/zones): 4 more small lookup databases, hardcoded ids independent of the `DB` map, in `app/api/settings/referentiels/route.js`.

**Orphaned/legacy** (discovered live, read-only, real data): `MOKA_Recettes` (53 rows — the actual source migrated into Recipe Lines), `MOKA_Preps_Recettes` (1 empty row), `MOKA_Menu_Produits_Complet_V2` (95 rows — a rich Shopify/online-menu config database, distinct purpose from Sold Products, not adopted).

## 8. Importer map

```
File/Bank/Image
  → detect.js (magic bytes + extension, image type precision fix already applied)
  → extract.js (PDF/XLSX/CSV/image → structured buffer)
  → classify.js (rules engine, Claude fallback — untouched by scan-z, which bypasses it entirely)
  → validate.js + schemas.js (Zod, single contract for the whole pipeline)
  → commit-pipeline.js (business-key dedup, source-authority precedence, Import Runs audit)
  → 5 pilotage databases (Daily Operations/Payment Methods/Product Sales/Sales Categories) — NOT YET LIVE
```

Three source types: `credit_mutuel` bank statements (calibrated on 3 real statements), AddicTill exports (daily summary + product ranking), and scan-z (photo OCR, lowest source-authority, Daily Operations only). All three share one commit pipeline, one audit trail, one dedup mechanism. This is the best-architected subsystem in the repository and should be the **template**, not a target, for v2 refactoring.

## 9. Stock mutation map

**Exactly one write path** for additive stock changes today: `lib/stock/handle-stock-update.js` → `apply-addition.js` (idempotent, ledger-guarded) or the untouched `replace` mode (manual physical count, no idempotency by design). Three former independent implementations (ingredient-creation bootstrap, admin/sync-stock backfill, stock/update create-fallback) were consolidated into one `ensureStockRowForIngredient` (`lib/stock/ensure-stock-row.js`) during the Architecture cleanup phase.

**Confirmed**: no code path writes `Quantite_stock` outside `lib/stock/**`; Recipe Catalogue's consumption preview is read-only/pure (no `notion` parameter in its signature at all — verified by a structural test); scan-z never touches stock; POS sales never touch stock (there are none yet).

## 10. Source-of-truth analysis

| Domain | Source of truth | Notes |
|---|---|---|
| Ingredients | `MOKA_Ingredients_Master` | Single, uncontested |
| Current Stock | `STOCK` (`Quantite_stock`) | Directly mutated — **no Stock Movements ledger exists yet**; this is a known, explicitly-deferred prerequisite |
| Supplier Orders | `BESOINS` | Single, via `lib/ops/supplier-orders-service.js` |
| Sold Products / Recipes | New live databases (`lib/recipes/**`) | Sparsely populated (7/95) |
| Staff / Suppliers | `STAFF` / `FOURNISSEURS` | Contested at the *code* level (2-3 duplicate CRUD implementations per the Architecture Ownership Audit), not at the data level |
| POS sales | **Does not exist yet** | No real AddicTill import has been committed |
| Customer identity/orders | `CLIENTS` / `COMMANDES_CLIENTS` | Single, but `CLIENTS` written from 5 independent code paths with no shared invariant layer (Architecture Ownership Audit finding, not yet remediated) |

## 11. Current API map (53 routes)

Grouped by domain (full list in §2's tree via `find app/api -name route.js`):
- **Auth/session**: `auth/{send-code,verify-code,me,set-prenom,logout}`
- **Account (customer)**: `account/{card,card/save,card/setup-intent,orders,profile,rewards}`
- **Orders (customer + internal supplier)**: `orders/{ack,board,checkout,confirm,pay-saved-card,pending,send,status}` — note `orders/send` is internal supplier-order creation, not customer orders; a naming collision flagged in the prior Architecture Ownership Audit
- **Stock/Ingredients/Suppliers/Staff**: `stock`, `stock/update`, `products{,/create,/update}`, `settings{,/products,/staff,/suppliers,/referentiels{,/import}}`, `staff`, `supplier-orders{,/receive}`, `admin/sync-stock`
- **Preps**: `preps{,/create,/complete}`
- **Recipes**: `recipes/{sold-products,lines,consumption-preview}`
- **Reports**: `reports{,/chat,/debug}`
- **OCR**: `analyze-invoice{,/confirm}`, `scan-z` (legacy, likely dead)
- **Importer**: `imports/{preflight,commit,establishments}`, `imports/scan-z/{preflight,commit}`
- **Wheel**: `wheel/{eligibility,spin}`
- **Clock**: `clock`, `clock-status`

## 12. Current business service map

```
lib/importer/**   — detect/extract/classify/validate/commit-pipeline (importer domain, isolated)
lib/stock/**       — idempotency, apply-addition, ensure-stock-row, supplier-receiving, invoice-receipt, handle-stock-update
lib/ops/**          — supplier-orders-service, ingredients-service, staff-service, suppliers-service
lib/recipes/**      — sold-products-service, recipes-service, validation, units, consumption-service,
                       product-mapping-service, normalization, mapping-confidence, legacy-recipe-migration
lib/auth/**         — imports-basic-auth
```
Everything else (Preps, Reports, Account, Orders/customer, Wheel, Clock) still has its Notion property-mapping logic **inline in the route file**, not extracted to a service — the exact pattern the audit flagged and the newer domains already fixed.

## 13. Technical debt

1. **Zero server-side authorization** on the entire operational API (§6) — the highest-priority item.
2. **All work described in this document exists only in the uncommitted working tree** — `git log` shows none of the importer/stock/ops/recipes work as commits. A hardware failure or accidental `git clean` would lose it all.
3. **Stray nested scaffold** at `./moka-os/` (untracked, dated ~July 4-8, unrelated skeleton Next.js project) — dead weight, never cleaned up.
4. **Uncleaned git worktree** at `.claude/worktrees/commander-fixes` (locked, on an unmerged branch).
5. **`app/page.js` is 8,251 lines, one component** — every new admin feature (including Recettes) has had to be wedged in as more `useState`/`useEffect`/inline JSX rather than composed from smaller pieces, because there's no existing decomposition to extend.
6. **Triplicated CRUD** for Ingredients/Staff/Suppliers still partially exists (dead delegating shims kept for compatibility, not removed) — see Architecture Ownership Audit.
7. **`app/api/reports/route.js` stock KPI bug** — reads non-existent property names, silently returns empty critical/alert lists (confirmed still present).
8. **Clock-hours logic duplicated 3×** (`reports/route.js`, `reports/debug/route.js`, `clock-status/route.js`).
9. **Zero automated tests** for Preps, Settings (generic), Account, Reports, Admin, Scan-Z (legacy), Analyze-Invoice, Clock, and the entire `app/page.js` UI layer.
10. **CRM (`CLIENTS`) written from 5 independent code paths** with no shared invariant enforcement (Architecture Ownership Audit, unremediated).
11. **Legacy `/api/scan-z`** (pre-importer, no CORS handler, persists nothing) coexists with the production-grade `/api/imports/scan-z/*` — likely dead, not confirmed removable without checking live call sites.
12. **Recipe Catalogue is 7/95 populated** — real but far from complete; `product-mapping.json` (AddicTill↔Sold-Product key mapping) is empty.
13. **Importer pilotage databases don't exist live** — the most-invested-in subsystem has never processed a real production import.

## 14. Architectural risks

1. **Any v2 role/permission feature built only in the UI is theater** — without server-side checks, a role model is cosmetic. This must be Phase 1, not a later phase.
2. **Building routines/tasks on top of `app/page.js` as-is** would add another few hundred `useState` hooks to an already-8,251-line file — compounding, not fixing, the decomposition debt.
3. **Stock/Recipe/Importer domains already have divergent "canonical service" conventions** (three slightly different injectable-`notion`-client shapes) — a v2 unifying layer must reconcile these without breaking any of the extensive existing tests.
4. **Uncommitted state**: any v2 work should be committed incrementally, or the same low-durability risk simply grows larger.
5. **Two independent Notion clients** is a deliberate, good isolation boundary — a routine/task engine spanning both importer and operational domains must not be tempted to merge them; it should orchestrate across the boundary, not erase it.
6. **No real POS data yet** means the "Daily/Weekly" routines this blueprint is asked to support (AddicTill import → KPIs) are currently untestable against production reality — v2's rollout plan must sequence "get one real AddicTill import through the pipeline" before promising daily-routine automation.

---

## 15. Proposed MÖKA OS v2 domain architecture

Extend the existing domain-ownership pattern (one canonical service per domain, already proven in `lib/ops`/`lib/stock`/`lib/recipes`) with **two new cross-cutting domains** rather than a rewrite:

```
lib/
├── identity/        NEW — users, roles, active-role-per-session, permission checks
├── routines/         NEW — routine templates, task instances, lifecycle, escalation
├── importer/          existing, unchanged
├── stock/              existing, unchanged
├── ops/                existing, unchanged (+ migrate Preps/Reports property-mapping here over time)
├── recipes/            existing, unchanged
└── auth/               existing Basic Auth helper stays for /imports; extended by identity/ for everything else
```

`identity/` and `routines/` are additive — no existing service's public function signatures change. A routine's "action performed" step calls the *same* `runScanZPreflight`, `createRecipeLine`, `runSupplierReceivingSaga` etc. that already exist; it does not reimplement them.

## 16. Proposed folder and component structure

For `app/page.js`'s eventual decomposition (incremental, not a rewrite — see §31):
```
app/(ops)/
├── layout.js                 role-aware shell: nav + active-role switcher + "Today" entry
├── today/page.js              NEW — role-specific dashboard
├── stock/page.js               extracted from app/page.js's inventory section
├── recipes/page.js             extracted from the current Recettes modal (already fairly self-contained)
├── suppliers/page.js           orders/receiving
├── staff/page.js               staff + pointages
├── reports/page.js
└── settings/page.js
```
Each extraction is mechanical (move JSX + the `useState`/`useEffect` it already owns into its own file) — this blueprint does **not** propose rewriting any business logic during the move.

## 17. Proposed user, role and permission model

**Roles**: Administrator, Manager, Kitchen, Bar, Service — stored as a `roles` relation on a Staff record (reusing `STAFF`, not a new Ingredient-Catalogue-style duplicate database). A session selects one **active role** among the user's assigned roles (`identity/session.js`).

**Permissions**: capability strings exactly as specified (`stock.read`, `stock.adjust`, `recipes.edit`, `receiving.validate`, `imports.run`, ...), resolved from active role via a static role→permission map (data, not code, so it can be edited without a deploy). Every existing canonical service function gains an *optional* `actorPermissions` check at the **route** layer (not inside the service — services stay pure/testable) — e.g. `app/api/stock/update/route.js` checks `stock.adjust` before calling `handleStockUpdate`.

**Non-negotiable**: navigation-only gating is explicitly rejected per the constraints; every route above must enforce its own permission server-side, mirroring how `/imports` already enforces Basic Auth in `middleware.js` today — the mechanism is proven, just needs generalizing from "one shared password" to "per-role permission set."

## 18. Proposed "Today" dashboard architecture

`GET /api/today?role=<active>` aggregates: overdue/pending Task Instances assigned to the active role, the day's KPI snapshot (reusing `lib/importer`'s Daily Operations once populated, and `lib/recipes` consumption previews), and one clearly-highlighted **next required action** (e.g., "Import today's AddicTill summary"). Read-only aggregation only — never a second source of truth for any KPI it displays (always queries the owning domain's existing service).

## 19. Proposed routine and task engine

```
RoutineTemplate (definition: frequency, required role, steps, linked import type)
  → TaskInstance (generated per period: daily/weekly/monthly/on-demand)
      status: pending | waiting_for_document | in_progress | awaiting_validation | completed | blocked | overdue
      fields: assignedRole, assignedUserId?, dueDate, completedAt?, linkedImportRunId?, affectedDomains[], validationStatus, anomalies[], auditMetadata
  → on completion: domain update (via existing canonical services only) → KPI refresh → Audit Log entry
```
New database(s) required (not created in this phase): `Routine Templates`, `Task Instances`, `Audit Log` — kept deliberately separate from `Import Runs` (which remains the importer's own audit trail; a Task Instance may *reference* an Import Run id, never replace it).

## 20. Import-to-domain update flow

```
Document (AddicTill/bank/scan-z/invoice)
  → existing importer preflight/commit (unchanged)
  → Import Run (existing, unchanged)
  → NEW: Task Instance linked to that Import Run transitions waiting_for_document → awaiting_validation
  → human validates (existing UI patterns: /imports approval, or new Today-dashboard equivalent)
  → NEW: KPI refresh triggered (read-only re-aggregation, no new write path)
  → Task Instance → completed, Audit Log entry written
```
Stock/Recipe/Financial domains are **never written directly by the routine engine** — it only observes existing Import Runs and existing domain services' own write paths.

## 21. KPI refresh architecture

KPIs are **always computed on read**, never cached as a mutable source of truth (mirroring `lib/recipes/sold-products-service.js`'s `computeRecipeStatus`, which is deliberately never stored). A `Today`/reporting layer may cache for performance, but the cache is invalidated by "a relevant Import Run or domain write completed," never trusted as authoritative.

## 22. Notification and escalation architecture

Overdue Task Instances (`dueDate` passed, not `completed`) escalate: role-assigned notification → (after a configurable delay) manager/admin notification. Delivery channel is intentionally unspecified in this phase (existing WhatsApp/Twilio integration in `app/commander` could be reused, but that's a Phase 2+ decision, not architecture).

## 23. Idempotency requirements

Every new write path introduced by the routine engine must follow the **exact pattern already proven** in `lib/stock`/`lib/recipes`: a deterministic business key, an existence check before create, no in-memory-only tracking (Vercel is stateless). A Task Instance's business key = `(routineTemplateId, period)`; re-generating for an already-existing period must be a no-op, not a duplicate.

## 24. Audit log requirements

One durable, append-only Audit Log entry per task lifecycle transition (mirroring Import Runs' own philosophy: every attempt recorded, success or failure, never overwritten). Never conflated with `Import Runs` (importer-owned) or the Stock receipt ledger (stock-owned) — a fourth, routines-owned audit surface, referencing the others by id.

## 25. Daily user journeys

**Kitchen/Bar (Service end)**: Today dashboard shows "Import AddicTill Daily Summary" as the day's required action → opens existing `/imports` flow (or a role-scoped equivalent) → on commit, Task Instance completes → KPIs (revenue, tickets, average ticket, payment split, VAT) appear on Today, sourced from Daily Operations/Payment Methods (once populated) → theoretical stock consumption preview surfaces via existing `lib/recipes/consumption-service.js`, fed by Product Sales (once real data exists).

## 26. Weekly user journeys

**Manager**: Today/This-Week view surfaces "Import AddicTill Product Ranking" → existing product-ranking parser/schema (already implemented) → best-sellers/low-performers/trends computed read-only from Product Sales — no new importer logic needed, only the aggregation/presentation layer and the routine wrapper.

## 27. Monthly user journeys

**Administrator**: "Import Crédit Mutuel bank statement" (PR2A parser already calibrated on 3 real statements) → cash position/reconciliation status. **Inventory routine**: enter/import actual stock counts, compare against theoretical (existing `lib/recipes` consumption + existing Stock quantities) → variance/waste/breakage surfaced as **unexplained discrepancy**, never auto-labeled theft (a routine-engine business rule, not a UI string choice — the classification field itself must not have a "theft" enum value at all).

## 28. Feature status matrix

| Capability | Status |
|---|---|
| Import pipeline (parse/validate/commit) | Production ready |
| Real AddicTill/bank/scan-z data in production | Not implemented |
| Stock idempotent receiving | Production ready |
| Recipe Catalogue infrastructure | Production ready |
| Recipe Catalogue real data | Implemented but incomplete (7/95) |
| Theoretical consumption preview | Production ready (infrastructure); Unclear (never run against real sales) |
| Role/permission model | Not implemented |
| Routine/task engine | Not implemented |
| "Today" dashboard | Not implemented |
| Audit log (routines) | Not implemented |
| Server-side API authorization | Not implemented |

## 29. Recommended implementation phases

- **Phase 1 — Authorization foundation**: identity/roles/permissions, server-side enforcement on existing routes, *no new features*. Blocks everything else per the constraints already stated.
- **Phase 2 — Get one real import through**: configure the importer's 5 databases live, commit one real AddicTill Daily Summary. Without this, Daily/Weekly journeys stay hypothetical.
- **Phase 3 — Routine/Task engine (daily routine only)**: template → instance → completion → audit, wired to the Phase 2 import.
- **Phase 4 — "Today" dashboard**, weekly + monthly routines, notifications/escalation.
- **Phase 5 — `app/page.js` decomposition**, incremental, page by page, only as each domain gets a routine/role touchpoint that justifies the move.

## 30. Testing strategy

Continue the established pattern exactly: pure business logic in `lib/`, unit-tested against injectable/mocked Notion clients (never live), structural "isolation" guard tests for cross-domain boundaries (as already done for stock/scan-z/importer), and route-level tests only where a route has real conditional logic beyond delegation. New: **permission-check tests** (a request without the right permission is rejected, verified per route) and **idempotent-rerun tests** for every new routine/task write path.

## 31. Migration strategy

Strictly incremental, never a rewrite: (1) add `identity`/`routines` as new, additive `lib/` domains; (2) retrofit permission checks onto existing routes one at a time, each shippable independently; (3) extract `app/page.js` sections into their own pages only after they gain a role/routine touchpoint, never as a standalone refactor; (4) commit incrementally — every phase above should end in one or more real git commits, closing the "everything is uncommitted" risk as it goes.

## 32. Rollback strategy

Every phase is additive and independently revertible: permission checks can be feature-flagged (`PERMISSIONS_ENFORCED=false` fails open only in explicitly-approved dev/staging, never silently in production, mirroring `IMPORTS_AUTH_DISABLED`'s existing convention); routine/task tables are new databases with no existing consumer, so they can be abandoned without touching Stock/Recipes/Importer; `app/page.js` extractions should be done one page at a time behind the existing nav, so a bad extraction only affects one tab, not the whole app.

## 33. Open product questions

1. Who are the actual named users today, and what roles do they already informally hold? (No user/staff-to-role mapping exists to migrate from.)
2. Is `mokacafe.co`'s customer-facing side ever going to need a role (e.g., "Service" confirming pickup) — should the routine engine eventually span commander too, or stay ops-only?
3. What's the actual approval chain for "awaiting_validation" — does every task need a second person, or only some (e.g., inventory variance above a threshold)?
4. Is "theft" ever an intended eventual classification (by a human, after investigation), or should the system never have that concept at all, even as a manually-applied label?
5. What's the real cadence expectation — must Daily routines literally block the next day's work if incomplete, or are they best-effort reminders?

## 34. Open technical questions

1. Should the importer's 5 pilotage databases be created now (Phase 2 prerequisite), or does that require the same "authorized live Notion" pattern used in every prior phase of this project (explicit user go-ahead first)?
2. Should roles/permissions live in Notion (consistent with everything else) or in a lighter-weight config (env/JSON), given they change rarely and a Notion round-trip on every permission check would be slow without caching?
3. Does "a user may hold multiple roles" require a real login system (replacing the PIN), or can it be layered on top of the existing PIN as "PIN unlocks admin, then pick a role from your assigned set"?
4. Should Task Instances be Notion-backed (consistent with everything else, but Notion's query model is a poor fit for a scheduler/cron-like engine) or backed by something else entirely — and if something else, does that violate "no new global state library" in spirit even if not in letter?
5. What triggers Task Instance generation — a cron (Vercel Cron / external scheduler) or lazy generation-on-first-Today-dashboard-load-of-the-period? The latter fits the existing "no server-side scheduled jobs" pattern better but changes "overdue" semantics.
