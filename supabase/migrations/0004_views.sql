-- ============================================================================
-- Migration 0004: reporting views + seed
-- ============================================================================

-- low stock view
create or replace view v_low_stock as
  select id, store_id, name, sku, stock_qty, min_stock
  from products where active and stock_qty <= min_stock;

-- best sellers (by qty, all-time; filter by date in queries)
create or replace view v_best_sellers as
  select si.product_id, si.name, sum(si.qty) as qty_sold,
         sum(si.line_total) as revenue, s.store_id
  from sale_items si join sales s on s.id = si.sale_id
  where s.status = 'completed'
  group by si.product_id, si.name, s.store_id;

-- daily totals
create or replace view v_daily_sales as
  select store_id, created_at::date as day,
         count(*) as sales_count,
         sum(total) as revenue,
         sum(total - cost_total - tax) as profit
  from sales where status = 'completed'
  group by store_id, created_at::date;

-- inventory valuation (at cost)
create or replace view v_inventory_value as
  select store_id, sum(stock_qty * cost_price) as value_at_cost,
         sum(stock_qty * selling_price) as value_at_retail
  from products where active group by store_id;
