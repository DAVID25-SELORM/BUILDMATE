-- Forward-only acceptance follow-up. Requires 202608160060.
begin;

drop function if exists public.inventory_record_return(uuid,numeric,text,text,text);

create table public.inventory_setup_progress(
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  supplier_listing_id uuid not null references public.supplier_listings(id) on delete cascade,
  status text not null check(status in('skipped','completed')),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key(organisation_id,supplier_listing_id)
);
alter table public.inventory_setup_progress enable row level security;
revoke all on public.inventory_setup_progress from anon,authenticated;

create or replace function public.persist_completed_stock_setup()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.inventory_mode='exact_quantity' and old.inventory_mode is distinct from new.inventory_mode
    and exists(select 1 from inventory_movements where supplier_listing_id=new.id) then
   insert into inventory_setup_progress(organisation_id,supplier_listing_id,status,updated_by)
   values(new.supplier_id,new.id,'completed',auth.uid())
   on conflict(organisation_id,supplier_listing_id) do update set status='completed',updated_by=excluded.updated_by,updated_at=now();
 end if;
 return new;
end;$$;
create trigger supplier_listing_stock_setup_progress after update of inventory_mode on public.supplier_listings
for each row execute function public.persist_completed_stock_setup();

create or replace function public.inventory_set_setup_progress(target_listing uuid,target_status text)
returns void language plpgsql security definer set search_path=public as $$
declare org uuid;
begin
 select supplier_id into org from supplier_listings where id=target_listing;
 if org is null or not has_permission('inventory.configure',org) then raise exception 'Inventory configuration permission required';end if;
 if target_status not in('skipped','completed') then raise exception 'Invalid stock setup status';end if;
 if target_status='completed' and not exists(select 1 from inventory_movements where supplier_listing_id=target_listing) then raise exception 'Stock setup cannot be completed without a movement';end if;
 insert into inventory_setup_progress(organisation_id,supplier_listing_id,status,updated_by)
 values(org,target_listing,target_status,auth.uid())
 on conflict(organisation_id,supplier_listing_id) do update set status=excluded.status,updated_by=excluded.updated_by,updated_at=now();
end;$$;

create or replace function public.inventory_get_setup_progress(target_organisation uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not has_permission('inventory.view',target_organisation) then raise exception 'Inventory view permission required';end if;
 select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('listing_id',supplier_listing_id,'status',status,'updated_at',updated_at) order by updated_at),'[]'::jsonb),'last_saved_at',max(updated_at)) into result from inventory_setup_progress where organisation_id=target_organisation;
 return result;
end;$$;

revoke all on function public.persist_completed_stock_setup(),public.inventory_set_setup_progress(uuid,text),public.inventory_get_setup_progress(uuid) from public,anon,authenticated;
grant execute on function public.inventory_set_setup_progress(uuid,text),public.inventory_get_setup_progress(uuid) to authenticated;

alter table public.products add column if not exists search_aliases text[] not null default '{}';
update public.products set search_aliases=array['rebar','iron rod'] where lower(name)='reinforcement bar' and search_aliases='{}';
update public.products set search_aliases=array['roofing sheet'] where lower(name) like '%corrugated roofing%' and search_aliases='{}';
update public.products set search_aliases=array['block'] where lower(name) like '%sandcrete block%' and search_aliases='{}';
update public.products set search_aliases=array['pvc'] where lower(name) like 'pvc %' and search_aliases='{}';
create index if not exists products_search_aliases_gin on public.products using gin(search_aliases);

