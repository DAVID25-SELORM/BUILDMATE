-- Add immutable internal stock-entry references and idempotent opening/receipt posting.
begin;

create sequence if not exists public.inventory_grn_number_seq;
create sequence if not exists public.inventory_opening_number_seq;

alter table public.inventory_receipts
 add column if not exists internal_reference text,
 add column if not exists entry_type text,
 add column if not exists request_key uuid;

update public.inventory_receipts
set internal_reference='GRN-LEGACY-'||upper(substr(replace(id::text,'-',''),1,12))
where internal_reference is null;
update public.inventory_receipts set entry_type='stock_received' where entry_type is null;
alter table public.inventory_receipts alter column internal_reference set not null;
alter table public.inventory_receipts alter column entry_type set not null;
alter table public.inventory_receipts add constraint inventory_receipts_internal_reference_unique unique(internal_reference);
alter table public.inventory_receipts add constraint inventory_receipts_entry_type_check check(entry_type in('opening_stock','stock_received'));
create unique index inventory_receipts_request_key_unique on public.inventory_receipts(organisation_id,request_key) where request_key is not null;
create index inventory_receipts_reference_search on public.inventory_receipts(organisation_id,lower(internal_reference) text_pattern_ops);
create index inventory_receipts_vendor_search on public.inventory_receipts(organisation_id,lower(vendor_name) text_pattern_ops) where vendor_name is not null;
create index inventory_receipts_invoice_search on public.inventory_receipts(organisation_id,lower(invoice_reference) text_pattern_ops) where invoice_reference is not null;

create or replace function public.prevent_posted_inventory_receipt_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin raise exception 'Posted inventory receipts are immutable; record a compensating inventory movement';end;$$;
drop trigger if exists immutable_inventory_receipt on public.inventory_receipts;
create trigger immutable_inventory_receipt before update or delete on public.inventory_receipts for each row execute function public.prevent_posted_inventory_receipt_change();

create or replace function public.inventory_receive_stock(target_listing uuid,target_quantity numeric,target_unit_cost numeric,target_vendor text,target_invoice text,target_received_date date,target_notes text,target_request_key uuid)
returns table(receipt_id uuid,internal_reference text,resulting_on_hand numeric,resulting_available numeric) language plpgsql security definer set search_path=public as $$
declare l supplier_listings;r inventory_receipts;movement uuid;b inventory_balances;generated_reference text;
begin
 if target_request_key is null then raise exception 'A receipt request key is required';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_request_key::text,0));
 select ir.* into r from inventory_receipts ir join supplier_listings sl on sl.id=ir.supplier_listing_id where ir.request_key=target_request_key and sl.supplier_id=ir.organisation_id and has_permission('inventory.receive',sl.supplier_id);
 if r.id is not null then select * into b from inventory_balances where supplier_listing_id=r.supplier_listing_id and branch_id=r.branch_id and warehouse_id is not distinct from r.warehouse_id;return query select r.id,r.internal_reference,b.on_hand_quantity,b.available_quantity;return;end if;
 select * into l from supplier_listings where id=target_listing for update;
 if l.id is null or not has_permission('inventory.receive',l.supplier_id) then raise exception 'Inventory receipt permission required';end if;
 if not has_permission('inventory.manage_cost',l.supplier_id) then raise exception 'Cost management permission required';end if;
 if l.branch_id is null then raise exception 'Assign a branch before receiving stock';end if;
 if target_quantity is null or target_quantity<=0 then raise exception 'Quantity received must be greater than zero';end if;
 if target_unit_cost is null or target_unit_cost<=0 then raise exception 'Unit cost must be greater than zero';end if;
 if target_received_date is null or target_received_date>current_date then raise exception 'Enter a valid received date';end if;
 generated_reference:='GRN-'||to_char(now(),'YYYYMMDD')||'-'||lpad(nextval('inventory_grn_number_seq')::text,5,'0');
 insert into inventory_receipts(organisation_id,supplier_listing_id,branch_id,warehouse_id,quantity,unit_cost,vendor_name,invoice_reference,received_date,notes,received_by,internal_reference,entry_type,request_key)
 values(l.supplier_id,l.id,l.branch_id,l.warehouse_id,target_quantity,target_unit_cost,nullif(trim(coalesce(target_vendor,'')),''),nullif(trim(coalesce(target_invoice,'')),''),target_received_date,nullif(trim(coalesce(target_notes,'')),''),auth.uid(),generated_reference,'stock_received',target_request_key) returning * into r;
 movement:=apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'purchase_receipt',target_quantity,target_unit_cost,'inventory_receipt',r.id,'Stock received',target_notes,auth.uid());
 update supplier_listings set inventory_mode='exact_quantity' where id=l.id;
 select * into b from inventory_balances where supplier_listing_id=l.id and branch_id=l.branch_id and warehouse_id is not distinct from l.warehouse_id;
 insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'inventory_receipt',r.id::text,'INVENTORY_RECEIPT_POSTED',jsonb_build_object('organisation_id',l.supplier_id,'listing_id',l.id,'product_id',l.product_id,'variant_id',l.product_variant_id,'branch_id',l.branch_id,'warehouse_id',l.warehouse_id,'quantity',target_quantity,'unit_cost',target_unit_cost,'previous_on_hand',b.on_hand_quantity-target_quantity,'resulting_on_hand',b.on_hand_quantity,'vendor',r.vendor_name,'external_reference',r.invoice_reference,'internal_reference',r.internal_reference,'movement_id',movement));
 return query select r.id,r.internal_reference,b.on_hand_quantity,b.available_quantity;
