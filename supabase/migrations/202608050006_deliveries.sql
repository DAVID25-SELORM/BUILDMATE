-- Phase 8: delivery assignment, OTP confirmation and proof of delivery.
alter table public.deliveries add column if not exists assigned_at timestamptz;
alter table public.deliveries add column if not exists picked_up_at timestamptz;
alter table public.deliveries add column if not exists otp_verified_at timestamptz;
alter table public.deliveries add column if not exists updated_at timestamptz not null default now();
create unique index if not exists deliveries_order_unique on public.deliveries(order_id);
create policy "delivery customer read" on public.deliveries for select using(exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid()));
create policy "delivery supplier read" on public.deliveries for select using(exists(select 1 from public.orders o where o.id=order_id and public.is_org_member(o.supplier_id)));
create policy "delivery driver read" on public.deliveries for select using(driver_id=auth.uid());
create policy "delivery admin manage" on public.deliveries for all using(public.is_platform_admin()) with check(public.is_platform_admin());

insert into storage.buckets(id,name,public) values('delivery-proofs','delivery-proofs',false) on conflict(id) do update set public=false;
create policy "delivery proof driver insert" on storage.objects for insert to authenticated with check(bucket_id='delivery-proofs' and exists(select 1 from public.deliveries d where d.id=((storage.foldername(name))[1])::uuid and d.driver_id=auth.uid()));
create policy "delivery proof participant read" on storage.objects for select to authenticated using(bucket_id='delivery-proofs' and exists(select 1 from public.deliveries d join public.orders o on o.id=d.order_id where d.id=((storage.foldername(name))[1])::uuid and (d.driver_id=auth.uid() or o.customer_id=auth.uid() or public.is_org_member(o.supplier_id) or public.is_platform_admin())));

create or replace function public.ensure_delivery_for_paid_order() returns trigger language plpgsql security definer set search_path=public as $$begin if new.status='paid' and old.status is distinct from 'paid' then insert into public.deliveries(order_id,status,delivery_location) values(new.id,'pending_assignment',new.delivery_address) on conflict(order_id) do nothing;end if;return new;end;$$;
drop trigger if exists paid_order_delivery on public.orders;create trigger paid_order_delivery after update on public.orders for each row execute function public.ensure_delivery_for_paid_order();

create or replace function public.admin_assign_delivery(target_delivery uuid,target_driver uuid,target_vehicle text,target_otp text) returns void language plpgsql security definer set search_path=public as $$
begin if not public.is_platform_admin() then raise exception 'Not authorised';end if;if not exists(select 1 from public.profiles where id=target_driver and role='driver') then raise exception 'Driver account required';end if;update public.deliveries set driver_id=target_driver,vehicle_registration=target_vehicle,otp_hash=crypt(target_otp,gen_salt('bf')),status='driver_assigned',assigned_at=now(),updated_at=now() where id=target_delivery and status='pending_assignment';if not found then raise exception 'Delivery cannot be assigned';end if;update public.orders set status='driver_assigned',updated_at=now() where id=(select order_id from public.deliveries where id=target_delivery);end;$$;
grant execute on function public.admin_assign_delivery(uuid,uuid,text,text) to authenticated;

create or replace function public.driver_update_delivery(target_delivery uuid,new_status text) returns void language plpgsql security definer set search_path=public as $$
declare order_target uuid;begin if new_status not in('picked_up','in_transit') then raise exception 'Invalid delivery status';end if;update public.deliveries set status=new_status,picked_up_at=case when new_status='picked_up' then now() else picked_up_at end,updated_at=now() where id=target_delivery and driver_id=auth.uid() and ((status='driver_assigned' and new_status='picked_up') or (status='picked_up' and new_status='in_transit')) returning order_id into order_target;if order_target is null then raise exception 'Invalid delivery transition';end if;update public.orders set status=new_status::public.order_status,updated_at=now() where id=order_target;end;$$;
grant execute on function public.driver_update_delivery(uuid,text) to authenticated;

create or replace function public.driver_complete_delivery(target_delivery uuid,target_otp text,target_proofs text[]) returns void language plpgsql security definer set search_path=public as $$
declare order_target uuid;begin update public.deliveries set status='delivered',proof_urls=target_proofs,otp_verified_at=now(),delivered_at=now(),updated_at=now() where id=target_delivery and driver_id=auth.uid() and status='in_transit' and otp_hash=crypt(target_otp,otp_hash) and cardinality(target_proofs)>0 returning order_id into order_target;if order_target is null then raise exception 'OTP is invalid or proof is missing';end if;update public.orders set status='customer_confirmation_pending',updated_at=now() where id=order_target;end;$$;
grant execute on function public.driver_complete_delivery(uuid,text,text[]) to authenticated;
