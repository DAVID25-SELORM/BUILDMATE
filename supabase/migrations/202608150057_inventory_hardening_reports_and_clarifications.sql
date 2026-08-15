-- Forward-only hardening for the live inventory ledger. Requires 202608150056.
begin;

-- Exact inventory is ledger-owned. Direct PostgREST updates cannot mutate the
-- derived quantity or move a stocked listing to another physical location.
create or replace function public.guard_exact_inventory_ledger_fields()
returns trigger language plpgsql set search_path=public as $$
begin
  if current_user not in ('postgres','supabase_admin','service_role') then
    if tg_op='INSERT' and new.stock_quantity is not null then
      raise exception 'Numerical stock can only be established through inventory movements';
    end if;
    if tg_op='UPDATE' and new.stock_quantity is distinct from old.stock_quantity then
      raise exception 'Numerical stock can only change through inventory movements';
    end if;
    if tg_op='UPDATE' and old.inventory_mode='exact_quantity' and new.stock_status is distinct from old.stock_status then
      raise exception 'Exact stock quantity and status can only change through inventory movements';
    end if;
    if tg_op='UPDATE' and old.inventory_mode='exact_quantity' and (new.branch_id is distinct from old.branch_id or new.warehouse_id is distinct from old.warehouse_id)
       and exists(select 1 from public.inventory_movements m where m.supplier_listing_id=old.id) then
      raise exception 'A listing with inventory movements cannot be moved to another location';
    end if;
  end if;
  return new;
end;$$;
drop trigger if exists supplier_listing_exact_inventory_guard on public.supplier_listings;
create trigger supplier_listing_exact_inventory_guard
before insert or update of stock_quantity,stock_status,branch_id,warehouse_id on public.supplier_listings
for each row execute function public.guard_exact_inventory_ledger_fields();

-- Freeze the accounting basis at sale completion so later receipts never
-- rewrite historical COGS or realised margin.
alter table public.inventory_movements
  add column if not exists unit_sale_price numeric(14,2),
  add column if not exists revenue numeric(16,2),
  add column if not exists cost_of_goods_sold numeric(16,2),
  add column if not exists realised_gross_margin numeric(16,2);

create or replace function public.enrich_inventory_sale_financials()
returns trigger language plpgsql security definer set search_path=public as $$
declare sale_price numeric; valuation_cost numeric;
begin
  if new.movement_type='sale_completed' then
    select b.average_unit_cost into valuation_cost
    from public.inventory_balances b
    where b.supplier_listing_id=new.supplier_listing_id
      and b.branch_id=new.branch_id and b.warehouse_id is not distinct from new.warehouse_id;
    if new.reference_type='order_item' and new.reference_id is not null then
      select oi.unit_price into sale_price from public.order_items oi where oi.id=new.reference_id;
    end if;
    new.unit_cost:=coalesce(new.unit_cost,valuation_cost,0);
    new.unit_sale_price:=sale_price;
    new.revenue:=case when sale_price is null then null else round(new.quantity*sale_price,2) end;
    new.cost_of_goods_sold:=round(new.quantity*new.unit_cost,2);
    new.realised_gross_margin:=case when new.revenue is null then null else new.revenue-new.cost_of_goods_sold end;
  end if;
  return new;
end;$$;
drop trigger if exists inventory_sale_financial_snapshot on public.inventory_movements;
create trigger inventory_sale_financial_snapshot before insert on public.inventory_movements
for each row execute function public.enrich_inventory_sale_financials();

