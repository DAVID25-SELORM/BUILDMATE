-- Guarded fulfilment, customer confirmation and dispute operations.
create table public.order_disputes (
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id), customer_id uuid not null references public.profiles(id),
 reason text not null check(length(reason) between 10 and 2000), status text not null default 'open' check(status in('open','under_review','resolved','rejected','refunded')),
 resolution_notes text, refund_reference text, resolved_by uuid references public.profiles(id), created_at timestamptz not null default now(), resolved_at timestamptz
);
alter table public.order_disputes enable row level security;
create policy "dispute customer read" on public.order_disputes for select using(customer_id=auth.uid());
create policy "dispute admin manage" on public.order_disputes for all using(public.is_platform_admin()) with check(public.is_platform_admin());

create or replace function public.supplier_progress_order(target_order uuid,new_status public.order_status) returns void language plpgsql security definer set search_path=public as $$
declare current_status public.order_status;begin select status into current_status from public.orders where id=target_order and public.is_org_member(supplier_id) for update;if current_status is null then raise exception 'Order not found';end if;if not((current_status='paid' and new_status='confirmed')or(current_status='confirmed' and new_status='preparing')or(current_status='preparing' and new_status='ready_for_dispatch'))then raise exception 'Invalid order transition';end if;update public.orders set status=new_status,updated_at=now() where id=target_order;end;$$;
grant execute on function public.supplier_progress_order(uuid,public.order_status) to authenticated;

create or replace function public.customer_cancel_order(target_order uuid) returns void language plpgsql security definer set search_path=public as $$
begin update public.orders set status='cancelled',updated_at=now() where id=target_order and customer_id=auth.uid() and status='awaiting_payment';if not found then raise exception 'Order cannot be cancelled';end if;update public.payments set status='cancelled',updated_at=now() where order_id=target_order and status='pending';end;$$;
grant execute on function public.customer_cancel_order(uuid) to authenticated;

create or replace function public.customer_confirm_delivery(target_order uuid) returns void language plpgsql security definer set search_path=public as $$
begin update public.orders set status='completed',updated_at=now() where id=target_order and customer_id=auth.uid() and status='customer_confirmation_pending';if not found then raise exception 'Order is not awaiting confirmation';end if;end;$$;
grant execute on function public.customer_confirm_delivery(uuid) to authenticated;

create or replace function public.customer_open_dispute(target_order uuid,target_reason text) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;begin if length(trim(target_reason))<10 then raise exception 'Provide dispute details';end if;update public.orders set status='disputed',updated_at=now() where id=target_order and customer_id=auth.uid() and status in('customer_confirmation_pending','completed') returning id into result;if result is null then raise exception 'Order cannot be disputed';end if;insert into public.order_disputes(order_id,customer_id,reason)values(target_order,auth.uid(),trim(target_reason))returning id into result;return result;end;$$;
grant execute on function public.customer_open_dispute(uuid,text) to authenticated;

create or replace function public.admin_resolve_dispute(target_dispute uuid,target_outcome text,target_notes text,target_refund_reference text default null) returns void language plpgsql security definer set search_path=public as $$
declare target_order uuid;begin if not public.is_platform_admin()then raise exception 'Not authorised';end if;if target_outcome not in('resolved','rejected','refunded')then raise exception 'Invalid outcome';end if;if target_outcome='refunded' and nullif(trim(target_refund_reference),'')is null then raise exception 'Verified provider refund reference required';end if;update public.order_disputes set status=target_outcome,resolution_notes=nullif(trim(target_notes),''),refund_reference=nullif(trim(target_refund_reference),''),resolved_by=auth.uid(),resolved_at=now() where id=target_dispute and status in('open','under_review')returning order_id into target_order;if target_order is null then raise exception 'Dispute is unavailable';end if;update public.orders set status=case when target_outcome='refunded' then 'refunded'::public.order_status else 'completed'::public.order_status end,updated_at=now() where id=target_order;if target_outcome='refunded' then update public.payments set status='refunded',updated_at=now() where order_id=target_order and status='paid';end if;end;$$;
grant execute on function public.admin_resolve_dispute(uuid,text,text,text) to authenticated;

create or replace function public.ensure_delivery_for_paid_order() returns trigger language plpgsql security definer set search_path=public as $$begin if new.status='ready_for_dispatch' and old.status is distinct from 'ready_for_dispatch' then insert into public.deliveries(order_id,status,delivery_location)values(new.id,'pending_assignment',new.delivery_address)on conflict(order_id)do nothing;end if;return new;end;$$;
create or replace function public.notify_order_status() returns trigger language plpgsql security definer set search_path=public as $$begin if old.status is distinct from new.status then perform public.enqueue_user_notification(new.customer_id,'order_status_changed',jsonb_build_object('order_id',new.id,'order_number',new.order_number,'status',new.status));end if;return new;end;$$;
create trigger order_status_notification after update of status on public.orders for each row execute function public.notify_order_status();
create index idx_order_disputes_status on public.order_disputes(status,created_at desc);
