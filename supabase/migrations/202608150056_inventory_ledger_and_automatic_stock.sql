-- Transactional supplier inventory: append-only movements, per-location balances,
-- weighted-average valuation, and idempotent order lifecycle integration.

begin;

do $$ begin
  if to_regtype('public.inventory_mode') is null then
    execute 'create type public.inventory_mode as enum (''exact_quantity'',''status_only'',''confirmation_required'')';
  end if;
end $$;

alter table public.supplier_listings
  add column if not exists inventory_mode public.inventory_mode not null default 'confirmation_required',
  add column if not exists show_exact_stock_to_customers boolean not null default false,
  add column if not exists reorder_point numeric check(reorder_point is null or reorder_point >= 0),
  add column if not exists preferred_reorder_quantity numeric check(preferred_reorder_quantity is null or preferred_reorder_quantity > 0);

update public.supplier_listings set inventory_mode=case
  when stock_quantity is not null then 'exact_quantity'::public.inventory_mode
  when stock_status='confirmation_required' then 'confirmation_required'::public.inventory_mode
  else 'status_only'::public.inventory_mode end;

-- A supplier may stock the same catalogue item at multiple physical locations.
-- Preserve one default listing per product/variant at each branch/warehouse.
drop index if exists public.supplier_listings_unique_parent_default_sku;
drop index if exists public.supplier_listings_unique_variant_default_sku;
create unique index supplier_listings_unique_parent_location_default_sku
  on public.supplier_listings(
    supplier_id, product_id,
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(warehouse_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where sku is null and product_variant_id is null;
create unique index supplier_listings_unique_variant_location_default_sku
  on public.supplier_listings(
    supplier_id, product_id, product_variant_id,
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(warehouse_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where sku is null and product_variant_id is not null;

insert into public.organisation_permissions(scope,key,label) values
('supplier','inventory.receive','Receive stock'),('supplier','inventory.transfer','Transfer stock'),
('supplier','inventory.view_cost','View inventory costs'),('supplier','inventory.manage_cost','Manage inventory costs'),
('supplier','inventory.view_valuation','View stock valuation'),('supplier','inventory.configure','Configure inventory'),
('supplier','reports.inventory','View inventory reports'),('supplier','finance.view_margin','View potential inventory margin')
on conflict(scope,key) do nothing;

insert into public.organisation_role_permissions(role_id,permission_id)
select r.id,p.id from public.organisation_roles r join public.organisation_permissions p on p.scope='supplier'
where r.scope='supplier' and (
  r.is_owner or r.key='administrator'
  or (r.key in('branch_manager','inventory_officer','warehouse_officer') and p.key in('inventory.receive','inventory.transfer','inventory.configure'))
  or (r.key in('inventory_officer','finance_officer') and p.key in('inventory.view_cost','inventory.view_valuation','reports.inventory'))
  or (r.key='finance_officer' and p.key in('finance.view_margin'))
  or (r.key='inventory_officer' and p.key='inventory.manage_cost')
) on conflict do nothing;

create table public.inventory_balances(
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  supplier_listing_id uuid not null references public.supplier_listings(id) on delete cascade,
  product_variant_id uuid references public.product_variants(id),
  branch_id uuid not null references public.supplier_branches(id),
  warehouse_id uuid references public.supplier_warehouses(id),
  opening_quantity numeric not null default 0,
  quantity_received numeric not null default 0,
  quantity_reserved numeric not null default 0 check(quantity_reserved>=0),
  quantity_sold numeric not null default 0 check(quantity_sold>=0),
  quantity_returned_to_stock numeric not null default 0 check(quantity_returned_to_stock>=0),
  quantity_damaged numeric not null default 0 check(quantity_damaged>=0),
  quantity_lost numeric not null default 0 check(quantity_lost>=0),
  quantity_adjusted numeric not null default 0,
  on_hand_quantity numeric not null default 0 check(on_hand_quantity>=0),
  available_quantity numeric generated always as (on_hand_quantity-quantity_reserved) stored,
  average_unit_cost numeric(14,4) not null default 0 check(average_unit_cost>=0),
  last_unit_cost numeric(14,4),
  last_movement_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(quantity_reserved<=on_hand_quantity)
);
create unique index inventory_balance_branch_unique on public.inventory_balances(supplier_listing_id,branch_id) where warehouse_id is null;
create unique index inventory_balance_warehouse_unique on public.inventory_balances(supplier_listing_id,branch_id,warehouse_id) where warehouse_id is not null;
create index inventory_balances_org_location on public.inventory_balances(organisation_id,branch_id,warehouse_id);

create table public.inventory_movements(
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  supplier_listing_id uuid not null references public.supplier_listings(id) on delete restrict,
  product_variant_id uuid references public.product_variants(id),
  branch_id uuid not null references public.supplier_branches(id),
  warehouse_id uuid references public.supplier_warehouses(id),
  movement_type text not null check(movement_type in('opening_stock','purchase_receipt','sale_reservation','reservation_release','sale_completed','customer_return','supplier_return','damaged','lost','transfer_out','transfer_in','stock_adjustment_positive','stock_adjustment_negative','stock_count_correction')),
  quantity numeric not null check(quantity<>0),
  unit_cost numeric(14,4) check(unit_cost is null or unit_cost>=0),
  previous_on_hand numeric not null,
  resulting_on_hand numeric not null,
  previous_reserved numeric not null,
  resulting_reserved numeric not null,
  reference_type text,
  reference_id uuid,
  reason text not null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index inventory_movement_idempotency on public.inventory_movements(supplier_listing_id,movement_type,reference_type,reference_id) where reference_id is not null;
create index inventory_movements_listing_date on public.inventory_movements(supplier_listing_id,created_at desc);

create table public.inventory_receipts(
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id),
  supplier_listing_id uuid not null references public.supplier_listings(id), branch_id uuid not null references public.supplier_branches(id),
  warehouse_id uuid references public.supplier_warehouses(id), quantity numeric not null check(quantity>0), unit_cost numeric(14,4) not null check(unit_cost>=0),
  vendor_name text, invoice_reference text, received_date date not null, notes text, received_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);

create table public.inventory_returns(
  id uuid primary key default gen_random_uuid(), order_item_id uuid not null references public.order_items(id),
  organisation_id uuid not null references public.organisations(id), supplier_listing_id uuid not null references public.supplier_listings(id),
  quantity numeric not null check(quantity>0), disposition text not null check(disposition in('returned_to_stock','damaged','quarantine','supplier_return','disposal')),
  reason text not null, notes text, processed_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);

alter table public.inventory_balances enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_receipts enable row level security;
alter table public.inventory_returns enable row level security;
revoke all on public.inventory_balances,public.inventory_movements,public.inventory_receipts,public.inventory_returns from anon,authenticated;

create or replace function public.apply_inventory_movement(
  target_listing uuid,target_branch uuid,target_warehouse uuid,target_type text,target_quantity numeric,target_unit_cost numeric,
  target_reference_type text,target_reference_id uuid,target_reason text,target_notes text,target_actor uuid default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare l supplier_listings;b inventory_balances;movement_id uuid;on_delta numeric:=0;reserved_delta numeric:=0;received_delta numeric:=0;sold_delta numeric:=0;returned_delta numeric:=0;damaged_delta numeric:=0;lost_delta numeric:=0;adjusted_delta numeric:=0;new_cost numeric;
begin
  if target_quantity=0 or target_quantity is null then raise exception 'Movement quantity must be non-zero';end if;
  if target_type<>'stock_count_correction' and target_quantity<0 then raise exception 'Movement quantity must be positive';end if;
  select * into l from supplier_listings where id=target_listing for update;
  if l.id is null or l.branch_id is distinct from target_branch then raise exception 'Listing location is invalid';end if;
  if l.warehouse_id is distinct from target_warehouse then raise exception 'Listing warehouse is invalid';end if;
  if target_reference_id is not null then select id into movement_id from inventory_movements where supplier_listing_id=target_listing and movement_type=target_type and reference_type=target_reference_type and reference_id=target_reference_id;if movement_id is not null then return movement_id;end if;end if;
  select * into b from inventory_balances where supplier_listing_id=target_listing and branch_id=target_branch and warehouse_id is not distinct from target_warehouse for update;
  if b.id is null then
    insert into inventory_balances(organisation_id,supplier_listing_id,product_variant_id,branch_id,warehouse_id)
    values(l.supplier_id,l.id,l.product_variant_id,target_branch,target_warehouse) returning * into b;
  end if;
  case target_type
    when 'opening_stock' then on_delta:=target_quantity;adjusted_delta:=0;
    when 'purchase_receipt' then on_delta:=target_quantity;received_delta:=target_quantity;
    when 'sale_reservation' then reserved_delta:=target_quantity;
    when 'reservation_release' then reserved_delta:=-target_quantity;
    when 'sale_completed' then on_delta:=-target_quantity;reserved_delta:=-target_quantity;sold_delta:=target_quantity;
    when 'customer_return' then on_delta:=target_quantity;returned_delta:=target_quantity;
    when 'supplier_return' then on_delta:=case when target_reference_type='customer_return' then 0 else -target_quantity end;adjusted_delta:=case when target_reference_type='customer_return' then 0 else -target_quantity end;
    when 'damaged' then on_delta:=case when target_reference_type='customer_return' then 0 else -target_quantity end;damaged_delta:=target_quantity;
    when 'lost' then on_delta:=-target_quantity;lost_delta:=target_quantity;
    when 'transfer_out' then on_delta:=-target_quantity;
    when 'transfer_in' then on_delta:=target_quantity;
    when 'stock_adjustment_positive' then on_delta:=target_quantity;adjusted_delta:=target_quantity;
    when 'stock_adjustment_negative' then on_delta:=-target_quantity;adjusted_delta:=-target_quantity;
    when 'stock_count_correction' then on_delta:=target_quantity;adjusted_delta:=target_quantity;
    else raise exception 'Unsupported inventory movement';
  end case;
  if b.on_hand_quantity+on_delta<0 or b.quantity_reserved+reserved_delta<0 or b.quantity_reserved+reserved_delta>b.on_hand_quantity+on_delta then raise exception 'Insufficient inventory for this movement';end if;
  new_cost:=b.average_unit_cost;
  if target_type in('opening_stock','purchase_receipt','stock_adjustment_positive','transfer_in') and target_unit_cost is not null and b.on_hand_quantity+on_delta>0 then
    new_cost:=round(((b.on_hand_quantity*b.average_unit_cost)+(on_delta*target_unit_cost))/(b.on_hand_quantity+on_delta),4);
  end if;
  update inventory_balances set
    opening_quantity=opening_quantity+case when target_type='opening_stock' then target_quantity else 0 end,
    quantity_received=quantity_received+received_delta,quantity_reserved=quantity_reserved+reserved_delta,quantity_sold=quantity_sold+sold_delta,
    quantity_returned_to_stock=quantity_returned_to_stock+returned_delta,quantity_damaged=quantity_damaged+damaged_delta,
    quantity_lost=quantity_lost+lost_delta,quantity_adjusted=quantity_adjusted+adjusted_delta,on_hand_quantity=on_hand_quantity+on_delta,
    average_unit_cost=new_cost,last_unit_cost=coalesce(target_unit_cost,last_unit_cost),last_movement_at=now(),updated_at=now()
  where id=b.id returning * into b;
  insert into inventory_movements(organisation_id,supplier_listing_id,product_variant_id,branch_id,warehouse_id,movement_type,quantity,unit_cost,previous_on_hand,resulting_on_hand,previous_reserved,resulting_reserved,reference_type,reference_id,reason,notes,created_by)
  values(l.supplier_id,l.id,l.product_variant_id,target_branch,target_warehouse,target_type,target_quantity,target_unit_cost,b.on_hand_quantity-on_delta,b.on_hand_quantity,b.quantity_reserved-reserved_delta,b.quantity_reserved,target_reference_type,target_reference_id,target_reason,nullif(trim(coalesce(target_notes,'')),''),coalesce(target_actor,auth.uid())) returning id into movement_id;
  update supplier_listings set stock_quantity=(select coalesce(sum(available_quantity),0) from inventory_balances where supplier_listing_id=l.id),
    stock_status=case when (select coalesce(sum(available_quantity),0) from inventory_balances where supplier_listing_id=l.id)<=0 then 'out_of_stock'::stock_status when reorder_point is not null and (select coalesce(sum(available_quantity),0) from inventory_balances where supplier_listing_id=l.id)<=reorder_point then 'low_stock'::stock_status else 'in_stock'::stock_status end,
    listing_status=case when listing_status='published' and (select coalesce(sum(available_quantity),0) from inventory_balances where supplier_listing_id=l.id)<=0 then 'out_of_stock'::supplier_listing_status else listing_status end,
    is_active=case when (select coalesce(sum(available_quantity),0) from inventory_balances where supplier_listing_id=l.id)<=0 then false else is_active end,updated_at=now() where id=l.id;
  insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(coalesce(target_actor,auth.uid()),'inventory_movement',movement_id::text,'INVENTORY_MOVEMENT_CREATED',jsonb_build_object('listing_id',l.id,'movement_type',target_type,'quantity',target_quantity,'reference_type',target_reference_type,'reference_id',target_reference_id,'resulting_on_hand',b.on_hand_quantity,'resulting_reserved',b.quantity_reserved));
  return movement_id;
end;$$;

create or replace function public.inventory_receive_stock(target_listing uuid,target_quantity numeric,target_unit_cost numeric,target_vendor text,target_invoice text,target_received_date date,target_notes text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare l supplier_listings;r uuid;
begin select * into l from supplier_listings where id=target_listing;if l.id is null or not has_permission('inventory.receive',l.supplier_id) then raise exception 'Inventory receipt permission required';end if;if not has_permission('inventory.manage_cost',l.supplier_id) then raise exception 'Cost management permission required';end if;if l.branch_id is null then raise exception 'Assign a branch before receiving stock';end if;
insert into inventory_receipts(organisation_id,supplier_listing_id,branch_id,warehouse_id,quantity,unit_cost,vendor_name,invoice_reference,received_date,notes,received_by) values(l.supplier_id,l.id,l.branch_id,l.warehouse_id,target_quantity,target_unit_cost,nullif(trim(target_vendor),''),nullif(trim(target_invoice),''),target_received_date,target_notes,auth.uid()) returning id into r;
perform apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'purchase_receipt',target_quantity,target_unit_cost,'inventory_receipt',r,'Stock received',target_notes,auth.uid());update supplier_listings set inventory_mode='exact_quantity' where id=l.id;return r;end;$$;

create or replace function public.inventory_adjust_stock(target_listing uuid,target_type text,target_quantity numeric,target_reason text,target_notes text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare l supplier_listings;r uuid:=gen_random_uuid();
begin select * into l from supplier_listings where id=target_listing;if l.id is null or not has_permission('inventory.adjust',l.supplier_id) then raise exception 'Inventory adjustment permission required';end if;if length(trim(coalesce(target_reason,'')))<5 then raise exception 'A detailed adjustment reason is required';end if;if target_type not in('stock_adjustment_positive','stock_adjustment_negative','stock_count_correction','damaged','lost') then raise exception 'Invalid adjustment type';end if;perform apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,target_type,target_quantity,null,'manual_adjustment',r,target_reason,target_notes,auth.uid());return r;end;$$;

create or replace function public.inventory_transfer_stock(source_listing uuid,destination_listing uuid,target_quantity numeric,target_reason text) returns uuid language plpgsql security definer set search_path=public as $$
declare src supplier_listings;dst supplier_listings;r uuid:=gen_random_uuid();transfer_cost numeric;
begin select * into src from supplier_listings where id=source_listing;select * into dst from supplier_listings where id=destination_listing;
if src.id is null or dst.id is null or src.supplier_id<>dst.supplier_id or not has_permission('inventory.transfer',src.supplier_id) then raise exception 'Inventory transfer permission required';end if;
if src.id=dst.id or src.product_id<>dst.product_id or src.product_variant_id is distinct from dst.product_variant_id then raise exception 'Transfer listings must represent the same product and variant at different locations';end if;
if length(trim(coalesce(target_reason,'')))<5 then raise exception 'A transfer reason is required';end if;
select average_unit_cost into transfer_cost from inventory_balances where supplier_listing_id=src.id and branch_id=src.branch_id and warehouse_id is not distinct from src.warehouse_id for update;
perform apply_inventory_movement(src.id,src.branch_id,src.warehouse_id,'transfer_out',target_quantity,transfer_cost,'inventory_transfer',r,target_reason,null,auth.uid());
perform apply_inventory_movement(dst.id,dst.branch_id,dst.warehouse_id,'transfer_in',target_quantity,transfer_cost,'inventory_transfer',r,target_reason,null,auth.uid());return r;end;$$;

create or replace function public.inventory_configure_listing(target_listing uuid,target_mode public.inventory_mode,target_show_exact boolean,target_reorder numeric,target_preferred_reorder numeric) returns void language plpgsql security definer set search_path=public as $$
declare l supplier_listings;
begin select * into l from supplier_listings where id=target_listing for update;if l.id is null or not has_permission('inventory.configure',l.supplier_id) then raise exception 'Inventory configuration permission required';end if;
if target_mode='exact_quantity' and l.branch_id is null then raise exception 'Assign a branch before enabling exact inventory';end if;
update supplier_listings set inventory_mode=target_mode,show_exact_stock_to_customers=coalesce(target_show_exact,false),reorder_point=target_reorder,preferred_reorder_quantity=target_preferred_reorder,stock_status=case when target_mode='confirmation_required' then 'confirmation_required'::stock_status else stock_status end,updated_at=now() where id=l.id;
insert into audit_logs(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),'supplier_listing',l.id::text,'INVENTORY_CONFIGURATION_CHANGED',jsonb_build_object('inventory_mode',l.inventory_mode,'show_exact_stock_to_customers',l.show_exact_stock_to_customers,'reorder_point',l.reorder_point,'preferred_reorder_quantity',l.preferred_reorder_quantity),jsonb_build_object('inventory_mode',target_mode,'show_exact_stock_to_customers',target_show_exact,'reorder_point',target_reorder,'preferred_reorder_quantity',target_preferred_reorder));end;$$;

create or replace function public.inventory_record_return(target_order_item uuid,target_quantity numeric,target_disposition text,target_reason text,target_notes text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare item record;l supplier_listings;r uuid;already_returned numeric;
begin select oi.id,oi.quantity,oi.listing_id,o.status into item from order_items oi join orders o on o.id=oi.order_id where oi.id=target_order_item;select * into l from supplier_listings where id=item.listing_id;
if l.id is null or not has_permission('inventory.adjust',l.supplier_id) then raise exception 'Return processing permission required';end if;if item.status not in('completed','return_requested','disputed','refunded') then raise exception 'Order is not eligible for a return';end if;
select coalesce(sum(quantity),0) into already_returned from inventory_returns where order_item_id=target_order_item;if target_quantity<=0 or already_returned+target_quantity>item.quantity then raise exception 'Return quantity exceeds sold quantity';end if;
if target_disposition not in('returned_to_stock','damaged','quarantine','supplier_return','disposal') or length(trim(coalesce(target_reason,'')))<5 then raise exception 'A valid disposition and reason are required';end if;
insert into inventory_returns(order_item_id,organisation_id,supplier_listing_id,quantity,disposition,reason,notes,processed_by) values(item.id,l.supplier_id,l.id,target_quantity,target_disposition,target_reason,target_notes,auth.uid()) returning id into r;
if target_disposition='returned_to_stock' then perform apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'customer_return',target_quantity,null,'customer_return',r,target_reason,target_notes,auth.uid());
elsif target_disposition='damaged' then perform apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'damaged',target_quantity,null,'customer_return',r,target_reason,target_notes,auth.uid());
elsif target_disposition='supplier_return' then perform apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'supplier_return',target_quantity,null,'customer_return',r,target_reason,target_notes,auth.uid());
else insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'inventory_return',r::text,'INVENTORY_RETURN_DISPOSITION',jsonb_build_object('disposition',target_disposition,'quantity',target_quantity,'listing_id',l.id));end if;return r;end;$$;

create or replace function public.sync_order_inventory() returns trigger language plpgsql security definer set search_path=public as $$
declare i record;l supplier_listings;has_reservation boolean;has_sale boolean;
begin if old.status is not distinct from new.status then return new;end if;
for i in select oi.id,oi.listing_id,oi.quantity from order_items oi where oi.order_id=new.id and oi.listing_id is not null loop select * into l from supplier_listings where id=i.listing_id;if l.inventory_mode='exact_quantity' then
  select exists(select 1 from inventory_movements where supplier_listing_id=l.id and movement_type='sale_reservation' and reference_type='order_item' and reference_id=i.id) into has_reservation;
  select exists(select 1 from inventory_movements where supplier_listing_id=l.id and movement_type='sale_completed' and reference_type='order_item' and reference_id=i.id) into has_sale;
  if new.status='confirmed' and not has_reservation then perform apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'sale_reservation',i.quantity,null,'order_item',i.id,'Reserved on supplier acceptance',null,auth.uid());
  elsif new.status='completed' and has_reservation and not has_sale then perform apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'sale_completed',i.quantity,null,'order_item',i.id,'Consumed on completed order',null,auth.uid());
  elsif new.status in('cancelled','refunded') and has_reservation and not has_sale and not exists(select 1 from inventory_movements where supplier_listing_id=l.id and movement_type='reservation_release' and reference_type='order_item' and reference_id=i.id) then perform apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'reservation_release',i.quantity,null,'order_item',i.id,'Reservation released after order cancellation',null,auth.uid());end if;