-- Approval-ready schema for high-value manual adjustments. The current
-- threshold is opt-in; normal adjustments remain synchronous until configured.
create table if not exists public.inventory_adjustment_settings(
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  manager_approval_quantity_threshold numeric check(manager_approval_quantity_threshold is null or manager_approval_quantity_threshold>0),
  updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
create table if not exists public.inventory_adjustment_requests(
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  supplier_listing_id uuid not null references public.supplier_listings(id), movement_type text not null,
  quantity numeric not null check(quantity>0), reason text not null, notes text,
  status text not null default 'pending' check(status in('pending','approved','rejected','applied')),
  requested_by uuid not null references public.profiles(id), reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz, created_at timestamptz not null default now()
);
alter table public.inventory_adjustment_settings enable row level security;
alter table public.inventory_adjustment_requests enable row level security;
revoke all on public.inventory_adjustment_settings,public.inventory_adjustment_requests from anon,authenticated;

-- Supplier clarification submissions are constrained proposals. Only platform
-- catalogue administrators can approve mappings into the master catalogue.
alter table public.supplier_price_clarifications
  add column if not exists confirmed_product_name text,
  add column if not exists confirmed_specification text,
  add column if not exists confirmed_sales_unit text,
  add column if not exists confirmed_price numeric(14,2) check(confirmed_price is null or confirmed_price>=0),
  add column if not exists mapped_product_id uuid references public.products(id),
  add column if not exists mapped_variant_id uuid references public.product_variants(id),
  add column if not exists supplier_action text check(supplier_action is null or supplier_action in('map_existing','request_new_product','skip_not_stocked')),
  add column if not exists supplier_note text,
  add column if not exists submitted_by uuid references public.profiles(id),
  add column if not exists submitted_at timestamptz,
  add column if not exists review_status text not null default 'unresolved' check(review_status in('unresolved','submitted','approved','rejected','skipped')),
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

create or replace function public.submit_supplier_price_clarification(
  target_clarification uuid,target_action text,target_name text,target_specification text,target_unit text,
  target_price numeric,target_product uuid,target_variant uuid,target_note text
) returns void language plpgsql security definer set search_path=public as $$
declare c public.supplier_price_clarifications;
begin
  select * into c from public.supplier_price_clarifications where id=target_clarification for update;
  if c.id is null or not public.has_permission('products.edit',c.supplier_id) then raise exception 'Clarification is unavailable';end if;
  if c.status<>'requires_confirmation' or c.review_status not in('unresolved','rejected') then raise exception 'Clarification has already been submitted';end if;
  if target_action not in('map_existing','request_new_product','skip_not_stocked') then raise exception 'Choose a valid clarification action';end if;
  if target_action='map_existing' and (target_product is null or not exists(select 1 from public.products p where p.id=target_product and p.is_active)) then raise exception 'Choose an active master product';end if;
  if target_variant is not null and not exists(select 1 from public.product_variants v where v.id=target_variant and v.product_id=target_product and v.is_active) then raise exception 'Variant does not belong to the selected product';end if;
  if target_action<>'skip_not_stocked' and (nullif(trim(target_name),'') is null or nullif(trim(target_unit),'') is null) then raise exception 'Confirm the product name and sales unit';end if;
  update public.supplier_price_clarifications set confirmed_product_name=nullif(trim(target_name),''),confirmed_specification=nullif(trim(target_specification),''),
    confirmed_sales_unit=nullif(trim(target_unit),''),confirmed_price=target_price,mapped_product_id=target_product,mapped_variant_id=target_variant,
    supplier_action=target_action,supplier_note=nullif(trim(target_note),''),submitted_by=auth.uid(),submitted_at=now(),review_status='submitted',updated_at=now()
  where id=c.id;
  insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'supplier_price_clarification',c.id::text,'SUPPLIER_CLARIFICATION_SUBMITTED',jsonb_build_object('supplier_id',c.supplier_id,'action',target_action,'mapped_product_id',target_product,'mapped_variant_id',target_variant,'confirmed_price',target_price));
end;$$;

