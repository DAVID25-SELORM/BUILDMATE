-- Production acceptance: supplier return queue, idempotent return decisions,
-- and filter-ready inventory dashboard metadata. Requires 202608150057.
begin;

alter table public.inventory_returns add column if not exists request_key uuid;
create unique index if not exists inventory_returns_request_key_unique
  on public.inventory_returns(organisation_id,request_key) where request_key is not null;

drop policy if exists "dispute supplier read" on public.order_disputes;
create policy "dispute supplier read" on public.order_disputes for select to authenticated using(exists(
  select 1 from public.orders o where o.id=order_id and public.has_permission('orders.view',o.supplier_id)
));
drop policy if exists "supplier dispute evidence read" on storage.objects;
create policy "supplier dispute evidence read" on storage.objects for select to authenticated using(
  bucket_id='dispute-evidence' and exists(
    select 1 from public.order_disputes d join public.orders o on o.id=d.order_id
    where d.id=((storage.foldername(name))[1])::uuid and public.has_permission('orders.view',o.supplier_id)
  )
);

create or replace function public.inventory_record_return(
  target_order_item uuid,target_quantity numeric,target_disposition text,target_reason text,target_notes text,target_request_key uuid
) returns uuid language plpgsql security definer set search_path=public as $$
declare item record;l supplier_listings;r uuid;already_returned numeric;
begin
 select ir.id into r from inventory_returns ir join supplier_listings sl on sl.id=ir.supplier_listing_id
 where ir.request_key=target_request_key and public.has_permission('inventory.adjust',sl.supplier_id);
 if r is not null then return r;end if;
 select oi.id,oi.quantity,oi.listing_id,o.status into item from order_items oi join orders o on o.id=oi.order_id where oi.id=target_order_item;
 select * into l from supplier_listings where id=item.listing_id;
 if l.id is null or not has_permission('inventory.adjust',l.supplier_id) then raise exception 'Return processing permission required';end if;
 if item.status not in('completed','return_requested','disputed','refunded') then raise exception 'Order is not eligible for a return';end if;
 select coalesce(sum(quantity),0) into already_returned from inventory_returns where order_item_id=target_order_item;
 if target_quantity<=0 or already_returned+target_quantity>item.quantity then raise exception 'Return quantity exceeds sold quantity';end if;
 if target_disposition not in('returned_to_stock','damaged','quarantine','supplier_return','disposal') or length(trim(coalesce(target_reason,'')))<5 then raise exception 'A valid disposition and reason are required';end if;
 insert into inventory_returns(order_item_id,organisation_id,supplier_listing_id,quantity,disposition,reason,notes,processed_by,request_key)
 values(item.id,l.supplier_id,l.id,target_quantity,target_disposition,target_reason,target_notes,auth.uid(),target_request_key) returning id into r;
 if target_disposition='returned_to_stock' then perform apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'customer_return',target_quantity,null,'customer_return',r,target_reason,target_notes,auth.uid());
 elsif target_disposition='damaged' then perform apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'damaged',target_quantity,null,'customer_return',r,target_reason,target_notes,auth.uid());
 elsif target_disposition='supplier_return' then perform apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'supplier_return',target_quantity,null,'customer_return',r,target_reason,target_notes,auth.uid());
 else insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'inventory_return',r::text,'INVENTORY_RETURN_DISPOSITION',jsonb_build_object('disposition',target_disposition,'quantity',target_quantity,'listing_id',l.id));end if;
 return r;
end;$$;