end if;end loop;return new;end;$$;
drop trigger if exists order_inventory_sync on public.orders;
create trigger order_inventory_sync after update of status on public.orders for each row execute function public.sync_order_inventory();

do $$ declare l record; begin
for l in select id,branch_id,warehouse_id,stock_quantity from supplier_listings where stock_quantity is not null and stock_quantity>0 and branch_id is not null loop
  if not exists(select 1 from inventory_movements where supplier_listing_id=l.id) then
    perform apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'opening_stock',l.stock_quantity,null,'migration_backfill',l.id,'Backfilled from existing supplier listing stock quantity',null,null);
  end if;
end loop;end $$;

create or replace function public.inventory_dashboard(target_organisation uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare can_cost boolean;result jsonb;
begin if not has_permission('inventory.view',target_organisation) then raise exception 'Inventory view permission required';end if;can_cost:=has_permission('inventory.view_cost',target_organisation) or has_permission('inventory.view_valuation',target_organisation);
select jsonb_build_object('can_view_cost',can_cost,'summary',jsonb_build_object('total_skus',count(distinct l.id),'on_hand',coalesce(sum(b.on_hand_quantity),0),'available',coalesce(sum(b.available_quantity),0),'reserved',coalesce(sum(b.quantity_reserved),0),'cost_value',case when can_cost then coalesce(sum(b.available_quantity*b.average_unit_cost),0) end,'retail_value',coalesce(sum(b.available_quantity*coalesce(l.price,0)),0),'potential_margin',case when can_cost then coalesce(sum(b.available_quantity*(coalesce(l.price,0)-b.average_unit_cost)),0) end,'low_stock',count(*) filter(where l.stock_status='low_stock'),'out_of_stock',count(*) filter(where l.stock_status='out_of_stock'),'confirmation_required',(select count(*) from supplier_listings x where x.supplier_id=target_organisation and x.inventory_mode='confirmation_required')),
'rows',coalesce(jsonb_agg(jsonb_build_object('listing_id',l.id,'product',p.name,'variant',v.name,'sku',l.sku,'branch',br.name,'warehouse',w.name,'on_hand',b.on_hand_quantity,'reserved',b.quantity_reserved,'available',b.available_quantity,'sold',b.quantity_sold,'damaged',b.quantity_damaged,'average_cost',case when can_cost then b.average_unit_cost end,'selling_price',l.price,'cost_value',case when can_cost then b.available_quantity*b.average_unit_cost end,'selling_value',b.available_quantity*coalesce(l.price,0),'stock_status',l.stock_status,'reorder_point',l.reorder_point,'last_movement_at',b.last_movement_at) order by p.name,v.name),'[]'::jsonb)) into result
from supplier_listings l join products p on p.id=l.product_id left join product_variants v on v.id=l.product_variant_id left join inventory_balances b on b.supplier_listing_id=l.id left join supplier_branches br on br.id=b.branch_id left join supplier_warehouses w on w.id=b.warehouse_id where l.supplier_id=target_organisation;return result;end;$$;

create or replace function public.inventory_movement_history(target_listing uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare org uuid;can_cost boolean;
begin select supplier_id into org from supplier_listings where id=target_listing;if org is null or not has_permission('inventory.view',org) then raise exception 'Inventory view permission required';end if;can_cost:=has_permission('inventory.view_cost',org);return (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'movement_type',m.movement_type,'quantity',m.quantity,'unit_cost',case when can_cost then m.unit_cost end,'previous_on_hand',m.previous_on_hand,'resulting_on_hand',m.resulting_on_hand,'previous_reserved',m.previous_reserved,'resulting_reserved',m.resulting_reserved,'reference_type',m.reference_type,'reference_id',m.reference_id,'reason',m.reason,'notes',m.notes,'created_by',p.full_name,'created_at',m.created_at) order by m.created_at desc),'[]'::jsonb) from inventory_movements m left join profiles p on p.id=m.created_by where m.supplier_listing_id=target_listing);end;$$;

revoke all on function public.apply_inventory_movement(uuid,uuid,uuid,text,numeric,numeric,text,uuid,text,text,uuid),public.sync_order_inventory() from public,anon,authenticated;
revoke all on function public.inventory_receive_stock(uuid,numeric,numeric,text,text,date,text),public.inventory_adjust_stock(uuid,text,numeric,text,text),public.inventory_transfer_stock(uuid,uuid,numeric,text),public.inventory_configure_listing(uuid,public.inventory_mode,boolean,numeric,numeric),public.inventory_record_return(uuid,numeric,text,text,text),public.inventory_dashboard(uuid),public.inventory_movement_history(uuid) from public,anon;
grant execute on function public.inventory_receive_stock(uuid,numeric,numeric,text,text,date,text),public.inventory_adjust_stock(uuid,text,numeric,text,text),public.inventory_transfer_stock(uuid,uuid,numeric,text),public.inventory_configure_listing(uuid,public.inventory_mode,boolean,numeric,numeric),public.inventory_record_return(uuid,numeric,text,text,text),public.inventory_dashboard(uuid),public.inventory_movement_history(uuid) to authenticated;

commit;
