-- COD rollout, explicit supplier acknowledgement, order events, and automatic
-- recovery of previously published exact-stock offers after replenishment.
begin;

alter table public.orders
  add column if not exists fulfilment_method text not null default 'delivery' check(fulfilment_method in('delivery','pickup')),
  add column if not exists payment_method text not null default 'cash_on_delivery' check(payment_method in('cash_on_delivery','cash_on_pickup','online')),
  add column if not exists supplier_received_at timestamptz,
  add column if not exists supplier_received_by uuid references public.profiles(id),
  add column if not exists rejection_reason text;

create table if not exists public.marketplace_payment_settings(
  id boolean primary key default true check(id),
  cash_on_delivery_enabled boolean not null default true,
  cash_on_pickup_enabled boolean not null default true,
  online_payment_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.marketplace_payment_settings(id) values(true) on conflict(id) do nothing;
alter table public.marketplace_payment_settings enable row level security;
revoke all on public.marketplace_payment_settings from anon,authenticated;

create table if not exists public.order_events(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_date on public.order_events(order_id,created_at);
alter table public.order_events enable row level security;
create policy "order event participant read" on public.order_events for select to authenticated using(exists(
  select 1 from public.orders o where o.id=order_id and (public.customer_can_read_order(o) or public.has_permission('orders.view',o.supplier_id) or public.is_platform_admin())
));
revoke all on public.order_events from anon,authenticated;
grant select on public.order_events to authenticated;

create table if not exists public.order_cash_payments(
  order_id uuid primary key references public.orders(id) on delete restrict,
  amount numeric(14,2) not null check(amount>0),
  method text not null check(method in('cash_on_delivery','cash_on_pickup')),
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default now(),
  customer_confirmed_at timestamptz,
  customer_confirmed_by uuid references public.profiles(id)
);
alter table public.order_cash_payments enable row level security;
create policy "cash payment participant read" on public.order_cash_payments for select to authenticated using(exists(select 1 from orders o where o.id=order_id and (customer_can_read_order(o) or has_permission('finance.view',o.supplier_id) or is_platform_admin())));
revoke all on public.order_cash_payments from anon,authenticated;
grant select on public.order_cash_payments to authenticated;

create or replace function public.restore_replenished_published_listing()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.inventory_mode='exact_quantity' and coalesce(new.stock_quantity,0)>0 and new.listing_status='out_of_stock' then
    new.listing_status:='published'; new.is_active:=true;
  end if;
  return new;
end;$$;
drop trigger if exists restore_replenished_published_listing on public.supplier_listings;
create trigger restore_replenished_published_listing before update of stock_quantity,listing_status,is_active on public.supplier_listings
for each row execute function public.restore_replenished_published_listing();

drop function if exists public.checkout_cart_for_context(jsonb,text,uuid);
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
 select count(*) into eligible_count from jsonb_array_elements(cart_items) i join supplier_listings l on l.id=(i->>'listing_id')::uuid join organisations o on o.id=l.supplier_id
 where l.is_active and l.listing_status='published' and l.price is not null and l.stock_status<>'out_of_stock' and o.organisation_type='supplier' and o.verification_status='approved' and coalesce(o.account_status,'active')='active'
 and ((target_fulfilment='delivery' and l.delivery_available) or (target_fulfilment='pickup' and l.pickup_available));
 if eligible_count<>requested_count then raise exception 'One or more offers are no longer available for this fulfilment method';end if;
 if exists(select 1 from jsonb_array_elements(cart_items) i join supplier_listings l on l.id=(i->>'listing_id')::uuid where l.inventory_mode='exact_quantity' and (i->>'quantity')::numeric>(select coalesce(sum(b.available_quantity),0) from inventory_balances b where b.supplier_listing_id=l.id)) then raise exception 'Requested quantity exceeds currently available stock';end if;
 for supplier in select distinct l.supplier_id from jsonb_array_elements(cart_items) i join supplier_listings l on l.id=(i->>'listing_id')::uuid loop
   select sum(l.price*(i->>'quantity')::numeric) into subtotal_value from jsonb_array_elements(cart_items) i join supplier_listings l on l.id=(i->>'listing_id')::uuid where l.supplier_id=supplier;
   insert into orders(order_number,customer_id,customer_organisation_id,created_by_membership_id,supplier_id,status,subtotal,delivery_address,fulfilment_method,payment_method)
   values('BM-'||to_char(now(),'YYYYMMDD')||'-'||lpad(nextval('order_number_seq')::text,6,'0'),auth.uid(),target_customer_organisation,member_id,supplier,'awaiting_supplier_confirmation',subtotal_value,case when target_fulfilment='pickup' then 'Supplier pickup location' else target_address end,target_fulfilment,payment_method_value) returning id into new_order;
   for item in select * from jsonb_array_elements(cart_items) loop select l.id,l.price,p.name,p.base_unit into listing from supplier_listings l join products p on p.id=l.product_id where l.id=(item->>'listing_id')::uuid and l.supplier_id=supplier for update;if found then insert into order_items(order_id,listing_id,product_name_snapshot,quantity,unit,unit_price) values(new_order,listing.id,listing.name,(item->>'quantity')::numeric,listing.base_unit,listing.price);end if;end loop;
   insert into order_events(order_id,event_type,actor_id,note) values(new_order,'submitted',auth.uid(),'Awaiting supplier confirmation');
   for recipient in select om.user_id from organisation_members om where om.organisation_id=supplier and om.status='active' and om.is_active loop perform enqueue_user_notification(recipient,'supplier_order_received',jsonb_build_object('order_id',new_order,'total',subtotal_value,'payment_method',payment_method_value));end loop;
   result:=array_append(result,new_order);
 end loop;return result;
end;$$;

create or replace function public.supplier_acknowledge_order(target_order uuid) returns void language plpgsql security definer set search_path=public as $$
declare o orders;begin select * into o from orders where id=target_order for update;if o.id is null or not has_permission('orders.view',o.supplier_id) then raise exception 'Order unavailable';end if;if o.status<>'awaiting_supplier_confirmation' then raise exception 'Order is not awaiting acknowledgement';end if;if o.supplier_received_at is null then update orders set supplier_received_at=now(),supplier_received_by=auth.uid(),updated_at=now() where id=o.id;insert into order_events(order_id,event_type,actor_id) values(o.id,'received_by_supplier',auth.uid());perform enqueue_user_notification(o.customer_id,'order_status_changed',jsonb_build_object('order_id',o.id,'order_number',o.order_number,'status','received_by_supplier'));end if;end;$$;

create or replace function public.supplier_reject_order(target_order uuid,target_reason text) returns void language plpgsql security definer set search_path=public as $$
declare o orders;begin select * into o from orders where id=target_order for update;if o.id is null or not has_permission('orders.accept',o.supplier_id) then raise exception 'Order unavailable';end if;if o.status<>'awaiting_supplier_confirmation' or length(trim(coalesce(target_reason,'')))<5 then raise exception 'A detailed rejection reason is required';end if;update orders set status='cancelled',rejection_reason=trim(target_reason),updated_at=now() where id=o.id;insert into order_events(order_id,event_type,actor_id,note) values(o.id,'rejected',auth.uid(),trim(target_reason));perform enqueue_user_notification(o.customer_id,'order_status_changed',jsonb_build_object('order_id',o.id,'order_number',o.order_number,'status','rejected','reason',trim(target_reason)));end;$$;

create or replace function public.supplier_progress_order(target_order uuid,new_status public.order_status) returns void language plpgsql security definer set search_path=public as $$
declare current_status order_status;supplier uuid;customer uuid;begin select status,supplier_id,customer_id into current_status,supplier,customer from orders where id=target_order and has_permission('orders.accept',supplier_id) for update;if current_status is null then raise exception 'Order not found or supplier acceptance is restricted';end if;if not((current_status='awaiting_supplier_confirmation' and new_status='confirmed')or(current_status='confirmed' and new_status='preparing')or(current_status='preparing' and new_status='ready_for_dispatch'))then raise exception 'Invalid order transition';end if;update orders set status=new_status,supplier_received_at=coalesce(supplier_received_at,now()),supplier_received_by=coalesce(supplier_received_by,auth.uid()),updated_at=now() where id=target_order;insert into order_events(order_id,event_type,actor_id) values(target_order,new_status::text,auth.uid());perform enqueue_user_notification(customer,'order_status_changed',jsonb_build_object('order_id',target_order,'status',new_status));end;$$;

create or replace function public.supplier_record_cash_payment(target_order uuid) returns void language plpgsql security definer set search_path=public as $$
declare o orders;begin select * into o from orders where id=target_order for update;if o.id is null or not has_permission('finance.view',o.supplier_id) then raise exception 'Finance permission required';end if;if o.payment_method not in('cash_on_delivery','cash_on_pickup') or o.status not in('customer_confirmation_pending','delivered') then raise exception 'Cash can only be recorded after fulfilment';end if;insert into order_cash_payments(order_id,amount,method,recorded_by) values(o.id,o.total,o.payment_method,auth.uid()) on conflict(order_id) do nothing;insert into order_events(order_id,event_type,actor_id,note) values(o.id,'cash_payment_recorded',auth.uid(),'Customer confirmation pending');end;$$;

create or replace function public.customer_confirm_delivery(target_order uuid) returns void language plpgsql security definer set search_path=public as $$
declare o orders;begin select * into o from orders where id=target_order for update;if o.id is null or not customer_can_read_order(o) or o.status<>'customer_confirmation_pending' then raise exception 'Order is not awaiting confirmation';end if;if o.payment_method in('cash_on_delivery','cash_on_pickup') and not exists(select 1 from order_cash_payments where order_id=o.id) then raise exception 'Ask the supplier or driver to record the cash payment before confirming completion';end if;update order_cash_payments set customer_confirmed_at=now(),customer_confirmed_by=auth.uid() where order_id=o.id;update orders set status='completed',updated_at=now() where id=o.id;insert into order_events(order_id,event_type,actor_id) values(o.id,'completed',auth.uid());end;$$;

create or replace function public.customer_cancel_order(target_order uuid) returns void language plpgsql security definer set search_path=public as $$declare o orders;begin select * into o from orders where id=target_order for update;if o.id is null or not customer_can_read_order(o) or o.status not in('awaiting_payment','awaiting_supplier_confirmation') then raise exception 'Order cannot be cancelled';end if;update orders set status='cancelled',updated_at=now() where id=o.id;insert into order_events(order_id,event_type,actor_id,note) values(o.id,'cancelled',auth.uid(),'Cancelled by customer');end;$$;

revoke all on function public.restore_replenished_published_listing(),public.checkout_cart_for_context(jsonb,text,uuid,text),public.supplier_acknowledge_order(uuid),public.supplier_reject_order(uuid,text),public.supplier_progress_order(uuid,public.order_status),public.supplier_record_cash_payment(uuid),public.customer_confirm_delivery(uuid),public.customer_cancel_order(uuid) from public,anon;
grant execute on function public.checkout_cart_for_context(jsonb,text,uuid,text),public.supplier_acknowledge_order(uuid),public.supplier_reject_order(uuid,text),public.supplier_progress_order(uuid,public.order_status),public.supplier_record_cash_payment(uuid),public.customer_confirm_delivery(uuid),public.customer_cancel_order(uuid) to authenticated;
commit;
