# StoreFlow — Store Management System

A production-ready POS + inventory + reporting system. **Next.js 15 (App Router) + Supabase (Postgres, Auth, RLS)**. Multi-store ready: a single-store install is just one row in `stores`, so you never rewrite when you add a second location.

## What's built and working

| Module | Status |
|---|---|
| Auth (login, password reset, role-based access) | ✅ working |
| Dashboard (KPIs, 14-day chart, low-stock, best sellers) | ✅ working |
| POS (search, **barcode scan**, cart, discount, tax, payment, **receipt + print**) | ✅ working |
| Products (CRUD, SKU generation, margin, categories, min-stock) | ✅ working |
| Inventory (movement history, atomic stock updates on every sale) | ✅ working |
| Customers (profiles, loyalty points, balances) | ✅ working |
| Reports (P&L this month, inventory valuation) | ✅ working |
| Refunds / returns (`refund_sale` RPC restocks + logs) | ✅ DB-ready |
| Purchase orders (`receive_purchase` RPC) | ✅ DB-ready, UI is an extension point |
| Suppliers / Expenses / Employees / Attendance | 🟡 schema + RLS done; UI scaffold to add |
| PDF / Excel export | 🟡 extension point — see below |

The database is the source of truth: the POS **never** decrements stock directly. It calls the `checkout()` RPC, which inside one transaction validates stock, writes the sale + items, decrements inventory, logs movements, and awards loyalty points. Stock math can't be tampered with from the browser.

## Architecture

```
src/
  app/
    (auth)/login/         sign-in + password reset
    (dash)/               protected area (layout guards the session)
      dashboard/  pos/  products/  inventory/  customers/  reports/
    api/checkout/         (reserved for server-side webhook/export hooks)
  components/             client components (PosClient, ProductsClient, charts)
  lib/
    supabase-browser.ts   browser client
    supabase-server.ts    server client (RSC)
    pricing.ts            pure pricing logic (unit-tested)
  middleware.ts           redirects unauthenticated users to /login
supabase/
  migrations/
    0001_init.sql         tables + enums
    0002_functions.sql    checkout / adjust_stock / refund_sale / receive_purchase
    0003_rls.sql          row-level security (store isolation + role gating)
    0004_views.sql        dashboard + report views
  seed.sql                sample store & products
```

## Setup

### 1. Create a Supabase project
At [supabase.com](https://supabase.com) → New project. Note the project URL and the **anon** and **service_role** keys (Settings → API).

### 2. Run the migrations
In the Supabase SQL Editor, run the four files in `supabase/migrations/` **in order** (0001 → 0004).

### 3. Configure env
```bash
cp .env.example .env.local
```
Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### 4. Install + run
```bash
npm install
npm run dev          # http://localhost:3000
npm test             # run unit tests
```

### 5. Create your first admin
Supabase Dashboard → Authentication → Add user (email + password). Copy that user's UUID, then in the SQL Editor:
```sql
insert into stores (id, name, currency, tax_rate)
values ('00000000-0000-0000-0000-000000000001','My Store','DZD',19)
on conflict do nothing;

insert into profiles (id, store_id, full_name, role)
values ('PASTE-AUTH-UID','00000000-0000-0000-0000-000000000001','Owner','admin');
```
Optionally run the rest of `supabase/seed.sql` for sample products. Log in — you're in.

### Roles
`admin` (full), `manager` (manage staff + everything operational), `cashier` (sell, manage products/customers), `viewer` (read-only). Enforced in Postgres via RLS, so it holds even if someone hits the API directly.

## Using a barcode scanner
USB scanners act as keyboards: they type the code and send Enter. The POS search box listens for that — an exact barcode/SKU match auto-adds to the cart. No driver, no config.

## Deployment (Vercel)
1. Push to GitHub.
2. Vercel → Import → select the repo.
3. Add the three env vars from `.env.local` in Project Settings → Environment Variables.
4. Deploy. Supabase is already hosted; nothing else to provision.

Set your production URL in Supabase → Authentication → URL Configuration so password-reset emails link back correctly.

## Extension points

**PDF / Excel export.** Add a route at `src/app/api/reports/[type]/route.ts` that queries the report views with the `service_role` key and streams a file. For Excel use `xlsx`/SheetJS; for PDF use a server renderer. The report views (`v_daily_sales`, `v_best_sellers`, `v_inventory_value`) already return export-ready rows.

**Purchase order UI.** The schema (`purchases`, `purchase_items`) and `receive_purchase()` RPC exist. Build a form that inserts a draft PO, then call `supabase.rpc('receive_purchase', { p_purchase })` on receipt to push stock in.

**Suppliers / Expenses / Employees pages.** Tables + RLS are done. Copy the `customers/page.tsx` pattern — it's the template for any list+CRUD screen.

**Product images.** Add a Supabase Storage bucket, upload in `ProductsClient`, save the public URL to `products.image_url` (column already exists).

## Testing
`src/lib/pricing.ts` holds the money math (line totals, tax, margin) as pure functions, unit-tested in `pricing.test.ts`. Keep new business logic that way — pure and testable — and the DB RPCs handle the transactional parts.