create or replace function public.public_marketplace_search_listing_ids(target_query text)
returns setof uuid language sql stable security definer set search_path=public as $$
 select distinct l.id from supplier_listings l
 join products p on p.id=l.product_id
 join organisations o on o.id=l.supplier_id
 left join brands b on b.id=p.brand_id
 left join product_variants v on v.id=l.product_variant_id
 where l.listing_status='published' and l.is_active and l.price is not null and l.stock_status<>'out_of_stock'
 and p.is_active and o.organisation_type='supplier' and o.verification_status='approved' and coalesce(o.account_status,'active')='active'
 and (trim(coalesce(target_query,''))='' or p.name ilike '%'||trim(target_query)||'%'
   or lower(trim(target_query))=any(p.search_aliases)
   or b.name ilike '%'||trim(target_query)||'%' or v.name ilike '%'||trim(target_query)||'%'
   or v.specifications::text ilike '%'||trim(target_query)||'%')
$$;
revoke all on function public.public_marketplace_search_listing_ids(text) from public;
grant execute on function public.public_marketplace_search_listing_ids(text) to anon,authenticated;

-- Append-only delivery outcomes. A partial or failed attempt never completes
-- the order; cumulative delivered quantities are serialized per delivery.
create table public.delivery_attempts(
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  outcome text not null check(outcome in('delivered','partial','failed')),
  reason text,
  resolution text check(resolution is null or resolution in('reschedule','return_to_origin')),
  rescheduled_for timestamptz,
  proof_urls text[] not null,
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check(cardinality(proof_urls)>0),
  check(outcome='delivered' or length(trim(coalesce(reason,'')))>=5),
  check(outcome<>'failed' or resolution is not null)
);
create table public.delivery_attempt_items(
  attempt_id uuid not null references public.delivery_attempts(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  delivered_quantity numeric not null check(delivered_quantity>=0),
  primary key(attempt_id,order_item_id)
);
create index delivery_attempts_delivery_date on public.delivery_attempts(delivery_id,created_at);
create index delivery_attempt_items_order_item on public.delivery_attempt_items(order_item_id);
alter table public.delivery_attempts enable row level security;
alter table public.delivery_attempt_items enable row level security;
revoke all on public.delivery_attempts,public.delivery_attempt_items from anon,authenticated;

create policy "delivery attempt participant read" on public.delivery_attempts for select to authenticated using(exists(
 select 1 from deliveries d join orders o on o.id=d.order_id where d.id=delivery_id and
 (d.driver_id=auth.uid() or customer_can_read_order(o) or has_permission('deliveries.view',o.supplier_id) or is_platform_admin())
));
create policy "delivery attempt item participant read" on public.delivery_attempt_items for select to authenticated using(exists(
 select 1 from delivery_attempts a join deliveries d on d.id=a.delivery_id join orders o on o.id=d.order_id
 where a.id=attempt_id and (d.driver_id=auth.uid() or customer_can_read_order(o) or has_permission('deliveries.view',o.supplier_id) or is_platform_admin())
));
grant select on public.delivery_attempts,public.delivery_attempt_items to authenticated;

create or replace function public.driver_update_delivery(target_delivery uuid,new_status text)
returns void language plpgsql security definer set search_path=public as $$
declare order_target uuid;
begin
 if new_status not in('picked_up','in_transit') then raise exception 'Invalid delivery status';end if;
 update deliveries set status=new_status,picked_up_at=case when new_status='picked_up' then now() else picked_up_at end,updated_at=now()
 where id=target_delivery and driver_id=auth.uid() and
 ((status='driver_assigned' and new_status='picked_up') or (status='picked_up' and new_status='in_transit') or (status='failed_delivery' and new_status='in_transit'))
 returning order_id into order_target;
 if order_target is null then raise exception 'Invalid delivery transition';end if;
 update orders set status=new_status::order_status,updated_at=now() where id=order_target;
end;$$;

create or replace function public.driver_record_delivery_attempt(
 target_delivery uuid,target_otp text,target_outcome text,target_reason text,target_resolution text,
 target_rescheduled_for timestamptz,target_proofs text[],target_items jsonb
) returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare d deliveries;o orders;a uuid;entry jsonb;item order_items;qty numeric;already numeric;all_delivered boolean;
begin
 if target_outcome not in('delivered','partial','failed') or cardinality(target_proofs)=0 then raise exception 'A valid outcome and proof are required';end if;
 select * into d from deliveries where id=target_delivery for update;
 if d.id is null or d.driver_id is distinct from auth.uid() or d.status not in('in_transit','partially_delivered','failed_delivery') then raise exception 'Delivery attempt is unavailable';end if;
 if target_outcome<>'failed' and (d.otp_hash is null or d.otp_hash<>extensions.crypt(target_otp,d.otp_hash)) then raise exception 'OTP is invalid';end if;
 select * into o from orders where id=d.order_id for update;
 if target_outcome<>'delivered' and length(trim(coalesce(target_reason,'')))<5 then raise exception 'A detailed delivery exception reason is required';end if;
 if target_outcome='failed' and target_resolution not in('reschedule','return_to_origin') then raise exception 'Choose reschedule or return to origin';end if;
 if target_outcome='failed' and target_resolution='reschedule' and target_rescheduled_for is null then raise exception 'Choose a reschedule date';end if;
 if target_outcome='failed' and target_resolution='return_to_origin' and exists(select 1 from delivery_attempt_items ai join delivery_attempts da on da.id=ai.attempt_id where da.delivery_id=d.id and ai.delivered_quantity>0) then raise exception 'A partially delivered order requires dispute resolution';end if;
 insert into delivery_attempts(delivery_id,outcome,reason,resolution,rescheduled_for,proof_urls,recorded_by)
 values(d.id,target_outcome,nullif(trim(coalesce(target_reason,'')),''),target_resolution,target_rescheduled_for,target_proofs,auth.uid()) returning id into a;
 for entry in select * from jsonb_array_elements(coalesce(target_items,'[]'::jsonb)) loop
   select * into item from order_items where id=(entry->>'order_item_id')::uuid and order_id=o.id for update;
   if item.id is null then raise exception 'Delivery item is invalid';end if;
   qty:=coalesce((entry->>'delivered_quantity')::numeric,0);
   select coalesce(sum(ai.delivered_quantity),0) into already from delivery_attempt_items ai join delivery_attempts da on da.id=ai.attempt_id where ai.order_item_id=item.id;
   if qty<0 or already+qty>item.quantity then raise exception 'Delivered quantity exceeds ordered quantity';end if;
   insert into delivery_attempt_items(attempt_id,order_item_id,delivered_quantity) values(a,item.id,qty);
 end loop;
 select bool_and(coalesce((select sum(ai.delivered_quantity) from delivery_attempt_items ai join delivery_attempts da on da.id=ai.attempt_id where ai.order_item_id=oi.id),0)=oi.quantity)
 into all_delivered from order_items oi where oi.order_id=o.id;
 if all_delivered then
   update deliveries set status='delivered',proof_urls=proof_urls||target_proofs,otp_verified_at=now(),delivered_at=now(),updated_at=now() where id=d.id;
   update orders set status='customer_confirmation_pending',updated_at=now() where id=o.id;
 elsif target_outcome='failed' then
   update deliveries set status=case when target_resolution='return_to_origin' then 'return_to_origin' else 'failed_delivery' end,proof_urls=proof_urls||target_proofs,updated_at=now() where id=d.id;
   update orders set status=case when exists(select 1 from delivery_attempt_items ai join delivery_attempts da on da.id=ai.attempt_id where da.delivery_id=d.id and ai.delivered_quantity>0) then 'partially_delivered'::order_status else 'in_transit'::order_status end,updated_at=now() where id=o.id;
 else
   update deliveries set status='partially_delivered',proof_urls=proof_urls||target_proofs,otp_verified_at=now(),updated_at=now() where id=d.id;
   update orders set status='partially_delivered',updated_at=now() where id=o.id;
 end if;
 insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'delivery_attempt',a::text,'DELIVERY_ATTEMPT_RECORDED',jsonb_build_object('delivery_id',d.id,'order_id',o.id,'outcome',target_outcome,'resolution',target_resolution,'all_delivered',all_delivered,'payment_status_unchanged',true));
 return a;
