-- Return hardening: serialize decisions per order item, require idempotency,
-- and change stock only for listings whose quantity is ledger-managed.
begin;

-- Checkout is security-definer, so it must independently enforce every
-- marketplace eligibility rule instead of relying on the caller having first
-- discovered the listing through public RLS.
create or replace function public.checkout_cart_for_context(cart_items jsonb,target_address text,target_customer_organisation uuid default null)
returns uuid[] language plpgsql security definer set search_path=public as $$
declare supplier uuid;new_order uuid;result uuid[]:='{}';subtotal_value numeric;item jsonb;listing record;member_id uuid;requested_count integer;eligible_count integer;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if target_customer_organisation is not null then
   if not has_permission('orders.create',target_customer_organisation) then raise exception 'Order creation permission required';end if;
   select id into member_id from organisation_members where organisation_id=target_customer_organisation and user_id=auth.uid() and status='active' and is_active;
 end if;
 if length(trim(target_address))<3 then raise exception 'Delivery address required';end if;
 requested_count:=jsonb_array_length(cart_items);
 if requested_count=0 or requested_count>100 then raise exception 'Cart is empty or too large';end if;
 if exists(select 1 from jsonb_array_elements(cart_items) i where coalesce((i->>'quantity')::numeric,0)<=0) then raise exception 'Cart quantities must be positive';end if;

 select count(*) into eligible_count
 from jsonb_array_elements(cart_items) i
 join supplier_listings l on l.id=(i->>'listing_id')::uuid
 join organisations o on o.id=l.supplier_id
 where l.is_active and l.listing_status='published' and l.price is not null and l.stock_status<>'out_of_stock'
   and o.organisation_type='supplier' and o.verification_status='approved' and coalesce(o.account_status,'active')='active';
 if eligible_count<>requested_count then raise exception 'One or more offers are no longer available';end if;

 if exists(
   select 1 from jsonb_array_elements(cart_items) i join supplier_listings l on l.id=(i->>'listing_id')::uuid
   where l.inventory_mode='exact_quantity' and (i->>'quantity')::numeric>
     (select coalesce(sum(b.available_quantity),0) from inventory_balances b where b.supplier_listing_id=l.id)
 ) then raise exception 'Requested quantity exceeds currently available stock';end if;

 for supplier in
   select distinct l.supplier_id from jsonb_array_elements(cart_items) i join supplier_listings l on l.id=(i->>'listing_id')::uuid
 loop
   select sum(l.price*(i->>'quantity')::numeric) into subtotal_value
   from jsonb_array_elements(cart_items) i join supplier_listings l on l.id=(i->>'listing_id')::uuid where l.supplier_id=supplier;
   insert into orders(order_number,customer_id,customer_organisation_id,created_by_membership_id,supplier_id,status,subtotal,delivery_address)
   values('BM-'||to_char(now(),'YYYYMMDD')||'-'||lpad(nextval('order_number_seq')::text,6,'0'),auth.uid(),target_customer_organisation,member_id,supplier,'awaiting_payment',subtotal_value,target_address)
   returning id into new_order;
   for item in select * from jsonb_array_elements(cart_items) loop
     select l.id,l.price,p.name,p.base_unit into listing from supplier_listings l join products p on p.id=l.product_id
     where l.id=(item->>'listing_id')::uuid and l.supplier_id=supplier for update;
     if found then
       insert into order_items(order_id,listing_id,product_name_snapshot,quantity,unit,unit_price)
       values(new_order,listing.id,listing.name,(item->>'quantity')::numeric,listing.base_unit,listing.price);
     end if;
   end loop;
   result:=array_append(result,new_order);
 end loop;
 return result;
end;$$;

revoke all on function public.checkout_cart_for_context(jsonb,text,uuid) from public,anon;
grant execute on function public.checkout_cart_for_context(jsonb,text,uuid) to authenticated;

create or replace function public.inventory_record_return(
  target_order_item uuid,target_quantity numeric,target_disposition text,target_reason text,target_notes text,target_request_key uuid
) returns uuid language plpgsql security definer set search_path=public as $$
declare item record;l supplier_listings;r uuid;already_returned numeric;
begin
 if target_request_key is null then raise exception 'A return request key is required';end if;
 select ir.id into r from inventory_returns ir join supplier_listings sl on sl.id=ir.supplier_listing_id
 where ir.request_key=target_request_key and public.has_permission('inventory.adjust',sl.supplier_id);
 if r is not null then return r;end if;

 -- Serialize all dispositions for one sold line. Different request keys can no
 -- longer race past the cumulative returned-quantity check.
 select oi.id,oi.quantity,oi.listing_id,o.status into item
 from order_items oi join orders o on o.id=oi.order_id
 where oi.id=target_order_item for update of oi;
 if item.id is null then raise exception 'Order item not found';end if;
 select * into l from supplier_listings where id=item.listing_id;
 if l.id is null or not has_permission('inventory.adjust',l.supplier_id) then raise exception 'Return processing permission required';end if;
 if item.status not in('completed','return_requested','disputed','refunded') then raise exception 'Order is not eligible for a return';end if;
 select coalesce(sum(quantity),0) into already_returned from inventory_returns where order_item_id=target_order_item;
 if target_quantity<=0 or already_returned+target_quantity>item.quantity then raise exception 'Return quantity exceeds sold quantity';end if;
 if target_disposition not in('returned_to_stock','damaged','quarantine','supplier_return','disposal') or length(trim(coalesce(target_reason,'')))<5 then raise exception 'A valid disposition and reason are required';end if;

 insert into inventory_returns(order_item_id,organisation_id,supplier_listing_id,quantity,disposition,reason,notes,processed_by,request_key)
 values(item.id,l.supplier_id,l.id,target_quantity,target_disposition,target_reason,target_notes,auth.uid(),target_request_key) returning id into r;

 if l.inventory_mode='exact_quantity' and target_disposition='returned_to_stock' then
   perform apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'customer_return',target_quantity,null,'customer_return',r,target_reason,target_notes,auth.uid());
 elsif l.inventory_mode='exact_quantity' and target_disposition='damaged' then
   perform apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'damaged',target_quantity,null,'customer_return',r,target_reason,target_notes,auth.uid());
 elsif l.inventory_mode='exact_quantity' and target_disposition='supplier_return' then
   perform apply_inventory_movement(l.id,l.branch_id,l.warehouse_id,'supplier_return',target_quantity,null,'customer_return',r,target_reason,target_notes,auth.uid());
 else
   insert into audit_logs(actor_id,entity_type,entity_id,action,after_data)
   values(auth.uid(),'inventory_return',r::text,'INVENTORY_RETURN_DISPOSITION',jsonb_build_object('disposition',target_disposition,'quantity',target_quantity,'listing_id',l.id,'inventory_mode',l.inventory_mode,'stock_movement_created',false));
 end if;
 return r;
end;$$;

revoke all on function public.inventory_record_return(uuid,numeric,text,text,text,uuid) from public,anon;
grant execute on function public.inventory_record_return(uuid,numeric,text,text,text,uuid) to authenticated;

commit;
