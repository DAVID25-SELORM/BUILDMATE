-- Forward-only correction after 202608160061: make delivery attempts
-- idempotent and keep service-context listing updates from failing setup audit.
begin;

alter table public.delivery_attempts add column if not exists request_key uuid;
create unique index if not exists delivery_attempts_request_key_unique
  on public.delivery_attempts(delivery_id,request_key) where request_key is not null;

create or replace function public.persist_completed_stock_setup()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then return new;end if;
 if new.inventory_mode='exact_quantity' and old.inventory_mode is distinct from new.inventory_mode
    and exists(select 1 from inventory_movements where supplier_listing_id=new.id) then
   insert into inventory_setup_progress(organisation_id,supplier_listing_id,status,updated_by)
   values(new.supplier_id,new.id,'completed',auth.uid())
   on conflict(organisation_id,supplier_listing_id) do update
   set status='completed',updated_by=excluded.updated_by,updated_at=now();
 end if;
 return new;
end;$$;

drop function if exists public.driver_record_delivery_attempt(uuid,text,text,text,text,timestamptz,text[],jsonb);
create function public.driver_record_delivery_attempt(
 target_delivery uuid,target_otp text,target_outcome text,target_reason text,target_resolution text,
 target_rescheduled_for timestamptz,target_proofs text[],target_items jsonb,target_request_key uuid
) returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare d deliveries;o orders;a uuid;entry jsonb;item order_items;qty numeric;already numeric;all_delivered boolean;
begin
 if target_request_key is null then raise exception 'A delivery request key is required';end if;
 select da.id into a from delivery_attempts da join deliveries existing_delivery on existing_delivery.id=da.delivery_id
 where da.delivery_id=target_delivery and da.request_key=target_request_key and existing_delivery.driver_id=auth.uid();
 if a is not null then return a;end if;
 if target_outcome not in('delivered','partial','failed') or cardinality(target_proofs)=0 then raise exception 'A valid outcome and proof are required';end if;
 select * into d from deliveries where id=target_delivery for update;
 if d.id is null or d.driver_id is distinct from auth.uid() or d.status not in('in_transit','partially_delivered','failed_delivery') then raise exception 'Delivery attempt is unavailable';end if;
 select da.id into a from delivery_attempts da where da.delivery_id=d.id and da.request_key=target_request_key;
 if a is not null then return a;end if;
 if target_outcome<>'failed' and (d.otp_hash is null or d.otp_hash<>extensions.crypt(target_otp,d.otp_hash)) then raise exception 'OTP is invalid';end if;
 select * into o from orders where id=d.order_id for update;
 if target_outcome<>'delivered' and length(trim(coalesce(target_reason,'')))<5 then raise exception 'A detailed delivery exception reason is required';end if;
 if target_outcome='failed' and target_resolution not in('reschedule','return_to_origin') then raise exception 'Choose reschedule or return to origin';end if;
 if target_outcome='failed' and target_resolution='reschedule' and target_rescheduled_for is null then raise exception 'Choose a reschedule date';end if;
 if target_outcome='failed' and target_resolution='return_to_origin' and exists(select 1 from delivery_attempt_items ai join delivery_attempts da on da.id=ai.attempt_id where da.delivery_id=d.id and ai.delivered_quantity>0) then raise exception 'A partially delivered order requires dispute resolution';end if;
 insert into delivery_attempts(delivery_id,outcome,reason,resolution,rescheduled_for,proof_urls,recorded_by,request_key)
 values(d.id,target_outcome,nullif(trim(coalesce(target_reason,'')),''),target_resolution,target_rescheduled_for,target_proofs,auth.uid(),target_request_key) returning id into a;
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
 if target_outcome='delivered' and not coalesce(all_delivered,false) then raise exception 'Delivered in full requires every outstanding item quantity';end if;
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
 insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'delivery_attempt',a::text,'DELIVERY_ATTEMPT_RECORDED',jsonb_build_object('delivery_id',d.id,'order_id',o.id,'outcome',target_outcome,'resolution',target_resolution,'all_delivered',all_delivered,'request_key',target_request_key,'payment_status_unchanged',true));
 return a;
end;$$;

revoke all on function public.driver_record_delivery_attempt(uuid,text,text,text,text,timestamptz,text[],jsonb,uuid) from public,anon;
grant execute on function public.driver_record_delivery_attempt(uuid,text,text,text,text,timestamptz,text[],jsonb,uuid) to authenticated;

commit;
