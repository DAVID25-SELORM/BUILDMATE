-- Phase 1 foundation: explicit supplier listing lifecycle, richer fulfilment data,
-- and a safe bulk tick-to-draft operation against BuildMate-owned products.

do $$ begin
  create type public.supplier_listing_status as enum
    ('draft','published','out_of_stock','seasonal','discontinued','suspended');
exception when duplicate_object then null;
end $$;

alter table public.supplier_listings
  alter column price drop not null,
  add column if not exists listing_status public.supplier_listing_status not null default 'draft',
  add column if not exists minimum_order_quantity numeric check(minimum_order_quantity is null or minimum_order_quantity > 0),
  add column if not exists delivery_available boolean not null default true,
  add column if not exists pickup_available boolean not null default true,
  add column if not exists supplier_notes text check(supplier_notes is null or char_length(supplier_notes) <= 2000),
  add column if not exists reserved_quantity numeric not null default 0 check(reserved_quantity >= 0),
  add column if not exists sold_quantity numeric not null default 0 check(sold_quantity >= 0),
  add column if not exists damaged_quantity numeric not null default 0 check(damaged_quantity >= 0),
  add column if not exists low_stock_threshold numeric check(low_stock_threshold is null or low_stock_threshold >= 0),
  add column if not exists availability_confirmed_at timestamptz,
  add column if not exists price_valid_until date;

update public.supplier_listings
set listing_status = case
  when is_active and stock_status = 'out_of_stock' then 'out_of_stock'::public.supplier_listing_status
  when is_active then 'published'::public.supplier_listing_status
  else 'draft'::public.supplier_listing_status
end;

alter table public.supplier_listings
  drop constraint if exists supplier_listings_publishable_check;
alter table public.supplier_listings
  add constraint supplier_listings_publishable_check check(
    listing_status <> 'published' or (
      price is not null and price >= 0 and
      stock_status <> 'out_of_stock' and
      (delivery_available or pickup_available)
    )
  );

create index if not exists idx_listings_public_product
  on public.supplier_listings(product_id,price,lead_time_days)
  where listing_status = 'published';

drop policy if exists "public active listings" on public.supplier_listings;
create policy "public published approved listings" on public.supplier_listings for select
using (
  listing_status = 'published'
  and is_active
  and exists (
    select 1 from public.organisations o
    where o.id = supplier_id
      and o.organisation_type = 'supplier'
      and o.verification_status = 'approved'
      and coalesce(o.account_status, 'active') = 'active'
  )
);

create or replace function public.create_supplier_listing_drafts(
  target_supplier uuid,
  target_product_ids uuid[]
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  inserted_count integer := 0;
begin
  if target_supplier is null or coalesce(cardinality(target_product_ids), 0) = 0 then
    raise exception 'Choose at least one catalogue product';
  end if;
  if cardinality(target_product_ids) > 250 then
    raise exception 'Select no more than 250 products at a time';
  end if;
  if not public.has_permission('products.create', target_supplier) then
    raise exception 'Products create permission required';
  end if;
  if not exists (
    select 1 from public.organisations
    where id = target_supplier and organisation_type = 'supplier'
  ) then
    raise exception 'Supplier organisation required';
  end if;

  insert into public.supplier_listings(
    supplier_id, product_id, price, stock_status, is_active, listing_status
  )
  select target_supplier, p.id, null, 'confirmation_required', false, 'draft'
  from public.products p
  where p.id = any(target_product_ids)
    and p.is_active
    and not exists (
      select 1 from public.supplier_listings l
      where l.supplier_id = target_supplier and l.product_id = p.id and l.sku is null
    );
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.create_supplier_listing_drafts(uuid,uuid[]) from public,anon;
grant execute on function public.create_supplier_listing_drafts(uuid,uuid[]) to authenticated;
