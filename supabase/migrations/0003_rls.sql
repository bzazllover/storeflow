-- ============================================================================
-- Migration 0003: Row Level Security
-- Every table is locked to the caller's store. Writes are further gated by role.
-- Same pattern as freemium RLS gating: the database is the enforcement point,
-- not the client.
-- ============================================================================

alter table stores              enable row level security;
alter table profiles            enable row level security;
alter table categories          enable row level security;
alter table suppliers           enable row level security;
alter table products            enable row level security;
alter table customers           enable row level security;
alter table sales               enable row level security;
alter table sale_items          enable row level security;
alter table purchases           enable row level security;
alter table purchase_items      enable row level security;
alter table inventory_movements enable row level security;
alter table expense_categories  enable row level security;
alter table expenses            enable row level security;
alter table activity_logs       enable row level security;

-- generic helper predicate used inline: store_id = current_store_id()

-- stores: a user can read their own store; only admin can update it
create policy store_read on stores for select using (id = current_store_id());
create policy store_update on stores for update using (id = current_store_id() and current_role_name() = 'admin');

-- profiles: read same-store profiles; admin/manager manage them
create policy prof_read on profiles for select using (store_id = current_store_id());
create policy prof_self on profiles for update using (id = auth.uid());
create policy prof_admin on profiles for all
  using (store_id = current_store_id() and current_role_name() in ('admin','manager'))
  with check (store_id = current_store_id() and current_role_name() in ('admin','manager'));

-- macro pattern for store-scoped tables: read for all roles, write for staff
-- (viewer can read but not write; cashier+ can write)
do $$
declare t text;
begin
  foreach t in array array[
    'categories','suppliers','products','customers','sales','purchases',
    'inventory_movements','expense_categories','expenses','activity_logs'
  ] loop
    execute format(
      'create policy %1$s_read on %1$s for select using (store_id = current_store_id());', t);
    execute format(
      'create policy %1$s_write on %1$s for all
         using (store_id = current_store_id() and current_role_name() in (''admin'',''manager'',''cashier''))
         with check (store_id = current_store_id() and current_role_name() in (''admin'',''manager'',''cashier''));', t);
  end loop;
end $$;

-- child tables join through their parent's store
create policy si_read on sale_items for select
  using (exists (select 1 from sales s where s.id = sale_id and s.store_id = current_store_id()));
create policy si_write on sale_items for all
  using (exists (select 1 from sales s where s.id = sale_id and s.store_id = current_store_id()))
  with check (exists (select 1 from sales s where s.id = sale_id and s.store_id = current_store_id()));

create policy pi_read on purchase_items for select
  using (exists (select 1 from purchases p where p.id = purchase_id and p.store_id = current_store_id()));
create policy pi_write on purchase_items for all
  using (exists (select 1 from purchases p where p.id = purchase_id and p.store_id = current_store_id()))
  with check (exists (select 1 from purchases p where p.id = purchase_id and p.store_id = current_store_id()));
