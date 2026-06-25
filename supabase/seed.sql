-- ============================================================================
-- Seed data. Run AFTER you've created your first auth user (see README step 5).
-- Replace :admin_uid below with that user's UUID from Supabase Auth.
-- ============================================================================

-- 1. a store
insert into stores (id, name, currency, tax_rate)
values ('00000000-0000-0000-0000-000000000001', 'My Store', 'DZD', 19)
on conflict do nothing;

-- 2. bind your admin user to it  (REPLACE the uuid)
-- insert into profiles (id, store_id, full_name, role)
-- values ('PASTE-YOUR-AUTH-UID', '00000000-0000-0000-0000-000000000001', 'Owner', 'admin');

-- 3. categories
insert into categories (store_id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Beverages'),
  ('00000000-0000-0000-0000-000000000001', 'Snacks'),
  ('00000000-0000-0000-0000-000000000001', 'Household')
on conflict do nothing;

-- 4. products
insert into products (store_id, name, sku, barcode, cost_price, selling_price, stock_qty, min_stock)
values
  ('00000000-0000-0000-0000-000000000001', 'Mineral Water 1.5L', 'WATR-1001', '6130000000017', 25, 40, 120, 24),
  ('00000000-0000-0000-0000-000000000001', 'Cola 33cl',          'COLA-1002', '6130000000024', 35, 60, 8,   12),
  ('00000000-0000-0000-0000-000000000001', 'Potato Chips',       'CHIP-1003', '6130000000031', 50, 90, 60,  15),
  ('00000000-0000-0000-0000-000000000001', 'Dish Soap',          'SOAP-1004', '6130000000048', 120, 200, 30, 10)
on conflict do nothing;

-- 5. a customer
insert into customers (store_id, name, phone) values
  ('00000000-0000-0000-0000-000000000001', 'Walk-in Regular', '0550000000')
on conflict do nothing;
