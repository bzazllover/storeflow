-- ============================================================================
-- StoreFlow — Store Management System
-- Migration 0001: core schema
-- Postgres 15 / Supabase. Multi-store ready (single store = one row in stores).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role        as enum ('admin', 'manager', 'cashier', 'viewer');
create type sale_status      as enum ('completed', 'refunded', 'partially_refunded', 'void');
create type payment_method   as enum ('cash', 'card', 'mobile', 'mixed', 'credit');
create type movement_type    as enum ('sale', 'purchase', 'adjustment', 'transfer_in', 'transfer_out', 'return', 'initial');
create type purchase_status  as enum ('draft', 'ordered', 'received', 'partial', 'cancelled');

-- ---------------------------------------------------------------------------
-- Stores  (a single-store install is just one row here)
-- ---------------------------------------------------------------------------
create table stores (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  currency      text not null default 'DZD',
  tax_rate      numeric(5,2) not null default 0,   -- default % applied at POS
  address       text,
  phone         text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles  (1:1 with auth.users; holds role + store binding)
-- ---------------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  store_id      uuid not null references stores(id) on delete cascade,
  full_name     text,
  role          user_role not null default 'cashier',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on profiles (store_id);

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores(id) on delete cascade,
  name        text not null,
  parent_id   uuid references categories(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (store_id, name)
);
create index on categories (store_id);

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------
create table suppliers (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores(id) on delete cascade,
  name          text not null,
  contact_name  text,
  phone         text,
  email         text,
  address       text,
  balance       numeric(14,2) not null default 0,   -- amount we owe them
  notes         text,
  created_at    timestamptz not null default now()
);
create index on suppliers (store_id);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table products (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores(id) on delete cascade,
  category_id     uuid references categories(id) on delete set null,
  supplier_id     uuid references suppliers(id) on delete set null,
  sku             text not null,
  barcode         text,
  name            text not null,
  description     text,
  image_url       text,
  cost_price      numeric(14,2) not null default 0,
  selling_price   numeric(14,2) not null default 0,
  stock_qty       numeric(14,3) not null default 0,
  min_stock       numeric(14,3) not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (store_id, sku)
);
create index on products (store_id);
create index on products (store_id, barcode);
create index on products (store_id) where active;
-- generated profit margin %, null-safe
create or replace function profit_margin(cost numeric, price numeric)
returns numeric language sql immutable as $$
  select case when price = 0 then 0 else round((price - cost) / price * 100, 2) end;
$$;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table customers (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores(id) on delete cascade,
  name            text not null,
  phone           text,
  email           text,
  loyalty_points  integer not null default 0,
  balance         numeric(14,2) not null default 0,   -- store credit / debt
  notes           text,
  created_at      timestamptz not null default now()
);
create index on customers (store_id);

-- ---------------------------------------------------------------------------
-- Sales  +  Sale items
-- ---------------------------------------------------------------------------
create table sales (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores(id) on delete cascade,
  customer_id     uuid references customers(id) on delete set null,
  cashier_id      uuid references profiles(id) on delete set null,
  receipt_no      bigint generated always as identity,
  subtotal        numeric(14,2) not null default 0,
  discount        numeric(14,2) not null default 0,
  tax             numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  cost_total      numeric(14,2) not null default 0,   -- snapshot for profit calc
  payment_method  payment_method not null default 'cash',
  amount_paid     numeric(14,2) not null default 0,
  status          sale_status not null default 'completed',
  created_at      timestamptz not null default now()
);
create index on sales (store_id, created_at desc);

create table sale_items (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references sales(id) on delete cascade,
  product_id  uuid references products(id) on delete set null,
  name        text not null,            -- snapshot
  qty         numeric(14,3) not null,
  unit_price  numeric(14,2) not null,   -- snapshot
  unit_cost   numeric(14,2) not null default 0,
  discount    numeric(14,2) not null default 0,
  line_total  numeric(14,2) not null
);
create index on sale_items (sale_id);
create index on sale_items (product_id);

-- ---------------------------------------------------------------------------
-- Purchases (purchase orders)  +  items
-- ---------------------------------------------------------------------------
create table purchases (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores(id) on delete cascade,
  supplier_id   uuid references suppliers(id) on delete set null,
  reference     text,
  status        purchase_status not null default 'draft',
  total         numeric(14,2) not null default 0,
  amount_paid   numeric(14,2) not null default 0,
  ordered_at    timestamptz,
  received_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index on purchases (store_id, created_at desc);

create table purchase_items (
  id            uuid primary key default gen_random_uuid(),
  purchase_id   uuid not null references purchases(id) on delete cascade,
  product_id    uuid references products(id) on delete set null,
  qty           numeric(14,3) not null,
  unit_cost     numeric(14,2) not null,
  line_total    numeric(14,2) not null
);
create index on purchase_items (purchase_id);

-- ---------------------------------------------------------------------------
-- Inventory movements (the single source of truth for stock history)
-- ---------------------------------------------------------------------------
create table inventory_movements (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores(id) on delete cascade,
  product_id    uuid not null references products(id) on delete cascade,
  type          movement_type not null,
  qty_change    numeric(14,3) not null,   -- signed: +in / -out
  ref_table     text,                     -- 'sales' | 'purchases' | 'adjustment'
  ref_id        uuid,
  note          text,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on inventory_movements (store_id, product_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------
create table expense_categories (
  id        uuid primary key default gen_random_uuid(),
  store_id  uuid not null references stores(id) on delete cascade,
  name      text not null,
  unique (store_id, name)
);

create table expenses (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores(id) on delete cascade,
  category_id   uuid references expense_categories(id) on delete set null,
  amount        numeric(14,2) not null,
  note          text,
  spent_at      date not null default current_date,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on expenses (store_id, spent_at desc);

-- ---------------------------------------------------------------------------
-- Activity log (employee actions)
-- ---------------------------------------------------------------------------
create table activity_logs (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores(id) on delete cascade,
  user_id     uuid references profiles(id) on delete set null,
  action      text not null,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index on activity_logs (store_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger for products
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger products_touch before update on products
  for each row execute function touch_updated_at();