end;$$;

create or replace function public.inventory_set_opening_stock(target_listing uuid,target_quantity numeric,target_unit_cost numeric,target_as_of_date date,target_notes text,target_request_key uuid)
returns table(receipt_id uuid,internal_reference text,resulting_on_hand numeric,resulting_available numeric) language plpgsql security definer set search_path=public as $$
declare l supplier_listings;r inventory_receipts;movement uuid;b inventory_balances;generated_reference text;
begin
 if target_request_key is null then raise exception 'An opening stock request key is required';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_request_key::text,0));
 select ir.* into r from inventory_receipts ir join supplier_listings sl on sl.id=ir.supplier_listing_id where ir.request_key=target_request_key and ir.entry_type='opening_stock' and has_permission('inventory.receive',sl.supplier_id);
 if r.id is not null then select * into b from inventory_balances where supplier_listing_id=r.supplier_listing_id and branch_id=r.branch_id and warehouse_id is not distinct from r.warehouse_id;return query select r.id,r.internal_reference,b.on_hand_quantity,b.available_quantity;return;end if;
 select * into l from supplier_listings where id=target_listing for update;
 if l.id is null or not has_permission('inventory.receive',l.supplier_id) or not has_permission('inventory.configure',l.supplier_id) then raise exception 'Opening stock setup permission required';end if;
 if not has_permission('inventory.manage_cost',l.supplier_id) then raise exception 'Cost management permission required';end if;
 if l.branch_id is null then raise exception 'Assign a branch before setting opening stock';end if;
 if exists(select 1 from inventory_movements where supplier_listing_id=l.id) then raise exception 'Opening stock can only be set before inventory movement history exists';end if;
 if target_quantity is null or target_quantity<=0 then raise exception 'Opening quantity must be greater than zero';end if;
 if target_unit_cost is null or target_unit_cost<=0 then raise exception 'Unit cost must be greater than zero';end if;
 if target_as_of_date is null or target_as_of_date>current_date then raise exception 'Enter a valid as-of date';end if;
 generated_reference:='OPEN-'||to_char(now(),'YYYYMMDD')||'-'||lpad(nextval('inventory_opening_number_seq')::text,5,'0');
 insert into inventory_receipts(organisation_id,supplier_listing_id,branch_id,warehouse_id,quantity,unit_cost,received_date,notes,received_by,internal_reference,entry_type,request_key)
 values(l.supplier_id,l.id,l.branch_id,l.warehouse_id,target_quantity,target_unit_cost,target_as_of_date,nullif(trim(coalesce(target_notes,'')),''),auth.uid(),generated_reference,'opening_stock',target_request_key) returning * into r;
 movement:=apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'opening_stock',target_quantity,target_unit_cost,'inventory_receipt',r.id,'Opening stock',target_notes,auth.uid());
 update supplier_listings set inventory_mode='exact_quantity' where id=l.id;
 select * into b from inventory_balances where supplier_listing_id=l.id and branch_id=l.branch_id and warehouse_id is not distinct from l.warehouse_id;
 insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'inventory_receipt',r.id::text,'INVENTORY_OPENING_STOCK_POSTED',jsonb_build_object('organisation_id',l.supplier_id,'listing_id',l.id,'product_id',l.product_id,'variant_id',l.product_variant_id,'branch_id',l.branch_id,'warehouse_id',l.warehouse_id,'quantity',target_quantity,'unit_cost',target_unit_cost,'previous_on_hand',0,'resulting_on_hand',b.on_hand_quantity,'internal_reference',r.internal_reference,'movement_id',movement,'as_of_date',target_as_of_date));
 return query select r.id,r.internal_reference,b.on_hand_quantity,b.available_quantity;
