# finance-yanti

Internal **project-budget / expense tracker**. Staff record spendings against projects and
categories; every spending draws down its own project's balance (topped up by admins); receipts
upload to object storage; every mutation is audit-logged. Indonesian Rupiah (IDR), admin/staff roles.

Serverless-first on **Cloudflare** — no Docker, no CI/CD, no `scripts/` dir.

## Stack

- **Monorepo:** pnpm 9.15 workspaces + Turborepo. Node >=22. TypeScript 5.8 strict
  (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`).
- **API:** Hono 4 on Cloudflare Workers. Drizzle ORM over Cloudflare D1 (SQLite). R2 for receipts.
- **Web:** Next.js 15 (React 19, App Router) → Cloudflare via **OpenNext** (`@opennextjs/cloudflare`).
  shadcn/Radix + Tailwind 4, react-hook-form + zod, TanStack Table, sonner toasts.
- **Validation:** zod schemas shared between web and API (`packages/shared`).
- **Tests:** Vitest. **Format:** Prettier (double quotes, trailing commas, width 100). No ESLint config beyond `next lint`.

## Layout

```
apps/api        Hono Workers API   (@repo/api)
apps/web        Next.js frontend   (@repo/web)
packages/db     Drizzle schema + D1 client + migrations + seed   (@repo/db)
packages/shared zod schemas, RBAC, money, types, constants       (@repo/shared)
```

Workspace deps use `workspace:*`. `@repo/db` and `@repo/shared` build to `dist/` and are imported by the apps.

## Commands

Run from repo root (Turbo fans out):

```bash
pnpm install
pnpm dev          # all packages in parallel (api=wrangler dev --remote, web=next dev)
pnpm build        # turbo build (respects ^build dep graph)
pnpm typecheck    # tsc --noEmit everywhere
pnpm test         # vitest run
pnpm format       # prettier --write
```

Per-package (cd into the dir or `pnpm --filter`):

```bash
# apps/api
pnpm dev                     # wrangler dev --remote (uses REMOTE D1/R2 — prod data)
pnpm dev:local               # wrangler dev (local emulated D1/R2)
pnpm deploy                  # wrangler deploy
pnpm build                   # tsc + wrangler deploy --dry-run

# packages/db
pnpm generate                # drizzle-kit generate (schema.ts -> migrations/)
pnpm migrate:local | migrate:remote
pnpm seed:local              # creates admin user (see seed.ts)
pnpm studio                  # drizzle-kit studio

# apps/web
pnpm dev | build             # next dev | next build  (deploy via OpenNext, see Gotchas)
```

## Architecture

### apps/api (`src/`)
- `index.ts` — Hono app: `errorMiddleware` → CORS (credentials, `X-CSRF-Token`) → routers.
  Routes: `/auth /users /projects /categories /spendings /receipts /exports /health`
  (project balance + top-up live under `/projects/:id/balance` and `/projects/:id/topup`).
  Dev-only `/admin/seed` guarded by `ENVIRONMENT !== "development"`.
- `middleware/` — `auth.ts`: `dbMiddleware` (attach Drizzle client), `authMiddleware`
  (verify JWT cookie + CSRF on mutations, re-fetch user, block disabled), `adminMiddleware`
  (role guard). `error.ts`: global exception → JSON.
- `routes/` — one Hono router per entity. Admin-only: users, projects, categories, project top-up.
  Auth-only: spendings, receipts, exports.
- `services/projectBalance.ts` — per-project ledger core: `getProjectBalance()` (O(1), reads the
  project's latest mutation's cached `balanceAfterIdr`, ordered by `rowid`), `computeSpendingMutation()`
  (validate balance, build "out" row; accepts a `knownBalanceIdr` so an edit can chain off its own
  in-batch reversal), `buildReversalMutation()` (on edit/void), `buildTopupMutation()` (admin top-up).
- `lib/` — homebrew security (no external auth lib): `jwt.ts` (HS256 via WebCrypto, 7-day TTL),
  `csrf.ts`, `crypto.ts` (PBKDF2-SHA256, 100k iters), `audit.ts` (write audit log), `r2.ts`
  (presigned receipt upload URLs).
- `types/env.ts` — Workers `Env` bindings: `DB`, `RECEIPTS_BUCKET`, `JWT_SECRET`, `CSRF_SECRET`,
  `ENVIRONMENT`, `CORS_ORIGIN`.

### apps/web (`src/`)
- `app/(auth)/` login, change-password. `app/(dashboard)/` dashboard, projects, projects/[id],
  spendings, categories, users, settings.
- `app/api/proxy/[...path]/route.ts` — server-side proxy to the Workers API (CORS/credential isolation).
- `context/auth.tsx` — `AuthProvider` + `useAuth()`; calls `/auth/me` on mount.
- `middleware.ts` — route guard; redirects unauthenticated users to `/login` (`PUBLIC_PATHS`).
- `lib/api.ts` — typed API client (`api.auth.*`, `api.spendings.*`, …); CSRF header + `credentials: include`.
- `components/ui/` — shadcn primitives. `components/layout/sidebar.tsx` — role-based nav.

### packages/shared (`src/`)
- `schemas/` — zod: `auth.ts`, `projects.ts` (incl. `topupProjectSchema`), `spendings.ts`.
- `permissions.ts` — RBAC helpers (`canEditSpending`, `canVoidSpending`, …): author + admin rules.
- `money.ts` — `formatIDR()`. `constants.ts` — roles, statuses, receipt MIME types.
- `types.ts` — shared domain interfaces. All re-exported from `index.ts`.

### packages/db (`src/`)
- `schema.ts` — Drizzle SQLite tables: `users`, `projects`, `categories`, `spendings`,
  `project_balance_mutations`, `audit_logs`. Indexed on FKs, codes, dates, `voidedAt`.
- `client.ts` — `createDb(d1)` factory. `seed.ts` — `seedAdmin()` bootstrap admin.
- `migrations/0001_initial_schema.sql`. `drizzle.config.ts` — `d1-http` driver, reads
  `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_D1_DATABASE_ID` / `CLOUDFLARE_D1_TOKEN`.

## Data model & domain rules

- IDs = `crypto.randomUUID()` strings. Timestamps = ISO strings. **Amounts = integer IDR** (no
  decimals, no floats — always integer math).
- DB columns `snake_case`; TS types `PascalCase`; functions `camelCase`; routes/files `kebab-case`.
- **Each project has its own balance.** Every spending/void/top-up writes `project_balance_mutations`
  rows (`direction` in/out, scoped by `project_id`) carrying the running `balanceAfterIdr` for O(1)
  balance reads. A spending's full amount is deducted from its project; creating one requires
  sufficient project balance (422 otherwise). Admins top up a project via `POST /projects/:id/topup`.
- Spendings are **soft-deleted via void** (`voidedAt/voidedBy/voidReason` + reversal mutations), never hard-deleted.
- Receipts: presigned-URL upload to R2; metadata (`receiptObjectKey`, name, type, size) stored on the spending row.
- Every create/update/void calls `writeAuditLog()` with before/after JSON.

## Infra (Cloudflare)

| Resource | Value | Where |
|---|---|---|
| API Worker | `financing-app-api` | `apps/api/wrangler.jsonc` |
| Web Worker | `financing-app-web` | `apps/web/wrangler.jsonc` |
| D1 binding `DB` | name `financing-app`, id `47a8483c-4fcf-46f6-bb74-b5c9f8049d3f` | `apps/api/wrangler.jsonc` |
| R2 binding `RECEIPTS_BUCKET` | `financing-app-receipts` | `apps/api/wrangler.jsonc` |
| Secrets | `JWT_SECRET`, `CSRF_SECRET` (≥32 chars) | `apps/api/.dev.vars` (gitignored), prod via `wrangler secret` |
| Domain | `*.christianviali0.workers.dev` | wrangler vars |

Local dev secrets: `cp apps/api/.dev.vars.example apps/api/.dev.vars` and fill in.
Deploy: `pnpm --filter @repo/api deploy` (API). Web deploys through OpenNext build → `wrangler deploy`.

## Gotchas

- **`apps/web` has no `deploy` script.** Web ships via OpenNext (`@opennextjs/cloudflare`) →
  `.open-next/worker.js` → `wrangler deploy`, run manually, not `pnpm deploy`.
- **Auth is homebrew** (JWT/CSRF/PBKDF2 in `apps/api/src/lib/`) — no Auth0/Lucia/etc. Touch with care.
- No CI/CD and no README — this file is the entry point for the project.