end;$$;

revoke all on function public.driver_record_delivery_attempt(uuid,text,text,text,text,timestamptz,text[],jsonb) from public,anon;
grant execute on function public.driver_record_delivery_attempt(uuid,text,text,text,text,timestamptz,text[],jsonb) to authenticated;

-- Paid funds are not supplier-available until the customer confirms complete
-- delivery. Exceptions keep funds pending; a confirmed return-to-origin marks
-- the payment for refund and reverses the unpaid supplier receivable.
create or replace function public.create_supplier_receivable()
returns trigger language plpgsql security definer set search_path=public as $$
declare target_order orders;
begin
 if new.status='paid' and old.status is distinct from 'paid' then
  select * into target_order from orders where id=new.order_id;
  insert into supplier_ledger_entries(supplier_id,order_id,payment_id,entry_type,amount,status,description)
  values(target_order.supplier_id,target_order.id,new.id,'sale',target_order.subtotal,'pending','Receivable pending completed delivery for '||target_order.order_number)
  on conflict(order_id,entry_type) do nothing;
 end if;
 return new;
end;$$;

create or replace function public.sync_supplier_receivable_with_order()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='completed' and old.status is distinct from new.status then
   update supplier_ledger_entries set status='available',description='Receivable for completed '||new.order_number where order_id=new.id and entry_type='sale' and status='pending';
 elsif new.status in('cancelled','refunded') and old.status is distinct from new.status then
   update supplier_ledger_entries set status='reversed',description='Reversed after order '||new.status::text where order_id=new.id and entry_type='sale' and status in('pending','available');
 end if;
 return new;