end;$$;

create or replace function public.inventory_movement_history(target_listing uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare org uuid;can_cost boolean;
begin
 select supplier_id into org from supplier_listings where id=target_listing;if org is null or not(has_permission('inventory.view',org) or is_platform_admin()) then raise exception 'Inventory view permission required';end if;can_cost:=is_platform_admin() or has_permission('inventory.view_cost',org) or has_permission('inventory.view_valuation',org);
 return(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'movement_type',m.movement_type,'quantity',m.quantity,'unit_cost',case when can_cost then m.unit_cost end,'previous_on_hand',m.previous_on_hand,'resulting_on_hand',m.resulting_on_hand,'previous_reserved',m.previous_reserved,'resulting_reserved',m.resulting_reserved,'reference_type',m.reference_type,'reference_id',m.reference_id,'internal_reference',ir.internal_reference,'vendor',ir.vendor_name,'external_reference',ir.invoice_reference,'receipt_date',ir.received_date,'reason',m.reason,'notes',m.notes,'created_by',p.full_name,'created_at',m.created_at) order by m.created_at desc),'[]'::jsonb) from inventory_movements m left join inventory_receipts ir on m.reference_type='inventory_receipt' and ir.id=m.reference_id left join profiles p on p.id=m.created_by where m.supplier_listing_id=target_listing);
end;$$;

create or replace function public.inventory_search_movement_references(target_organisation uuid,target_query text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare query_prefix text:=lower(trim(coalesce(target_query,'')))||'%';can_cost boolean;
begin
 if not(has_permission('inventory.view',target_organisation) or is_platform_admin()) then raise exception 'Inventory view permission required';end if;
 can_cost:=is_platform_admin() or has_permission('inventory.view_cost',target_organisation) or has_permission('inventory.view_valuation',target_organisation);
 return(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from(
  select m.id,m.movement_type,m.quantity,case when can_cost then m.unit_cost end unit_cost,m.resulting_on_hand,
   ir.internal_reference,ir.vendor_name vendor,ir.invoice_reference external_reference,ir.received_date,
   l.id listing_id,p.name product,v.name variant,l.sku,m.created_at
  from inventory_movements m join supplier_listings l on l.id=m.supplier_listing_id join products p on p.id=l.product_id
  left join product_variants v on v.id=l.product_variant_id left join inventory_receipts ir on m.reference_type='inventory_receipt' and ir.id=m.reference_id
  where l.supplier_id=target_organisation and (query_prefix='%' or lower(coalesce(ir.internal_reference,'')) like query_prefix
   or lower(coalesce(ir.vendor_name,'')) like query_prefix or lower(coalesce(ir.invoice_reference,'')) like query_prefix
   or lower(p.name) like query_prefix or lower(coalesce(l.sku,'')) like query_prefix)
  order by m.created_at desc limit 100
 )x);
end;$$;

revoke all on function public.inventory_receive_stock(uuid,numeric,numeric,text,text,date,text) from public,anon,authenticated;
drop function if exists public.inventory_receive_stock(uuid,numeric,numeric,text,text,date,text);
revoke all on function public.inventory_receive_stock(uuid,numeric,numeric,text,text,date,text,uuid),public.inventory_set_opening_stock(uuid,numeric,numeric,date,text,uuid) from public,anon;
grant execute on function public.inventory_receive_stock(uuid,numeric,numeric,text,text,date,text,uuid),public.inventory_set_opening_stock(uuid,numeric,numeric,date,text,uuid) to authenticated;
revoke all on function public.inventory_search_movement_references(uuid,text) from public,anon;
grant execute on function public.inventory_search_movement_references(uuid,text) to authenticated;
revoke all on function public.prevent_posted_inventory_receipt_change() from public,anon,authenticated;

commit;