create or replace function public.inventory_return_queue(target_organisation uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.has_permission('inventory.adjust',target_organisation) then raise exception 'Return processing permission required';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'order_item_id',oi.id,'order_number',o.order_number,'order_status',o.status,'customer',p.full_name,
  'product',oi.product_name_snapshot,'ordered_quantity',oi.quantity,'unit_price',oi.unit_price,
  'return_reason',d.reason,'dispute_status',d.status,'dispute_id',d.id,
  'already_processed',coalesce((select sum(ir.quantity) from inventory_returns ir where ir.order_item_id=oi.id),0),
  'evidence_paths',coalesce((select jsonb_agg(so.name order by so.created_at) from storage.objects so where so.bucket_id='dispute-evidence' and (storage.foldername(so.name))[1]=d.id::text),'[]'::jsonb)
 ) order by o.updated_at desc),'[]'::jsonb) into result
 from orders o join order_items oi on oi.order_id=o.id left join profiles p on p.id=o.customer_id left join order_disputes d on d.order_id=o.id
 where o.supplier_id=target_organisation and o.status in('completed','return_requested','disputed','refunded');
 return result;
end;
$$;

-- Replace the original dashboard RPC with metadata used by the URL-persisted
-- supplier filters. Cost fields remain permission-masked at the SQL boundary.
create or replace function public.inventory_dashboard(target_organisation uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare can_cost boolean;result jsonb;
begin
 if not has_permission('inventory.view',target_organisation) then raise exception 'Inventory view permission required';end if;
 can_cost:=has_permission('inventory.view_cost',target_organisation) or has_permission('inventory.view_valuation',target_organisation);
 select jsonb_build_object('can_view_cost',can_cost,'summary',jsonb_build_object(
 'total_skus',count(distinct l.id),'on_hand',coalesce(sum(b.on_hand_quantity),0),'available',coalesce(sum(b.available_quantity),0),'reserved',coalesce(sum(b.quantity_reserved),0),
 'cost_value',case when can_cost then coalesce(sum(b.available_quantity*b.average_unit_cost),0) end,'retail_value',coalesce(sum(b.available_quantity*coalesce(l.price,0)),0),
 'potential_margin',case when can_cost then coalesce(sum(b.available_quantity*(coalesce(l.price,0)-b.average_unit_cost)),0) end,
 'low_stock',count(*) filter(where l.stock_status='low_stock'),'out_of_stock',count(*) filter(where l.stock_status='out_of_stock'),
 'confirmation_required',(select count(*) from supplier_listings x where x.supplier_id=target_organisation and x.inventory_mode='confirmation_required')),
 'rows',coalesce(jsonb_agg(jsonb_build_object(
 'listing_id',l.id,'product',p.name,'variant',v.name,'sku',l.sku,'category',c.name,'brand',bd.name,'branch',br.name,'warehouse',w.name,
 'inventory_mode',l.inventory_mode,'on_hand',b.on_hand_quantity,'reserved',b.quantity_reserved,'available',b.available_quantity,'sold',b.quantity_sold,'damaged',b.quantity_damaged,
 'average_cost',case when can_cost then b.average_unit_cost end,'selling_price',l.price,'cost_value',case when can_cost then b.available_quantity*b.average_unit_cost end,
 'selling_value',b.available_quantity*coalesce(l.price,0),'stock_status',l.stock_status,'reorder_point',l.reorder_point,'last_movement_at',b.last_movement_at,
 'updated_at',l.updated_at,'sales_velocity',coalesce((select sum(m.quantity) from inventory_movements m where m.supplier_listing_id=l.id and m.movement_type='sale_completed' and m.created_at>=now()-interval '30 days'),0)
 ) order by p.name,v.name),'[]'::jsonb)) into result
 from supplier_listings l join products p on p.id=l.product_id left join product_variants v on v.id=l.product_variant_id left join categories c on c.id=p.category_id left join brands bd on bd.id=p.brand_id
 left join inventory_balances b on b.supplier_listing_id=l.id left join supplier_branches br on br.id=l.branch_id left join supplier_warehouses w on w.id=l.warehouse_id
 where l.supplier_id=target_organisation;
 return result;
end;$$;

revoke all on function public.inventory_record_return(uuid,numeric,text,text,text,uuid),public.inventory_return_queue(uuid) from public,anon;
grant execute on function public.inventory_record_return(uuid,numeric,text,text,text,uuid),public.inventory_return_queue(uuid) to authenticated;
commit;
