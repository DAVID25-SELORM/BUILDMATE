-- Enforce purchasable inventory consistently at RLS, search and checkout.
begin;

create or replace function public.marketplace_listing_is_eligible(l public.supplier_listings)
returns boolean language sql stable security definer set search_path=public as $$
 select l.listing_status='published' and l.is_active and l.price is not null and l.price>0
   and l.branch_id is not null
   and ((l.inventory_mode='exact_quantity' and l.stock_quantity is not null and l.stock_quantity>0)
     or (l.inventory_mode='status_only' and l.stock_status='in_stock'))
   and exists(select 1 from organisations o where o.id=l.supplier_id and o.organisation_type='supplier'
     and o.verification_status='approved' and coalesce(o.account_status,'active')='active')
$$;

drop policy if exists "public published approved listings" on public.supplier_listings;
create policy "public inventory eligible listings" on public.supplier_listings for select to anon,authenticated
using(public.marketplace_listing_is_eligible(supplier_listings));

create or replace function public.public_marketplace_search_listing_ids(target_query text)
returns setof uuid language sql stable security definer set search_path=public as $$
 select distinct l.id from supplier_listings l join products p on p.id=l.product_id
 left join brands b on b.id=p.brand_id left join product_variants v on v.id=l.product_variant_id
 where marketplace_listing_is_eligible(l) and p.is_active
 and (trim(coalesce(target_query,''))='' or p.name ilike '%'||trim(target_query)||'%'
   or lower(trim(target_query))=any(p.search_aliases) or b.name ilike '%'||trim(target_query)||'%'
   or v.name ilike '%'||trim(target_query)||'%' or v.specifications::text ilike '%'||trim(target_query)||'%')
$$;

drop function if exists public.checkout_cart_for_context(jsonb,text,uuid,text);
create function public.checkout_cart_for_context(cart_items jsonb,target_address text,target_customer_organisation uuid default null,target_fulfilment text default 'delivery')
returns uuid[] language plpgsql security definer set search_path=public as $$
declare supplier uuid;new_order uuid;result uuid[]:='{}';subtotal_value numeric;item jsonb;listing record;member_id uuid;recipient uuid;requested_count integer;eligible_count integer;payment_method_value text;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if target_fulfilment not in('delivery','pickup') then raise exception 'Choose delivery or pickup';end if;
 payment_method_value:=case when target_fulfilment='pickup' then 'cash_on_pickup' else 'cash_on_delivery' end;
 if target_customer_organisation is not null then if not has_permission('orders.create',target_customer_organisation) then raise exception 'Order creation permission required';end if;select id into member_id from organisation_members where organisation_id=target_customer_organisation and user_id=auth.uid() and status='active' and is_active;end if;
 if target_fulfilment='delivery' and length(trim(target_address))<3 then raise exception 'Delivery address required';end if;
 requested_count:=jsonb_array_length(cart_items);if requested_count=0 or requested_count>100 then raise exception 'Cart is empty or too large';end if;
 if exists(select 1 from jsonb_array_elements(cart_items)i where coalesce((i->>'quantity')::numeric,0)<=0) then raise exception 'Cart quantities must be positive';end if;
 select count(*) into eligible_count from jsonb_array_elements(cart_items)i join supplier_listings l on l.id=(i->>'listing_id')::uuid
 where marketplace_listing_is_eligible(l) and ((target_fulfilment='delivery' and l.delivery_available)or(target_fulfilment='pickup' and l.pickup_available))
 and (i->>'quantity')::numeric<=case when l.inventory_mode='exact_quantity' then l.stock_quantity else (i->>'quantity')::numeric end;
 if eligible_count<>requested_count then raise exception 'This item is no longer available from this supplier.';end if;
 for supplier in select distinct l.supplier_id from jsonb_array_elements(cart_items)i join supplier_listings l on l.id=(i->>'listing_id')::uuid loop
  select sum(l.price*(i->>'quantity')::numeric) into subtotal_value from jsonb_array_elements(cart_items)i join supplier_listings l on l.id=(i->>'listing_id')::uuid where l.supplier_id=supplier;
  insert into orders(order_number,customer_id,customer_organisation_id,created_by_membership_id,supplier_id,status,subtotal,delivery_address,fulfilment_method,payment_method)
  values('BM-'||to_char(now(),'YYYYMMDD')||'-'||lpad(nextval('order_number_seq')::text,6,'0'),auth.uid(),target_customer_organisation,member_id,supplier,'awaiting_supplier_confirmation',subtotal_value,case when target_fulfilment='pickup' then 'Supplier pickup location' else target_address end,target_fulfilment,payment_method_value) returning id into new_order;
  for item in select * from jsonb_array_elements(cart_items) loop select l.id,l.price,p.name,p.base_unit into listing from supplier_listings l join products p on p.id=l.product_id where l.id=(item->>'listing_id')::uuid and l.supplier_id=supplier and marketplace_listing_is_eligible(l) for update;if found then insert into order_items(order_id,listing_id,product_name_snapshot,quantity,unit,unit_price) values(new_order,listing.id,listing.name,(item->>'quantity')::numeric,listing.base_unit,listing.price);end if;end loop;
  insert into order_events(order_id,event_type,actor_id,note) values(new_order,'submitted',auth.uid(),'Awaiting supplier confirmation');
  for recipient in select om.user_id from organisation_members om where om.organisation_id=supplier and om.status='active' and om.is_active loop perform enqueue_user_notification(recipient,'supplier_order_received',jsonb_build_object('order_id',new_order,'total',subtotal_value,'payment_method',payment_method_value));end loop;
  result:=array_append(result,new_order);
 end loop;return result;
end;$$;

revoke all on function public.marketplace_listing_is_eligible(public.supplier_listings),public.public_marketplace_search_listing_ids(text),public.checkout_cart_for_context(jsonb,text,uuid,text) from public;
grant execute on function public.public_marketplace_search_listing_ids(text) to anon,authenticated;
grant execute on function public.marketplace_listing_is_eligible(public.supplier_listings) to anon,authenticated;
grant execute on function public.checkout_cart_for_context(jsonb,text,uuid,text) to authenticated;

commit;