create or replace function public.review_supplier_price_clarification(target_clarification uuid,target_decision text,target_note text)
returns uuid language plpgsql security definer set search_path=public as $$
declare c public.supplier_price_clarifications;l_id uuid;branch uuid;
begin
  if not public.is_platform_admin() then raise exception 'Platform catalogue access required';end if;
  select * into c from public.supplier_price_clarifications where id=target_clarification for update;
  if c.id is null or c.review_status<>'submitted' then raise exception 'Submitted clarification not found';end if;
  if target_decision not in('approve','reject') then raise exception 'Invalid review decision';end if;
  if target_decision='reject' then
    update public.supplier_price_clarifications set review_status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(trim(target_note),''),updated_at=now() where id=c.id;
  elsif c.supplier_action='skip_not_stocked' then
    update public.supplier_price_clarifications set status='dismissed',review_status='skipped',reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(trim(target_note),''),updated_at=now() where id=c.id;
  else
    if c.supplier_action='request_new_product' then raise exception 'Create and map the controlled master product before approval';end if;
    select id into branch from public.supplier_branches where organisation_id=c.supplier_id order by is_main_branch desc,created_at limit 1;
    select id into l_id from public.supplier_listings where supplier_id=c.supplier_id and product_id=c.mapped_product_id and product_variant_id is not distinct from c.mapped_variant_id and branch_id is not distinct from branch and sku is null limit 1;
    if l_id is null then
      insert into public.supplier_listings(supplier_id,product_id,product_variant_id,price,currency,price_effective_date,price_source,price_source_reference,price_updated_by,stock_status,inventory_mode,is_active,listing_status,branch_id,warehouse_id,delivery_available,pickup_available,supplier_notes)
      values(c.supplier_id,c.mapped_product_id,c.mapped_variant_id,c.confirmed_price,'GHS',coalesce(c.effective_date,current_date),c.source,c.source_reference,auth.uid(),'confirmation_required','confirmation_required',false,'draft',branch,null,true,true,c.supplier_note) returning id into l_id;
    elsif c.confirmed_price is not null then
      update public.supplier_listings set price=c.confirmed_price,price_effective_date=coalesce(c.effective_date,current_date),price_source=c.source,price_source_reference=c.source_reference,price_updated_by=auth.uid(),updated_at=now() where id=l_id;
    end if;
    update public.supplier_price_clarifications set status='resolved',review_status='approved',reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(trim(target_note),''),updated_at=now() where id=c.id;
  end if;
  insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'supplier_price_clarification',c.id::text,'CATALOGUE_CLARIFICATION_REVIEWED',jsonb_build_object('decision',target_decision,'supplier_id',c.supplier_id,'listing_id',l_id));
  return l_id;
end;$$;

-- Admin-only source discrepancy note; original invoice reference is unchanged.
insert into public.admin_internal_notes(subject_type,subject_id,note,author_id)
select 'supplier','9b232d45-65f6-4f7d-83d5-d0907f98b4ff',
 'Source document business label differs from the canonical supplier organisation name. The original invoice reference and label are retained for traceability; no second supplier organisation was created.',
 p.id from public.profiles p where p.id='f86fe061-edd9-4f5f-8a07-d749e6194eaa'
and not exists(select 1 from public.admin_internal_notes where subject_type='supplier' and subject_id='9b232d45-65f6-4f7d-83d5-d0907f98b4ff' and note ilike 'Source document business label differs%');
insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data)
select p.id,'supplier','9b232d45-65f6-4f7d-83d5-d0907f98b4ff','SUPPLIER_SOURCE_LABEL_DISCREPANCY_RECORDED',jsonb_build_object('invoice_reference','0000931','source_label','Nana Attakorah III','canonical_name','Nana Attakorah II Ventures') from public.profiles p where p.id='f86fe061-edd9-4f5f-8a07-d749e6194eaa'
and not exists(select 1 from public.audit_logs where entity_type='supplier' and entity_id='9b232d45-65f6-4f7d-83d5-d0907f98b4ff' and action='SUPPLIER_SOURCE_LABEL_DISCREPANCY_RECORDED');

