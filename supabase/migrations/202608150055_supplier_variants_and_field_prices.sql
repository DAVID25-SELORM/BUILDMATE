-- Structured variants and append-only supplier price history.
-- Applies only the seven Nana Attakorah II Ventures prices approved from
-- invoice 0000931 collected during the 8 August 2026 field visit.

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  slug text not null,
  specifications jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, slug)
);

alter table public.product_variants enable row level security;
drop policy if exists "public active product variants" on public.product_variants;
create policy "public active product variants" on public.product_variants for select
using (is_active);
drop policy if exists "catalogue admins manage product variants" on public.product_variants;
create policy "catalogue admins manage product variants" on public.product_variants for all
using (public.is_platform_admin()) with check (public.is_platform_admin());

alter table public.supplier_listings
  add column if not exists product_variant_id uuid references public.product_variants(id),
  add column if not exists currency text not null default 'GHS' check(currency ~ '^[A-Z]{3}$'),
  add column if not exists price_effective_date date,
  add column if not exists price_source text,
  add column if not exists price_source_reference text,
  add column if not exists price_updated_by uuid references public.profiles(id);

alter table public.supplier_listings
  drop constraint if exists supplier_listing_variant_belongs_to_product;

create or replace function public.validate_supplier_listing_variant()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.product_variant_id is not null and not exists (
    select 1 from public.product_variants v
    where v.id = new.product_variant_id and v.product_id = new.product_id and v.is_active
  ) then
    raise exception 'The selected variant does not belong to this product';
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_listing_variant_guard on public.supplier_listings;
create trigger supplier_listing_variant_guard
before insert or update of product_id,product_variant_id on public.supplier_listings
for each row execute function public.validate_supplier_listing_variant();

drop index if exists public.supplier_listings_unique_product_default_sku;
create unique index if not exists supplier_listings_unique_parent_default_sku
  on public.supplier_listings(supplier_id, product_id)
  where sku is null and product_variant_id is null;
create unique index if not exists supplier_listings_unique_variant_default_sku
  on public.supplier_listings(supplier_id, product_id, product_variant_id)
  where sku is null and product_variant_id is not null;

