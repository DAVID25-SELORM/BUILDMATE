-- Phase 6: payment attempts, idempotent provider events and guarded state changes.

alter table public.payments add column if not exists idempotency_key text;
alter table public.payments add column if not exists checkout_url text;
alter table public.payments add column if not exists updated_at timestamptz not null default now();
create unique index if not exists payments_idempotency_key_unique on public.payments(idempotency_key);

create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  provider_event_id text not null,
  payment_id uuid references public.payments(id),
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);
alter table public.payment_events enable row level security;

create policy "customer payment read" on public.payments for select using (
  exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid())
);
create policy "supplier payment read" on public.payments for select using (
  exists(select 1 from public.orders o where o.id=order_id and public.is_org_member(o.supplier_id))
);
create policy "admin payment read" on public.payments for select using (public.is_platform_admin());
create policy "admin payment events read" on public.payment_events for select using (public.is_platform_admin());

create or replace function public.begin_payment(target_order uuid, target_provider text)
returns public.payments language plpgsql security definer set search_path=public as $$
declare target public.orders; attempt public.payments;
begin
  select * into target from public.orders where id=target_order for update;
  if target.customer_id<>auth.uid() then raise exception 'Not authorised'; end if;
  if target.status<>'awaiting_payment' then raise exception 'Order is not awaiting payment'; end if;
  insert into public.payments(order_id,provider,amount,currency,status,idempotency_key)
  values(target.id,target_provider,target.total,'GHS','pending',target_provider||':'||target.id)
  on conflict(idempotency_key) do update set updated_at=now()
  returning * into attempt;
  return attempt;
end; $$;
grant execute on function public.begin_payment(uuid,text) to authenticated;

create or replace function public.record_verified_payment(
  target_provider text, target_event_id text, target_reference text,
  target_status text, target_amount numeric, event_payload jsonb
) returns boolean language plpgsql security definer set search_path=public as $$
declare payment_row public.payments; inserted_event bigint;
begin
  insert into public.payment_events(provider,provider_event_id,event_type,payload)
  values(target_provider,target_event_id,target_status,event_payload)
  on conflict(provider,provider_event_id) do nothing returning id into inserted_event;
  if inserted_event is null then return false; end if;
  select * into payment_row from public.payments where provider=target_provider and provider_reference=target_reference for update;
  if payment_row.id is null then raise exception 'Payment not found'; end if;
  if payment_row.amount<>target_amount then raise exception 'Payment amount mismatch'; end if;
  update public.payment_events set payment_id=payment_row.id,processed_at=now() where id=inserted_event;
  if target_status='paid' and payment_row.status<>'paid' then
    update public.payments set status='paid',paid_at=now(),raw_response=event_payload,updated_at=now() where id=payment_row.id;
    update public.orders set status='paid',updated_at=now() where id=payment_row.order_id and status='awaiting_payment';
  elsif target_status in ('failed','cancelled') and payment_row.status='pending' then
    update public.payments set status=target_status,raw_response=event_payload,updated_at=now() where id=payment_row.id;
  end if;
  return true;
end; $$;
revoke all on function public.record_verified_payment(text,text,text,text,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.record_verified_payment(text,text,text,text,numeric,jsonb) to service_role;