-- Permission-aware reporting RPC. Cost and margin fields are null unless the
-- caller has the corresponding supplier permission.
create or replace function public.inventory_report(target_organisation uuid,target_report text,target_from date,target_to date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare can_cost boolean;rows jsonb;summary jsonb;from_date date:=coalesce(target_from,current_date-29);to_date date:=coalesce(target_to,current_date);
begin
  if not public.has_permission('reports.inventory',target_organisation) and not public.has_permission('inventory.view',target_organisation) then raise exception 'Inventory report permission required';end if;
  if from_date>to_date or to_date-from_date>3660 then raise exception 'Invalid report date range';end if;
  can_cost:=public.has_permission('inventory.view_cost',target_organisation) or public.has_permission('inventory.view_valuation',target_organisation);
  if target_report in('current_stock','valuation','low_stock','out_of_stock','stock_by_branch','stock_by_warehouse') then
    select coalesce(jsonb_agg(jsonb_build_object('product',p.name,'variant',v.name,'sku',l.sku,'category',c.name,'brand',brd.name,'branch',br.name,'warehouse',w.name,'on_hand',b.on_hand_quantity,'reserved',b.quantity_reserved,'available',b.available_quantity,'unit_cost',case when can_cost then b.average_unit_cost end,'stock_value',case when can_cost then b.available_quantity*b.average_unit_cost end,'selling_value',b.available_quantity*coalesce(l.price,0),'potential_margin',case when can_cost then b.available_quantity*(coalesce(l.price,0)-b.average_unit_cost) end,'stock_status',l.stock_status,'last_movement',b.last_movement_at) order by p.name),'[]'::jsonb) into rows
    from public.supplier_listings l join public.products p on p.id=l.product_id left join public.product_variants v on v.id=l.product_variant_id left join public.categories c on c.id=p.category_id left join public.brands brd on brd.id=p.brand_id left join public.inventory_balances b on b.supplier_listing_id=l.id left join public.supplier_branches br on br.id=l.branch_id left join public.supplier_warehouses w on w.id=l.warehouse_id
    where l.supplier_id=target_organisation and (target_report<>'low_stock' or l.stock_status='low_stock') and (target_report<>'out_of_stock' or l.stock_status='out_of_stock');
  elsif target_report in('movements','damaged_lost','adjustments') then
    select coalesce(jsonb_agg(jsonb_build_object('date',m.created_at,'product',p.name,'variant',v.name,'branch',br.name,'warehouse',w.name,'movement_type',m.movement_type,'quantity',m.quantity,'unit_cost',case when can_cost then m.unit_cost end,'reference_type',m.reference_type,'reference_id',m.reference_id,'reason',m.reason,'actor',pr.full_name) order by m.created_at desc),'[]'::jsonb) into rows
    from public.inventory_movements m join public.supplier_listings l on l.id=m.supplier_listing_id join public.products p on p.id=l.product_id left join public.product_variants v on v.id=l.product_variant_id left join public.supplier_branches br on br.id=m.branch_id left join public.supplier_warehouses w on w.id=m.warehouse_id left join public.profiles pr on pr.id=m.created_by
    where m.organisation_id=target_organisation and m.created_at::date between from_date and to_date and (target_report<>'damaged_lost' or m.movement_type in('damaged','lost')) and (target_report<>'adjustments' or m.movement_type like 'stock_adjustment_%' or m.movement_type='stock_count_correction');
  elsif target_report in('sales_by_product','fast_moving','slow_moving','dead_stock') then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.quantity_sold desc),'[]'::jsonb) into rows from (
      select p.name product,v.name variant,l.sku,br.name branch,sum(m.quantity) quantity_sold,sum(coalesce(m.revenue,0)) revenue,
       case when can_cost then sum(coalesce(m.cost_of_goods_sold,0)) end cogs,case when can_cost then sum(coalesce(m.realised_gross_margin,0)) end realised_gross_margin,
       max(m.created_at) last_sale,case when count(*)<2 then 'Insufficient history' when max(m.created_at)<now()-interval '90 days' then 'Dead/slow' when sum(m.quantity)/greatest(to_date-from_date+1,1)>=1 then 'Fast moving' else 'Slow moving' end movement_classification
      from public.supplier_listings l join public.products p on p.id=l.product_id left join public.product_variants v on v.id=l.product_variant_id left join public.supplier_branches br on br.id=l.branch_id left join public.inventory_movements m on m.supplier_listing_id=l.id and m.movement_type='sale_completed' and m.created_at::date between from_date and to_date
      where l.supplier_id=target_organisation group by p.name,v.name,l.sku,br.name
    )x where target_report='sales_by_product' or (target_report='fast_moving' and x.movement_classification='Fast moving') or (target_report='slow_moving' and x.movement_classification in('Slow moving','Insufficient history')) or (target_report='dead_stock' and x.movement_classification='Dead/slow');
  else raise exception 'Unsupported inventory report';end if;
  select jsonb_build_object('from',from_date,'to',to_date,'cost_visible',can_cost,'row_count',jsonb_array_length(rows),'sales',coalesce(sum(revenue),0),'cogs',case when can_cost then coalesce(sum(cost_of_goods_sold),0) end,'realised_gross_margin',case when can_cost then coalesce(sum(realised_gross_margin),0) end) into summary from public.inventory_movements where organisation_id=target_organisation and movement_type='sale_completed' and created_at::date between from_date and to_date;
  return jsonb_build_object('report',target_report,'summary',summary,'rows',rows);