create table if not exists public.supplier_price_history (
  id bigint generated always as identity primary key,
  supplier_listing_id uuid not null references public.supplier_listings(id) on delete restrict,
  previous_price numeric(14,2),
  new_price numeric(14,2) not null check(new_price >= 0),
  currency text not null default 'GHS' check(currency ~ '^[A-Z]{3}$'),
  effective_date date not null,
  source text not null,
  source_reference text,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_supplier_price_history_listing
  on public.supplier_price_history(supplier_listing_id, effective_date desc, created_at desc);
alter table public.supplier_price_history enable row level security;
drop policy if exists "supplier price history member read" on public.supplier_price_history;
create policy "supplier price history member read" on public.supplier_price_history for select
using (exists (
  select 1 from public.supplier_listings l
  where l.id = supplier_listing_id
    and (public.has_permission('products.view', l.supplier_id) or public.is_platform_admin())
));

create or replace function public.capture_supplier_price_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.price is not null and (tg_op = 'INSERT' or old.price is distinct from new.price) then
    insert into public.supplier_price_history(
      supplier_listing_id, previous_price, new_price, currency, effective_date,
      source, source_reference, changed_by
    ) values (
      new.id,
      case when tg_op = 'UPDATE' then old.price else null end,
      new.price,
      new.currency,
      coalesce(new.price_effective_date, current_date),
      coalesce(nullif(new.price_source, ''), 'supplier portal'),
      new.price_source_reference,
      coalesce(new.price_updated_by, auth.uid())
    );
    if new.price_source = 'field/supplier price sheet' then
      insert into public.audit_logs(actor_id,entity_type,entity_id,action,before_data,after_data)
      values (
        coalesce(new.price_updated_by,auth.uid()),'supplier_listing',new.id::text,
        'SUPPLIER_FIELD_PRICE_UPDATE',
        case when tg_op = 'UPDATE' then jsonb_build_object('price',old.price) end,
        jsonb_build_object(
          'supplier_id',new.supplier_id,'product_id',new.product_id,
          'product_variant_id',new.product_variant_id,'previous_price',case when tg_op = 'UPDATE' then old.price end,
          'new_price',new.price,'currency',new.currency,'effective_date',new.price_effective_date,
          'source',new.price_source,'source_reference',new.price_source_reference,
          'listing_status',new.listing_status,'stock_status',new.stock_status,'branch_id',new.branch_id
        )
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_price_history_capture on public.supplier_listings;
create trigger supplier_price_history_capture
after insert or update of price on public.supplier_listings
for each row execute function public.capture_supplier_price_history();

create table if not exists public.supplier_price_clarifications (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.organisations(id) on delete cascade,
  raw_description text not null,
  raw_price_text text,
  source text not null,
  source_reference text,
  effective_date date,
  status text not null default 'requires_confirmation' check(status in ('requires_confirmation','resolved','dismissed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(supplier_id, raw_description, source_reference)
);

alter table public.supplier_price_clarifications enable row level security;
drop policy if exists "supplier clarification member read" on public.supplier_price_clarifications;
create policy "supplier clarification member read" on public.supplier_price_clarifications for select
using (public.has_permission('products.view', supplier_id) or public.is_platform_admin());
drop policy if exists "catalogue admins manage supplier clarifications" on public.supplier_price_clarifications;
create policy "catalogue admins manage supplier clarifications" on public.supplier_price_clarifications for all
using (public.is_platform_admin()) with check (public.is_platform_admin());

do $$
begin
  if not exists (
    select 1 from public.organisations
    where id = '9b232d45-65f6-4f7d-83d5-d0907f98b4ff'
      and organisation_type = 'supplier'
  ) then
    raise exception 'Nana Attakorah II Ventures was not found';
  end if;
  if not exists (
    select 1 from public.supplier_branches
    where id = 'eca78e0f-1054-4c22-9d89-c36eba8d687c'
      and organisation_id = '9b232d45-65f6-4f7d-83d5-d0907f98b4ff'
  ) then
    raise exception 'The canonical Kwashieman branch was not found';
  end if;
end $$;

insert into public.products(category_id, name, slug, description, base_unit, images, is_active)
select c.id, x.name, x.slug, x.description, x.base_unit, x.images, true
from (values
  ('timber-wood','Timber Board','timber-board','Timber boards sold by species and specification.','board',array['/images/suppliers/nana-attakorah/sawn-timber.jpg']::text[]),
  ('timber-wood','Plywood','plywood','Plywood sheets sold by thickness and grade.','sheet',array['/images/suppliers/nana-attakorah/sawn-timber.jpg']::text[]),
  ('hardware-fittings','Louvre Glass','louvre-glass','Replacement louvre glass sold by finish and required dimensions.','piece',array['/images/suppliers/nana-attakorah/shop-front.jpg']::text[]),
  ('hardware-fittings','Silicone Sealant','silicone-sealant','Building silicone sealant. Confirm container size and application before ordering.','unit',array['/images/suppliers/nana-attakorah/metal-fittings.jpg']::text[])
) as x(category_slug,name,slug,description,base_unit,images)
join public.categories c on c.slug = x.category_slug
on conflict(slug) do nothing;

insert into public.product_variants(product_id,name,slug,specifications)
select p.id, x.variant_name, x.variant_slug, x.specifications
from (values
  ('sawn-hardwood-timber','Dahoma 2×6','dahoma-2x6',jsonb_build_object('species','Dahoma','dimensions','2×6')),
  ('sawn-hardwood-timber','Esa 2×6','esa-2x6',jsonb_build_object('species','Esa','dimensions','2×6')),
  ('timber-board','Wawa Board','wawa-board',jsonb_build_object('species','Wawa')),
  ('plywood','¾ inch','three-quarter-inch',jsonb_build_object('thickness','¾ inch')),
  ('louvre-glass','Tinted','tinted',jsonb_build_object('finish','Tinted')),
  ('louvre-glass','Plain','plain',jsonb_build_object('finish','Plain'))
) as x(product_slug,variant_name,variant_slug,specifications)
join public.products p on p.slug = x.product_slug
on conflict(product_id,slug) do update set
  name = excluded.name,
  specifications = excluded.specifications,
  is_active = true,
  updated_at = now();

with approved(product_slug,variant_slug,price) as (
  values
    ('sawn-hardwood-timber','dahoma-2x6',160::numeric),
    ('timber-board','wawa-board',220::numeric),
    ('sawn-hardwood-timber','esa-2x6',135::numeric),
    ('plywood','three-quarter-inch',320::numeric),
    ('louvre-glass','tinted',15::numeric),
    ('louvre-glass','plain',12::numeric),
    ('silicone-sealant',null,25::numeric)
), resolved as (
  select p.id product_id, v.id variant_id, a.price
  from approved a
  join public.products p on p.slug = a.product_slug
  left join public.product_variants v
    on v.product_id = p.id and v.slug = a.variant_slug
)
insert into public.supplier_listings(
  supplier_id,product_id,product_variant_id,price,currency,price_effective_date,
  price_source,price_source_reference,price_updated_by,stock_status,is_active,
  listing_status,branch_id,warehouse_id,delivery_available,pickup_available,supplier_notes
)
select
  '9b232d45-65f6-4f7d-83d5-d0907f98b4ff',r.product_id,r.variant_id,r.price,'GHS','2026-08-08',
  'field/supplier price sheet','Nana Attakorah III invoice 0000931',
  'f86fe061-edd9-4f5f-8a07-d749e6194eaa','confirmation_required',false,'draft',
  'eca78e0f-1054-4c22-9d89-c36eba8d687c',null,true,true,
  'Field price collected 8 August 2026. Confirm current stock and exact order requirements before publishing.'
from resolved r
where not exists (
  select 1 from public.supplier_listings l
  where l.supplier_id = '9b232d45-65f6-4f7d-83d5-d0907f98b4ff'
    and l.product_id = r.product_id
    and l.product_variant_id is not distinct from r.variant_id
    and l.sku is null
);

with approved(product_slug,variant_slug,price) as (
  values
    ('sawn-hardwood-timber','dahoma-2x6',160::numeric),
    ('timber-board','wawa-board',220::numeric),
    ('sawn-hardwood-timber','esa-2x6',135::numeric),
    ('plywood','three-quarter-inch',320::numeric),
    ('louvre-glass','tinted',15::numeric),
    ('louvre-glass','plain',12::numeric),
    ('silicone-sealant',null,25::numeric)
), resolved as (
  select p.id product_id, v.id variant_id, a.price
  from approved a join public.products p on p.slug = a.product_slug
  left join public.product_variants v on v.product_id = p.id and v.slug = a.variant_slug
)
update public.supplier_listings l set
  price = r.price,
  currency = 'GHS',
  price_effective_date = '2026-08-08',
  price_source = 'field/supplier price sheet',
  price_source_reference = 'Nana Attakorah III invoice 0000931',
  price_updated_by = 'f86fe061-edd9-4f5f-8a07-d749e6194eaa',
  stock_quantity = null,
  stock_status = 'confirmation_required',
  is_active = false,
  listing_status = 'draft',
  branch_id = 'eca78e0f-1054-4c22-9d89-c36eba8d687c',
  warehouse_id = null,
  updated_at = now()
from resolved r
where l.supplier_id = '9b232d45-65f6-4f7d-83d5-d0907f98b4ff'
  and l.product_id = r.product_id
  and l.product_variant_id is not distinct from r.variant_id
  and l.sku is null
  and (l.price,l.currency,l.price_effective_date,l.price_source,l.price_source_reference,l.stock_quantity,l.stock_status,l.is_active,l.listing_status,l.branch_id,l.warehouse_id)
      is distinct from
      (r.price,'GHS','2026-08-08'::date,'field/supplier price sheet','Nana Attakorah III invoice 0000931',null,'confirmation_required'::public.stock_status,false,'draft'::public.supplier_listing_status,'eca78e0f-1054-4c22-9d89-c36eba8d687c'::uuid,null::uuid);

insert into public.supplier_price_history(
  supplier_listing_id,previous_price,new_price,currency,effective_date,source,source_reference,changed_by
)
select l.id,null,l.price,l.currency,l.price_effective_date,l.price_source,l.price_source_reference,l.price_updated_by
from public.supplier_listings l
where l.supplier_id = '9b232d45-65f6-4f7d-83d5-d0907f98b4ff'
  and l.price_source_reference = 'Nana Attakorah III invoice 0000931'
  and l.price is not null
  and not exists (
    select 1 from public.supplier_price_history h
    where h.supplier_listing_id = l.id
      and h.new_price = l.price and h.effective_date = l.price_effective_date
      and h.source_reference = l.price_source_reference
  );

insert into public.supplier_price_clarifications(
  supplier_id,raw_description,raw_price_text,source,source_reference,effective_date,notes
)
select '9b232d45-65f6-4f7d-83d5-d0907f98b4ff',x.description,x.price_text,
  'field/supplier price sheet','Nana Attakorah III invoice 0000931','2026-08-08',
  'Handwriting, specification, unit, or price allocation requires supplier confirmation.'
from (values
  ('Cybers Board','150'),('Common Nails — various inches','50'),
  ('Concrete Nails — various inches','25'),('Slate','120'),
  ('Iron Sheets — coloured/plain','60/50/40'),('Louvre Frame','22'),
  ('Black Rubber for Building','500/25'),('Keys / Padlock / Cylinder','150/50/30'),
  ('Adhesive Glue “99”','250/45/25'),('Headrail / Handle / Trowel','50/60/80'),
  ('Door/Window Frame',null)
) as x(description,price_text)
on conflict(supplier_id,raw_description,source_reference) do nothing;

insert into public.audit_logs(actor_id,entity_type,entity_id,action,before_data,after_data)
select
  l.price_updated_by,'supplier_listing',l.id::text,'SUPPLIER_FIELD_PRICE_UPDATE',null,
  jsonb_build_object(
    'supplier_id',l.supplier_id,'product_id',l.product_id,'product_variant_id',l.product_variant_id,
    'previous_price',null,'new_price',l.price,'currency',l.currency,
    'effective_date',l.price_effective_date,'source',l.price_source,
    'source_reference',l.price_source_reference,'listing_status',l.listing_status,
    'stock_status',l.stock_status,'branch_id',l.branch_id
  )
from public.supplier_listings l
where l.supplier_id = '9b232d45-65f6-4f7d-83d5-d0907f98b4ff'
  and l.price_source_reference = 'Nana Attakorah III invoice 0000931'
  and not exists (
    select 1 from public.audit_logs a
    where a.entity_type = 'supplier_listing' and a.entity_id = l.id::text
      and a.action = 'SUPPLIER_FIELD_PRICE_UPDATE'
      and a.after_data->>'source_reference' = 'Nana Attakorah III invoice 0000931'
  );

revoke all on function public.validate_supplier_listing_variant() from public,anon,authenticated;
revoke all on function public.capture_supplier_price_history() from public,anon,authenticated;
