-- ============================================================================
-- Migration 0002: business logic (RPCs)
-- These run server-side as SECURITY DEFINER so stock math can't be tampered
-- with from the client. The POS never decrements stock directly — it calls
-- checkout() and the database does the rest atomically.
-- ============================================================================

-- helper: the caller's store_id
create or replace function current_store_id() returns uuid
language sql stable security definer set search_path = public as $$
  select store_id from profiles where id = auth.uid();
$$;

-- helper: the caller's role
create or replace function current_role_name() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- checkout(cart)  -> creates a sale, its items, decrements stock, logs movements
-- cart is jsonb: { customer_id, payment_method, discount, tax_rate, amount_paid,
--                  items: [ { product_id, qty, unit_price, discount } ] }
-- Returns the new sale row.
-- ---------------------------------------------------------------------------
create or replace function checkout(cart jsonb)
returns sales
language plpgsql security definer set search_path = public as $$
declare
  v_store   uuid := current_store_id();
  v_sale    sales;
  v_item    jsonb;
  v_prod    products;
  v_sub     numeric := 0;
  v_cost    numeric := 0;
  v_qty     numeric;
  v_price   numeric;
  v_disc    numeric;
  v_line    numeric;
  v_tax     numeric;
  v_taxrate numeric := coalesce((cart->>'tax_rate')::numeric, 0);
  v_hdisc   numeric := coalesce((cart->>'discount')::numeric, 0);
begin
  if v_store is null then
    raise exception 'no store for current user';
  end if;

  -- validate stock + accumulate totals first (fail before writing anything)
  for v_item in select * from jsonb_array_elements(cart->'items') loop
    select * into v_prod from products
      where id = (v_item->>'product_id')::uuid and store_id = v_store
      for update;
    if not found then raise exception 'product % not found', v_item->>'product_id'; end if;

    v_qty   := (v_item->>'qty')::numeric;
    v_price := coalesce((v_item->>'unit_price')::numeric, v_prod.selling_price);
    v_disc  := coalesce((v_item->>'discount')::numeric, 0);
    if v_prod.stock_qty < v_qty then
      raise exception 'insufficient stock for %', v_prod.name;
    end if;
    v_sub  := v_sub + (v_qty * v_price - v_disc);
    v_cost := v_cost + (v_qty * v_prod.cost_price);
  end loop;

  v_tax := round((v_sub - v_hdisc) * v_taxrate / 100, 2);

  insert into sales (store_id, customer_id, cashier_id, subtotal, discount, tax,
                     total, cost_total, payment_method, amount_paid)
  values (v_store,
          nullif(cart->>'customer_id','')::uuid,
          auth.uid(),
          v_sub, v_hdisc, v_tax,
          v_sub - v_hdisc + v_tax, v_cost,
          coalesce((cart->>'payment_method')::payment_method,'cash'),
          coalesce((cart->>'amount_paid')::numeric, 0))
  returning * into v_sale;

  -- write items + decrement stock + movements
  for v_item in select * from jsonb_array_elements(cart->'items') loop
    select * into v_prod from products where id = (v_item->>'product_id')::uuid;
    v_qty   := (v_item->>'qty')::numeric;
    v_price := coalesce((v_item->>'unit_price')::numeric, v_prod.selling_price);
    v_disc  := coalesce((v_item->>'discount')::numeric, 0);
    v_line  := v_qty * v_price - v_disc;

    insert into sale_items (sale_id, product_id, name, qty, unit_price, unit_cost, discount, line_total)
    values (v_sale.id, v_prod.id, v_prod.name, v_qty, v_price, v_prod.cost_price, v_disc, v_line);

    update products set stock_qty = stock_qty - v_qty where id = v_prod.id;

    insert into inventory_movements (store_id, product_id, type, qty_change, ref_table, ref_id, created_by)
    values (v_store, v_prod.id, 'sale', -v_qty, 'sales', v_sale.id, auth.uid());
  end loop;

  -- loyalty: 1 point per 100 spent
  if v_sale.customer_id is not null then
    update customers set loyalty_points = loyalty_points + floor(v_sale.total / 100)
      where id = v_sale.customer_id;
  end if;

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------------
-- adjust_stock(product_id, new_qty, note) -> manual inventory adjustment
-- ---------------------------------------------------------------------------
create or replace function adjust_stock(p_product uuid, p_new_qty numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_store uuid := current_store_id(); v_old numeric;
begin
  select stock_qty into v_old from products where id = p_product and store_id = v_store for update;
  if not found then raise exception 'product not found'; end if;
  update products set stock_qty = p_new_qty where id = p_product;
  insert into inventory_movements (store_id, product_id, type, qty_change, ref_table, note, created_by)
  values (v_store, p_product, 'adjustment', p_new_qty - v_old, 'adjustment', p_note, auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- refund_sale(sale_id) -> restocks items, marks sale refunded
-- ---------------------------------------------------------------------------
create or replace function refund_sale(p_sale uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_store uuid := current_store_id(); r record;
begin
  if (select status from sales where id = p_sale and store_id = v_store) <> 'completed' then
    raise exception 'sale not refundable';
  end if;
  for r in select * from sale_items where sale_id = p_sale loop
    if r.product_id is not null then
      update products set stock_qty = stock_qty + r.qty where id = r.product_id;
      insert into inventory_movements (store_id, product_id, type, qty_change, ref_table, ref_id, created_by)
      values (v_store, r.product_id, 'return', r.qty, 'sales', p_sale, auth.uid());
    end if;
  end loop;
  update sales set status = 'refunded' where id = p_sale;
end;
$$;

-- ---------------------------------------------------------------------------
-- receive_purchase(purchase_id) -> increments stock from PO, updates cost
-- ---------------------------------------------------------------------------
create or replace function receive_purchase(p_purchase uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_store uuid := current_store_id(); r record;
begin
  for r in select * from purchase_items where purchase_id = p_purchase loop
    if r.product_id is not null then
      update products set stock_qty = stock_qty + r.qty, cost_price = r.unit_cost
        where id = r.product_id and store_id = v_store;
      insert into inventory_movements (store_id, product_id, type, qty_change, ref_table, ref_id, created_by)
      values (v_store, r.product_id, 'purchase', r.qty, 'purchases', p_purchase, auth.uid());
    end if;
  end loop;
  update purchases set status = 'received', received_at = now() where id = p_purchase;
end;
$$;