end;$$;

create or replace function public.inventory_listing_position(target_listing uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare org uuid;can_cost boolean;result jsonb;
begin
 select supplier_id into org from public.supplier_listings where id=target_listing;
 if org is null or not public.has_permission('inventory.view',org) then raise exception 'Inventory view permission required';end if;
 can_cost:=public.has_permission('inventory.view_cost',org) or public.has_permission('inventory.view_valuation',org);
 select jsonb_build_object('on_hand',b.on_hand_quantity,'reserved',b.quantity_reserved,'available',b.available_quantity,'sold',b.quantity_sold,'damaged',b.quantity_damaged,'lost',b.quantity_lost,'returned',b.quantity_returned_to_stock,'average_cost',case when can_cost then b.average_unit_cost end,'selling_price',l.price,'cost_value',case when can_cost then b.available_quantity*b.average_unit_cost end,'selling_value',b.available_quantity*coalesce(l.price,0),'potential_margin',case when can_cost then b.available_quantity*(coalesce(l.price,0)-b.average_unit_cost) end,'reorder_point',l.reorder_point,'last_movement',b.last_movement_at,'branch',br.name,'warehouse',w.name) into result
 from public.supplier_listings l left join public.inventory_balances b on b.supplier_listing_id=l.id left join public.supplier_branches br on br.id=l.branch_id left join public.supplier_warehouses w on w.id=l.warehouse_id where l.id=target_listing;
 return coalesce(result,'{}'::jsonb);
end;$$;

revoke all on function public.guard_exact_inventory_ledger_fields(),public.enrich_inventory_sale_financials() from public,anon,authenticated;
revoke all on function public.submit_supplier_price_clarification(uuid,text,text,text,text,numeric,uuid,uuid,text),public.review_supplier_price_clarification(uuid,text,text),public.inventory_report(uuid,text,date,date),public.inventory_listing_position(uuid) from public,anon;
grant execute on function public.submit_supplier_price_clarification(uuid,text,text,text,text,numeric,uuid,uuid,text),public.inventory_report(uuid,text,date,date),public.inventory_listing_position(uuid) to authenticated;
grant execute on function public.review_supplier_price_clarification(uuid,text,text) to authenticated;

commit;