end;$$;
create trigger supplier_receivable_order_lifecycle after update of status on public.orders
for each row execute function public.sync_supplier_receivable_with_order();

update supplier_ledger_entries e set status='pending',description='Receivable pending completed delivery for '||o.order_number
from orders o where o.id=e.order_id and e.entry_type='sale' and e.status='available' and o.status not in('completed','cancelled','refunded');
update supplier_ledger_entries e set status='reversed',description='Reversed after order '||o.status::text
from orders o where o.id=e.order_id and e.entry_type='sale' and e.status in('pending','available') and o.status in('cancelled','refunded');

create or replace function public.supplier_confirm_return_to_origin(target_delivery uuid,target_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare d deliveries;o orders;
begin
 select * into d from deliveries where id=target_delivery for update;
 if d.id is null then raise exception 'Delivery not found';end if;
 select * into o from orders where id=d.order_id for update;
 if not has_permission('deliveries.manage',o.supplier_id) then raise exception 'Delivery management permission required';end if;
 if d.status<>'return_to_origin' or length(trim(coalesce(target_reason,'')))<5 then raise exception 'Return-to-origin confirmation and reason are required';end if;
 if exists(select 1 from delivery_attempt_items ai join delivery_attempts a on a.id=ai.attempt_id where a.delivery_id=d.id and ai.delivered_quantity>0) then raise exception 'A partially delivered order requires dispute resolution';end if;
 update orders set status='cancelled',updated_at=now() where id=o.id;
 update payments set status='refund_pending' where order_id=o.id and status='paid';
 insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'delivery',d.id::text,'RETURN_TO_ORIGIN_CONFIRMED',jsonb_build_object('order_id',o.id,'reason',trim(target_reason),'inventory_reservation_released',true,'payment_refund_pending',true));
end;$$;

revoke all on function public.create_supplier_receivable(),public.sync_supplier_receivable_with_order(),public.supplier_confirm_return_to_origin(uuid,text) from public,anon,authenticated;
grant execute on function public.supplier_confirm_return_to_origin(uuid,text) to authenticated;

commit;
