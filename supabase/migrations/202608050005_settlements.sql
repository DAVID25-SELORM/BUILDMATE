-- Phase 7: supplier ledger, payout records and payment reconciliation.
create table public.supplier_ledger_entries(
 id uuid primary key default gen_random_uuid(), supplier_id uuid not null references public.organisations(id), order_id uuid references public.orders(id), payment_id uuid references public.payments(id), entry_type text not null check(entry_type in('sale','refund','adjustment','payout')), amount numeric(14,2) not null, currency text not null default 'GHS', status text not null default 'available' check(status in('pending','available','paid','reversed')), description text, created_at timestamptz not null default now(), settled_at timestamptz, unique(order_id,entry_type)
);
create table public.reconciliation_runs(
 id uuid primary key default gen_random_uuid(), provider text not null, period_start timestamptz not null, period_end timestamptz not null, expected_amount numeric(14,2) not null, provider_amount numeric(14,2) not null, variance numeric(14,2) generated always as(provider_amount-expected_amount) stored, status text not null check(status in('matched','variance','reviewed')), created_by uuid references public.profiles(id), notes text, created_at timestamptz not null default now()
);
alter table public.supplier_ledger_entries enable row level security;alter table public.reconciliation_runs enable row level security;
create policy "supplier ledger read" on public.supplier_ledger_entries for select using(public.is_org_member(supplier_id));
create policy "admin ledger read" on public.supplier_ledger_entries for select using(public.is_platform_admin());
create policy "admin reconciliation manage" on public.reconciliation_runs for all using(public.is_platform_admin()) with check(public.is_platform_admin());
create index idx_supplier_ledger_supplier on public.supplier_ledger_entries(supplier_id,status,created_at desc);

create or replace function public.create_supplier_receivable() returns trigger language plpgsql security definer set search_path=public as $$
declare target_order public.orders;
begin
 if new.status='paid' and old.status is distinct from 'paid' then
  select * into target_order from public.orders where id=new.order_id;
  insert into public.supplier_ledger_entries(supplier_id,order_id,payment_id,entry_type,amount,status,description)
  values(target_order.supplier_id,target_order.id,new.id,'sale',target_order.subtotal,'available','Receivable for '||target_order.order_number)
  on conflict(order_id,entry_type) do nothing;
 end if;return new;
end;$$;
drop trigger if exists payment_receivable on public.payments;create trigger payment_receivable after update on public.payments for each row execute function public.create_supplier_receivable();

create or replace function public.admin_mark_ledger_paid(target_entry uuid, payout_reference text) returns void language plpgsql security definer set search_path=public as $$
begin if not public.is_platform_admin() then raise exception 'Not authorised';end if;update public.supplier_ledger_entries set status='paid',settled_at=now(),description=description||' · Payout '||payout_reference where id=target_entry and status='available';if not found then raise exception 'Ledger entry is unavailable';end if;end;$$;
grant execute on function public.admin_mark_ledger_paid(uuid,text) to authenticated;
